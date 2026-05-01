import "server-only";
import { enrollLead } from "@/lib/automation/engine";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";
import { sendMessage } from "@/lib/messaging/send";
import { scoreLead } from "@/lib/scoring/score";
import { computeLeadTier } from "@/lib/scoring/tier";
import { sendNewLeadAlert } from "@/lib/notifications/new-lead-alert";
import { normalizePhoneE164, type LeadIntakeInput } from "@/lib/validators/lead-intake";

export type IntakeResult = {
  leadId: string;
  created: boolean;
  score: number;
  grade: "A" | "B" | "C" | "D";
  qualification: "QUALIFIED" | "MANUAL_REVIEW" | "NURTURE_ONLY" | "DISQUALIFIED";
  tier: "HIGH" | "MEDIUM" | "LOW";
  tierScore: number;
};

export type IntakeContext = {
  ipAddress?: string | null;
  userAgent?: string | null;
  referer?: string | null;
  landingPageUrl?: string | null;
};

/**
 * Create or merge a lead from an intake submission.
 *
 * - Dedupe by normalized email; if found, append a LeadSubmission to the
 *   existing lead and return (created=false).
 * - Scoring runs in all cases; the existing lead's score is updated if the new
 *   submission produces a higher score (prospect volunteered better info).
 * - Every write is wrapped in a transaction so the lead, submission, score
 *   breakdown, and pipeline event are all persisted together.
 */
export async function intakeLead(input: LeadIntakeInput, ctx: IntakeContext = {}): Promise<IntakeResult> {
  const scoring = await scoreLead(input);
  const tierResult = computeLeadTier(input);

  if (!config.dbEnabled) {
    // Preview mode: just return the scored result so the form can show feedback.
    return {
      leadId: "preview",
      created: true,
      score: scoring.score,
      grade: scoring.grade,
      qualification: scoring.qualification,
      tier: tierResult.tier,
      tierScore: tierResult.score,
    };
  }

  const emailNormalized = input.email.toLowerCase();
  const phoneE164 = normalizePhoneE164(input.phone);

  return await prisma.$transaction(async (tx) => {
    const existing = await tx.lead.findFirst({
      where: { OR: [{ emailNormalized }, phoneE164 ? { phoneE164 } : { id: "__never__" }] },
    });

    if (existing) {
      await tx.leadSubmission.create({
        data: {
          leadId: existing.id,
          sourceType: input.source,
          payloadJson: sanitizePayload(input),
          ipAddress: ctx.ipAddress ?? null,
          userAgent: ctx.userAgent ?? null,
          referer: ctx.referer ?? null,
          landingPageUrl: ctx.landingPageUrl ?? null,
        },
      });

      let updated = existing;
      if (scoring.score > existing.leadScore) {
        updated = await tx.lead.update({
          where: { id: existing.id },
          data: {
            leadScore: scoring.score,
            leadGrade: scoring.grade,
            qualificationStatus: scoring.qualification,
            leadTier: tierResult.tier,
            leadTierScore: tierResult.score,
          },
        });
        await tx.leadScoreBreakdown.create({
          data: { leadId: existing.id, ...scoring.breakdown, rulesVersion: "scoring.weights.v1" },
        });
        await tx.pipelineEvent.create({
          data: {
            leadId: existing.id,
            eventType: "SCORE_UPDATED",
            note: `Re-scored after new submission: ${existing.leadScore} → ${scoring.score}`,
          },
        });
      }

      return {
        leadId: updated.id,
        created: false,
        score: scoring.score,
        grade: scoring.grade,
        qualification: scoring.qualification,
        tier: tierResult.tier,
        tierScore: tierResult.score,
      };
    }

    const lead = await tx.lead.create({
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        fullName: `${input.firstName} ${input.lastName}`.trim(),
        email: input.email,
        emailNormalized,
        phone: input.phone || null,
        phoneE164,
        companyName: input.companyName || null,
        websiteUrl: input.websiteUrl || null,
        source: input.source,
        campaignName: input.campaignName || null,
        utmSource: input.utmSource || null,
        utmMedium: input.utmMedium || null,
        utmCampaign: input.utmCampaign || null,
        utmTerm: input.utmTerm || null,
        utmContent: input.utmContent || null,
        // Mini-brand attribution from the marketing site. First-touch values
        // — we don't overwrite on later submissions from the same lead.
        serviceLine: input.serviceLine || null,
        sourceSubdomain: input.sourceSubdomain || null,
        landingPageUrl: input.landingPageUrl || null,
        referrer: input.referrer || null,
        niche: input.niche,
        serviceInterest: input.serviceInterest,
        serviceInterests: input.serviceInterests ?? [],
        annualRevenueRange: input.annualRevenueRange,
        taxesPaidLastYearRange: input.taxesPaidLastYearRange,
        propertyCount: input.propertyCount,
        urgency: input.urgency,
        statesOfOperation: input.statesOfOperation ?? [],
        w2IncomeFlag: input.w2IncomeFlag,
        payrollFlag: input.payrollFlag,
        otherBusinessIncomeFlag: input.otherBusinessIncomeFlag,
        costSegInterest: input.costSegInterest ?? null,
        salesChannels: input.salesChannels ?? [],
        monthlyAdSpendRange: input.monthlyAdSpendRange ?? null,
        booksStatus: input.booksStatus ?? null,
        painPoint: input.painPoint || null,
        notes: input.notes || null,
        leadScore: scoring.score,
        leadGrade: scoring.grade,
        qualificationStatus: scoring.qualification,
        leadTier: tierResult.tier,
        leadTierScore: tierResult.score,
      },
    });

    await tx.leadSubmission.create({
      data: {
        leadId: lead.id,
        sourceType: input.source,
        payloadJson: sanitizePayload(input),
        ipAddress: ctx.ipAddress ?? null,
        userAgent: ctx.userAgent ?? null,
        referer: ctx.referer ?? null,
        landingPageUrl: ctx.landingPageUrl ?? null,
      },
    });

    await tx.leadScoreBreakdown.create({
      data: { leadId: lead.id, ...scoring.breakdown, rulesVersion: "scoring.weights.v1" },
    });

    await tx.pipelineEvent.create({
      data: {
        leadId: lead.id,
        eventType: "LEAD_CREATED",
        toStage: "NEW_LEAD",
        note: `Lead created via ${input.source}. Tier: ${tierResult.tier} (score ${tierResult.score}).`,
      },
    });

    return {
      leadId: lead.id,
      created: true,
      score: scoring.score,
      grade: scoring.grade,
      qualification: scoring.qualification,
      tier: tierResult.tier,
      tierScore: tierResult.score,
    };
  }).then(async (result) => {
    // Every prospect gets an instant acknowledgment email, regardless of
    // qualification — even cold leads deserve a reply, and it's bad UX to
    // ghost someone who filled out the form.
    //
    // Routing:
    //   - QUALIFIED / MANUAL_REVIEW (new) → enroll in the multi-touch sequence
    //     whose step 0 IS the inquiry confirmation (email fires via sequence)
    //   - Anyone else (including merged leads) → send the confirmation directly
    //     so the prospect still hears back even if we're not pursuing them
    const isHighFit =
      scoring.qualification === "QUALIFIED" || scoring.qualification === "MANUAL_REVIEW";

    if (result.created && isHighFit) {
      try {
        await enrollLead({
          leadId: result.leadId,
          sequenceKey: "new_lead_qualified_v1",
          runImmediate: true,
        });
      } catch (err) {
        console.error("[intake] sequence enrollment failed", err);
      }
    } else {
      try {
        await sendMessage({
          leadId: result.leadId,
          templateKey: "inquiry.confirmation.email",
          channel: "EMAIL",
        });
      } catch (err) {
        // NOT_CONFIGURED (no Resend/Graph key) and MISSING_CONTACT (no email
        // on file) are both expected edge-cases; log and move on.
        console.error("[intake] confirmation email failed", err);
      }
    }

    // Fire internal alert (Slack + email) so the team can respond within
    // minutes, not a day. HIGH tier is visually emphasized. Only alerts on
    // newly-created leads — dedup-merged re-submissions don't re-notify.
    if (result.created) {
      try {
        await sendNewLeadAlert({
          leadId: result.leadId,
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          phone: input.phone || null,
          revenueRange: input.annualRevenueRange,
          serviceInterest: input.serviceInterest,
          serviceInterests: input.serviceInterests ?? [],
          niche: input.niche,
          statesOfOperation: input.statesOfOperation ?? [],
          tier: tierResult.tier,
          tierScore: tierResult.score,
          tierReasons: tierResult.reasons,
          leadScore: scoring.score,
          leadGrade: scoring.grade,
          qualification: scoring.qualification,
          sourcePage: extractSourcePage(input.notes ?? null),
          painPoint: input.painPoint || null,
          sourceSubdomain: input.sourceSubdomain || null,
          serviceLine: input.serviceLine || null,
          landingPageUrl: input.landingPageUrl || null,
          referrer: input.referrer || null,
        });
      } catch (err) {
        console.error("[intake] new-lead alert failed", err);
      }
    }
    return result;
  });
}

// The 2-step intake form prefixes the notes field with "[Landing page: X]"
// when the page= attribution param is present. Pull it out so Slack alerts
// can show the landing page without dumping the raw notes.
function extractSourcePage(notes: string | null): string | null {
  if (!notes) return null;
  const m = notes.match(/^\[Landing page:\s*([^\]]+)\]/);
  return m ? m[1].trim() : null;
}

function sanitizePayload(input: LeadIntakeInput) {
  const { website_hp: _hp, ...rest } = input;
  void _hp;
  return rest;
}
