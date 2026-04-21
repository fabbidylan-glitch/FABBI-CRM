import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { enrollLead, exitEnrollment } from "@/lib/automation/engine";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";
import { ensureStageTasks } from "@/lib/features/leads/stage-workflow";
import {
  answerFor,
  parseAnnualRevenue,
  parseNiche,
  parsePropertyCount,
  parseServiceInterest,
  parseSource,
  parseTaxesPaid,
  parseUrgency,
} from "@/lib/validators/calendly-parse";
import { normalizePhoneE164 } from "@/lib/validators/lead-intake";
import { scoreLead } from "@/lib/scoring/score";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Calendly outbound webhook.
 *
 * Optimal intake flow uses this as the primary qualification surface:
 *   1. Prospect books a consult at calendly.com/…
 *   2. They answer 5 invitee questions (business type, revenue, service
 *      interest, urgency, source).
 *   3. Calendly webhook (direct or via Make.com) hits this endpoint.
 *   4. We fuzzy-match each answer to our enums, score the lead, create or
 *      merge the record, enroll in the qualified-lead sequence (instant
 *      confirmation email) AND the consult-reminder sequence (24h / 2h
 *      reminders).
 *
 * Accepts either Calendly's native payload shape or a Make.com-flattened one.
 * Signature verification runs only when CALENDLY_WEBHOOK_SIGNING_KEY is set.
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();

  const key = process.env.CALENDLY_WEBHOOK_SIGNING_KEY;
  if (key) {
    const header = req.headers.get("calendly-webhook-signature") ?? "";
    if (!verifyCalendlySignature(header, raw, key)) {
      return NextResponse.json({ error: "bad signature" }, { status: 401 });
    }
  }

  if (!config.dbEnabled) return NextResponse.json({ ok: true });

  let payload: CalendlyEvent;
  try {
    payload = JSON.parse(raw) as CalendlyEvent;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const eventType = payload.event;
  const invitee = payload.payload;
  if (!invitee?.email) return NextResponse.json({ ok: true });

  const emailNormalized = invitee.email.toLowerCase();
  const phoneE164 = normalizePhoneE164(invitee.text_reminder_number ?? null);

  // Extract qualifying answers. Calendly's native shape is an array
  // `questions_and_answers`. Make.com can also flatten these into a nested
  // `questions` object — we honor either.
  const qa = invitee.questions_and_answers ?? [];
  const q = invitee.questions ?? {};

  const niche = parseNiche(
    q.business_type ?? q.niche ?? answerFor(qa, /business|niche|what.*kind/i)
  );
  const annualRevenueRange = parseAnnualRevenue(
    q.annual_revenue ?? q.revenue ?? answerFor(qa, /revenue|top.?line|gross/i)
  );
  const taxesPaidLastYearRange = parseTaxesPaid(
    q.taxes_paid ?? q.taxes ?? answerFor(qa, /tax/i)
  );
  const propertyCount = parsePropertyCount(
    q.property_count ?? q.properties ?? answerFor(qa, /properties|units|rentals/i)
  );
  const urgency = parseUrgency(
    q.urgency ?? answerFor(qa, /urgent|timeline|when|soon/i)
  );
  const serviceInterest = parseServiceInterest(
    q.service_interest ?? q.service ?? answerFor(qa, /help|service|need/i)
  );
  const source = parseSource(
    q.source ?? q.how_did_you_hear ?? answerFor(qa, /hear|find|discover/i)
  );
  const painPoint =
    q.pain_point ??
    q.context ??
    q.notes ??
    answerFor(qa, /situation|describe|tell\s*us|context/i);

  // Name splitting — Calendly usually supplies full name only.
  const [firstName, ...rest] = (invitee.name ?? "").split(" ");
  const lastName = rest.join(" ");

  // Score the candidate now so we can route immediately.
  const scoring = await scoreLead({
    annualRevenueRange,
    taxesPaidLastYearRange,
    serviceInterest,
    propertyCount,
    urgency,
    source,
    statesOfOperation: [],
    w2IncomeFlag: false,
    payrollFlag: false,
    otherBusinessIncomeFlag: false,
    niche,
  });

  // Upsert the lead — if this email/phone has visited before, we merge.
  let lead = await prisma.lead.findFirst({
    where: {
      OR: [{ emailNormalized }, phoneE164 ? { phoneE164 } : { id: "__never__" }],
    },
  });

  const isNew = !lead;

  if (!lead) {
    lead = await prisma.lead.create({
      data: {
        firstName: firstName || null,
        lastName: lastName || null,
        fullName: invitee.name ?? null,
        email: invitee.email,
        emailNormalized,
        phone: invitee.text_reminder_number ?? null,
        phoneE164,
        source,
        niche,
        serviceInterest,
        annualRevenueRange,
        taxesPaidLastYearRange,
        propertyCount,
        urgency,
        painPoint: painPoint ?? null,
        pipelineStage:
          eventType === "invitee.created" ? "CONSULT_BOOKED" : "NEW_LEAD",
        qualificationStatus: scoring.qualification,
        leadScore: scoring.score,
        leadGrade: scoring.grade,
      },
    });
    await prisma.leadScoreBreakdown.create({
      data: { leadId: lead.id, ...scoring.breakdown, rulesVersion: "scoring.weights.v1" },
    });
    await prisma.pipelineEvent.create({
      data: {
        leadId: lead.id,
        eventType: "LEAD_CREATED",
        toStage: lead.pipelineStage,
        note: `Lead created via Calendly booking.`,
      },
    });
  } else {
    // Existing lead: update any fields that improved from UNKNOWN.
    const improvements: Record<string, unknown> = {};
    if (lead.niche === "UNKNOWN" && niche !== "UNKNOWN") improvements.niche = niche;
    if (
      lead.annualRevenueRange === "UNKNOWN" &&
      annualRevenueRange !== "UNKNOWN"
    )
      improvements.annualRevenueRange = annualRevenueRange;
    if (lead.taxesPaidLastYearRange === "UNKNOWN" && taxesPaidLastYearRange !== "UNKNOWN")
      improvements.taxesPaidLastYearRange = taxesPaidLastYearRange;
    if (lead.propertyCount === "UNKNOWN" && propertyCount !== "UNKNOWN")
      improvements.propertyCount = propertyCount;
    if (lead.urgency === "UNKNOWN" && urgency !== "UNKNOWN") improvements.urgency = urgency;
    if (lead.serviceInterest === "UNSURE" && serviceInterest !== "UNSURE")
      improvements.serviceInterest = serviceInterest;
    if (!lead.painPoint && painPoint) improvements.painPoint = painPoint;
    if (Object.keys(improvements).length > 0) {
      lead = await prisma.lead.update({ where: { id: lead.id }, data: improvements });
    }
  }

  const fromStage = lead.pipelineStage;

  if (eventType === "invitee.created") {
    if (fromStage !== "CONSULT_BOOKED") {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { pipelineStage: "CONSULT_BOOKED" },
      });
      await prisma.pipelineEvent.create({
        data: {
          leadId: lead.id,
          eventType: "CONSULT_BOOKED",
          fromStage,
          toStage: "CONSULT_BOOKED",
          note: `Consult booked at ${invitee.scheduled_event?.start_time ?? "unknown time"}.`,
          metadataJson: invitee as unknown as object,
        },
      });
    }

    // Enroll in consult reminders (24h + 2h prep touches).
    await enrollLead({
      leadId: lead.id,
      sequenceKey: "consult_reminder_v1",
      runImmediate: true,
    });

    // Auto-create pre-consult prep task so the rep has time to review.
    await ensureStageTasks({ leadId: lead.id, toStage: "CONSULT_BOOKED" });

    // For brand-new leads only: also enroll in the qualified-lead intro
    // sequence. This sends the instant confirmation email so the prospect
    // gets the same "thanks, here's what to expect" flow whether they came
    // through /intake or directly through Calendly.
    if (
      isNew &&
      (scoring.qualification === "QUALIFIED" ||
        scoring.qualification === "MANUAL_REVIEW")
    ) {
      await enrollLead({
        leadId: lead.id,
        sequenceKey: "new_lead_qualified_v1",
        runImmediate: true,
      });
    }
  } else if (eventType === "invitee.canceled") {
    if (fromStage === "CONSULT_BOOKED") {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { pipelineStage: "CONTACTED" },
      });
      await prisma.pipelineEvent.create({
        data: {
          leadId: lead.id,
          eventType: "CONSULT_NO_SHOW",
          fromStage,
          toStage: "CONTACTED",
          note: "Consult canceled.",
          metadataJson: invitee as unknown as object,
        },
      });
    }
    const enr = await prisma.sequenceEnrollment.findUnique({
      where: { leadId_sequenceKey: { leadId: lead.id, sequenceKey: "consult_reminder_v1" } },
    });
    if (enr) await exitEnrollment(enr.id, "MANUAL_STOP");
  }

  return NextResponse.json({
    ok: true,
    leadId: lead.id,
    event: eventType,
    isNewLead: isNew,
    score: scoring.score,
    grade: scoring.grade,
    qualification: scoring.qualification,
  });
}

function verifyCalendlySignature(header: string, rawBody: string, secret: string): boolean {
  const parts = Object.fromEntries(
    header.split(",").map((kv) => {
      const [k, v] = kv.split("=");
      return [k?.trim() ?? "", v?.trim() ?? ""];
    })
  );
  const ts = parts["t"];
  const sig = parts["v1"];
  if (!ts || !sig) return false;

  const age = Math.abs(Date.now() / 1000 - Number(ts));
  if (!Number.isFinite(age) || age > 300) return false;

  const expected = crypto.createHmac("sha256", secret).update(`${ts}.${rawBody}`).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

type CalendlyEvent = {
  event: "invitee.created" | "invitee.canceled" | string;
  payload: {
    email?: string;
    name?: string;
    text_reminder_number?: string | null;
    scheduled_event?: { start_time?: string; end_time?: string; uri?: string };
    questions_and_answers?: Array<{ question: string; answer: string }>;
    questions?: Record<string, string | undefined>;
  };
};
