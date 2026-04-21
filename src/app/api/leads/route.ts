import { auth } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { enrollLead } from "@/lib/automation/engine";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";
import { scoreLead } from "@/lib/scoring/score";
import {
  AnnualRevenueEnum,
  NicheEnum,
  PropertyCountEnum,
  ServiceInterestEnum,
  SourceEnum,
  TaxesPaidEnum,
  UrgencyEnum,
  normalizePhoneE164,
} from "@/lib/validators/lead-intake";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Authenticated "add a lead manually" endpoint. Distinct from the public
 * intake (`/api/public/lead`) because:
 *   - no rate limiting (authed users are trusted)
 *   - no honeypot
 *   - optional sequence enrollment (default OFF — most manual adds are
 *     warm referrals the rep will handle personally)
 *   - owner can be set up front
 */
const schema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email().max(160).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  companyName: z.string().trim().max(160).optional().or(z.literal("")),

  source: SourceEnum.default("MANUAL"),
  niche: NicheEnum.default("UNKNOWN"),
  serviceInterest: ServiceInterestEnum.default("UNSURE"),
  annualRevenueRange: AnnualRevenueEnum.default("UNKNOWN"),
  taxesPaidLastYearRange: TaxesPaidEnum.default("UNKNOWN"),
  propertyCount: PropertyCountEnum.default("UNKNOWN"),
  urgency: UrgencyEnum.default("UNKNOWN"),

  estimatedAnnualValue: z
    .union([z.number(), z.string().transform((s) => (s.trim() === "" ? null : Number(s)))])
    .nullable()
    .optional(),
  painPoint: z.string().trim().max(4000).optional(),
  notes: z.string().trim().max(4000).optional(),

  ownerUserId: z.string().nullable().optional(),
  enrollInSequence: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  if (!config.dbEnabled || !config.authEnabled)
    return NextResponse.json({ error: "Database + auth required." }, { status: 503 });

  const session = await auth();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      {
        error: "Validation failed",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 422 }
    );
  const input = parsed.data;

  if (!input.email && !input.phone) {
    return NextResponse.json(
      { error: "Either email or phone is required." },
      { status: 422 }
    );
  }

  const actor = await prisma.user.findFirst({ where: { externalId: session.userId } });
  const emailNormalized = input.email ? input.email.toLowerCase() : null;
  const phoneE164 = normalizePhoneE164(input.phone || null);

  // Dedup by email or phone — if the lead already exists, redirect the rep
  // to the existing record instead of silently creating a duplicate.
  if (emailNormalized || phoneE164) {
    const existing = await prisma.lead.findFirst({
      where: {
        OR: [
          ...(emailNormalized ? [{ emailNormalized }] : []),
          ...(phoneE164 ? [{ phoneE164 }] : []),
        ],
      },
      select: { id: true, firstName: true, lastName: true, email: true },
    });
    if (existing) {
      return NextResponse.json({
        ok: true,
        leadId: existing.id,
        duplicate: true,
        message: `A lead with that email/phone already exists: ${existing.firstName ?? ""} ${existing.lastName ?? ""}`.trim(),
      });
    }
  }

  const scoring = await scoreLead({
    annualRevenueRange: input.annualRevenueRange,
    taxesPaidLastYearRange: input.taxesPaidLastYearRange,
    serviceInterest: input.serviceInterest,
    propertyCount: input.propertyCount,
    urgency: input.urgency,
    source: input.source,
    statesOfOperation: [],
    w2IncomeFlag: false,
    payrollFlag: false,
    otherBusinessIncomeFlag: false,
    niche: input.niche,
  });

  const ownerUserId = input.ownerUserId ?? actor?.id ?? null;
  const estimatedAnnualValue =
    input.estimatedAnnualValue === null || input.estimatedAnnualValue === undefined
      ? null
      : Number(input.estimatedAnnualValue);

  const lead = await prisma.lead.create({
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      fullName: `${input.firstName} ${input.lastName}`.trim(),
      email: input.email || null,
      emailNormalized,
      phone: input.phone || null,
      phoneE164,
      companyName: input.companyName || null,
      source: input.source,
      niche: input.niche,
      serviceInterest: input.serviceInterest,
      annualRevenueRange: input.annualRevenueRange,
      taxesPaidLastYearRange: input.taxesPaidLastYearRange,
      propertyCount: input.propertyCount,
      urgency: input.urgency,
      estimatedAnnualValue,
      painPoint: input.painPoint || null,
      notes: input.notes || null,
      ownerUserId,
      leadScore: scoring.score,
      leadGrade: scoring.grade,
      qualificationStatus: scoring.qualification,
    },
  });

  await prisma.leadScoreBreakdown.create({
    data: { leadId: lead.id, ...scoring.breakdown, rulesVersion: "scoring.weights.v1" },
  });
  await prisma.pipelineEvent.create({
    data: {
      leadId: lead.id,
      actorUserId: actor?.id ?? null,
      eventType: "LEAD_CREATED",
      toStage: "NEW_LEAD",
      note: `Lead added manually${actor ? ` by ${actor.firstName} ${actor.lastName}` : ""}.`,
    },
  });

  if (input.enrollInSequence && (scoring.qualification === "QUALIFIED" || scoring.qualification === "MANUAL_REVIEW")) {
    try {
      await enrollLead({
        leadId: lead.id,
        sequenceKey: "new_lead_qualified_v1",
        runImmediate: true,
      });
    } catch (err) {
      console.error("[new-lead] sequence enrollment failed", err);
    }
  }

  return NextResponse.json({
    ok: true,
    leadId: lead.id,
    score: scoring.score,
    grade: scoring.grade,
    qualification: scoring.qualification,
  });
}
