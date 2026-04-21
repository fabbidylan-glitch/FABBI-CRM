import { auth } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";
import { normalizePhoneE164 } from "@/lib/validators/lead-intake";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Only fields we want users to edit via the UI. Stage/owner/grade/score have
// their own dedicated endpoints so the pipeline event log stays correct.
const patchSchema = z.object({
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
  email: z.string().trim().toLowerCase().email().max(160).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  companyName: z.string().trim().max(160).nullable().optional(),
  websiteUrl: z
    .string()
    .trim()
    .max(400)
    .nullable()
    .optional()
    .refine((v) => !v || /^https?:\/\//.test(v), "Website must start with http(s)://"),
  airbnbOrListingUrl: z.string().trim().max(400).nullable().optional(),
  painPoint: z.string().trim().max(4000).nullable().optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
  estimatedAnnualValue: z
    .union([z.number(), z.string().transform((s) => (s.trim() === "" ? null : Number(s)))])
    .nullable()
    .optional()
    .refine((v) => v === null || v === undefined || (Number.isFinite(v) && v >= 0), {
      message: "Estimated annual value must be a non-negative number",
    }),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!config.dbEnabled || !config.authEnabled)
    return NextResponse.json({ error: "Database + auth required." }, { status: 503 });

  const session = await auth();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
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
  }

  const input = parsed.data;
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const actor = await prisma.user.findFirst({ where: { externalId: session.userId } });

  // Derive normalized fields when source values change.
  const data: Record<string, unknown> = {};
  const changes: string[] = [];

  if (input.firstName !== undefined && input.firstName !== lead.firstName) {
    data.firstName = input.firstName;
    changes.push(`first name → ${input.firstName}`);
  }
  if (input.lastName !== undefined && input.lastName !== lead.lastName) {
    data.lastName = input.lastName;
    changes.push(`last name → ${input.lastName}`);
  }
  if (data.firstName || data.lastName) {
    data.fullName = `${(data.firstName ?? lead.firstName) ?? ""} ${
      (data.lastName ?? lead.lastName) ?? ""
    }`.trim();
  }
  if (input.email !== undefined) {
    const next = input.email?.toLowerCase() ?? null;
    if (next !== (lead.email?.toLowerCase() ?? null)) {
      data.email = input.email;
      data.emailNormalized = next;
      changes.push(`email → ${input.email ?? "(cleared)"}`);
    }
  }
  if (input.phone !== undefined) {
    const nextRaw = input.phone ?? null;
    const nextE164 = normalizePhoneE164(nextRaw);
    if (nextRaw !== lead.phone) {
      data.phone = nextRaw;
      data.phoneE164 = nextE164;
      changes.push(`phone → ${nextRaw ?? "(cleared)"}`);
    }
  }
  if (input.companyName !== undefined && input.companyName !== lead.companyName) {
    data.companyName = input.companyName;
    changes.push(`company → ${input.companyName ?? "(cleared)"}`);
  }
  if (input.websiteUrl !== undefined && input.websiteUrl !== lead.websiteUrl) {
    data.websiteUrl = input.websiteUrl;
    changes.push(`website → ${input.websiteUrl ?? "(cleared)"}`);
  }
  if (input.airbnbOrListingUrl !== undefined && input.airbnbOrListingUrl !== lead.airbnbOrListingUrl) {
    data.airbnbOrListingUrl = input.airbnbOrListingUrl;
    changes.push(`listing URL → ${input.airbnbOrListingUrl ?? "(cleared)"}`);
  }
  if (input.painPoint !== undefined && input.painPoint !== lead.painPoint) {
    data.painPoint = input.painPoint;
    changes.push(`pain point updated`);
  }
  if (input.notes !== undefined && input.notes !== lead.notes) {
    data.notes = input.notes;
    changes.push(`notes updated`);
  }
  if (input.estimatedAnnualValue !== undefined) {
    const existingValue = lead.estimatedAnnualValue ? Number(lead.estimatedAnnualValue) : null;
    const nextValue = input.estimatedAnnualValue === null ? null : Number(input.estimatedAnnualValue);
    if (existingValue !== nextValue) {
      data.estimatedAnnualValue = nextValue;
      changes.push(`est. annual value → ${nextValue !== null ? `$${nextValue}` : "(cleared)"}`);
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: true, unchanged: true });
  }

  await prisma.$transaction([
    prisma.lead.update({ where: { id }, data }),
    prisma.pipelineEvent.create({
      data: {
        leadId: id,
        actorUserId: actor?.id ?? null,
        eventType: "OTHER",
        note: `Contact edited: ${changes.join(", ")}`,
      },
    }),
  ]);

  return NextResponse.json({ ok: true, updatedFields: Object.keys(data) });
}
