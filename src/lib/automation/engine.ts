import "server-only";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";
import { sendMessage } from "@/lib/messaging/send";
import { getSequence, type SequenceStep } from "./sequences";
import type { Prisma } from "@prisma/client";

// Reasons a step might be skipped rather than fired — e.g. channel not
// configured, or a guard condition says the lead already replied.
type StepOutcome = "EXECUTED" | "SKIPPED" | "EXITED" | "FAILED";

/**
 * Enroll a lead in a sequence. Idempotent — returns the existing enrollment
 * if one is already active. If `runImmediate` is true we execute the first
 * step (minutesAfterEnroll: 0) inline; otherwise the cron will pick it up.
 */
export async function enrollLead(params: {
  leadId: string;
  sequenceKey: string;
  runImmediate?: boolean;
}): Promise<{ enrollmentId: string; created: boolean }> {
  const def = getSequence(params.sequenceKey);
  if (!def) throw new Error(`Unknown sequence ${params.sequenceKey}`);

  const existing = await prisma.sequenceEnrollment.findUnique({
    where: { leadId_sequenceKey: { leadId: params.leadId, sequenceKey: params.sequenceKey } },
  });
  if (existing && existing.status !== "EXITED" && existing.status !== "COMPLETED") {
    return { enrollmentId: existing.id, created: false };
  }

  const enrolledAt = new Date();
  const firstStep = def.steps[0];
  const nextStepAt = firstStep ? new Date(enrolledAt.getTime() + firstStep.minutesAfterEnroll * 60_000) : null;

  const enrollment = existing
    ? await prisma.sequenceEnrollment.update({
        where: { id: existing.id },
        data: {
          status: "ACTIVE",
          enrolledAt,
          exitedAt: null,
          exitReason: null,
          currentStepIndex: 0,
          nextStepAt,
        },
      })
    : await prisma.sequenceEnrollment.create({
        data: {
          leadId: params.leadId,
          sequenceKey: params.sequenceKey,
          status: "ACTIVE",
          enrolledAt,
          currentStepIndex: 0,
          nextStepAt,
        },
      });

  await prisma.pipelineEvent.create({
    data: {
      leadId: params.leadId,
      eventType: "SEQUENCE_ENROLLED",
      note: `Enrolled in "${def.name}"`,
      metadataJson: { sequenceKey: def.key } satisfies Prisma.JsonObject,
    },
  });

  if (params.runImmediate && firstStep && firstStep.minutesAfterEnroll === 0) {
    await processEnrollment(enrollment.id).catch((err) => {
      // Don't let a failed immediate step break lead creation; the cron retries.
      console.error(`[automation] immediate step failed for ${enrollment.id}`, err);
    });
  }

  return { enrollmentId: enrollment.id, created: !existing };
}

/**
 * Execute the current step of one enrollment, then advance.
 *
 * Concurrency-safe: we "claim" the step with a compare-and-swap `updateMany`
 * on (id, currentStepIndex, status) BEFORE doing any work. The claim also
 * pushes `nextStepAt` 10 minutes into the future so the cron's "due" query
 * can't pick the same enrollment up again while we're processing it. If
 * something else already claimed this step (because e.g. the cron raced
 * with `runImmediate: true` at enrollment time), we return SKIPPED.
 */
export async function processEnrollment(enrollmentId: string): Promise<StepOutcome> {
  const enrollment = await prisma.sequenceEnrollment.findUnique({ where: { id: enrollmentId } });
  if (!enrollment) return "SKIPPED";
  if (enrollment.status !== "ACTIVE" && enrollment.status !== "ENROLLED") return "SKIPPED";

  const def = getSequence(enrollment.sequenceKey);
  if (!def) {
    await prisma.sequenceEnrollment.update({
      where: { id: enrollmentId },
      data: { status: "EXITED", exitReason: "ERROR", exitedAt: new Date() },
    });
    return "FAILED";
  }

  const step = def.steps[enrollment.currentStepIndex];
  if (!step) return complete(enrollmentId, "COMPLETED");

  // Atomic claim — only one runner can win this compare-and-swap.
  const lockUntil = new Date(Date.now() + 10 * 60_000);
  const claim = await prisma.sequenceEnrollment.updateMany({
    where: {
      id: enrollmentId,
      currentStepIndex: enrollment.currentStepIndex,
      status: { in: ["ACTIVE", "ENROLLED"] },
    },
    data: { nextStepAt: lockUntil },
  });
  if (claim.count === 0) {
    // Another runner claimed it first. That's fine — they'll handle this step.
    return "SKIPPED";
  }

  // Guard: if the lead has already replied since enrollment, exit early rather
  // than pestering them with the next touch.
  if (await leadRepliedSince(enrollment.leadId, enrollment.enrolledAt)) {
    return complete(enrollmentId, "REPLIED");
  }

  let outcome: StepOutcome = "EXECUTED";
  try {
    outcome = await runStep(step, enrollment.leadId);
  } catch (err) {
    console.error(`[automation] step failed for ${enrollmentId}`, err);
    outcome = "FAILED";
  }

  if (outcome === "EXITED") return complete(enrollmentId, "COMPLETED");

  const nextIdx = enrollment.currentStepIndex + 1;
  const nextStep = def.steps[nextIdx];
  if (!nextStep) return complete(enrollmentId, "COMPLETED");

  const nextAt = new Date(enrollment.enrolledAt.getTime() + nextStep.minutesAfterEnroll * 60_000);

  await prisma.sequenceEnrollment.update({
    where: { id: enrollmentId },
    data: { currentStepIndex: nextIdx, nextStepAt: nextAt, status: "ACTIVE" },
  });

  return outcome;
}

/**
 * Pick up every enrollment whose nextStepAt is due, process one step each,
 * and return a summary. Called by the cron.
 */
export async function processDueSequences(now: Date = new Date()): Promise<{
  processed: number;
  outcomes: Record<StepOutcome, number>;
}> {
  const due = await prisma.sequenceEnrollment.findMany({
    where: {
      status: { in: ["ACTIVE", "ENROLLED"] },
      nextStepAt: { lte: now, not: null },
    },
    orderBy: { nextStepAt: "asc" },
    take: 100,
  });

  const outcomes: Record<StepOutcome, number> = { EXECUTED: 0, SKIPPED: 0, EXITED: 0, FAILED: 0 };
  for (const e of due) {
    const result = await processEnrollment(e.id);
    outcomes[result]++;
  }
  return { processed: due.length, outcomes };
}

/**
 * Mark an enrollment with a terminal state (e.g. lead replied, sequence
 * completed, manually stopped). Creates a timeline event.
 */
export async function exitEnrollment(
  enrollmentId: string,
  reason: "COMPLETED" | "REPLIED" | "PROPOSAL_ACCEPTED" | "PROPOSAL_DECLINED" | "MANUAL_STOP" | "DISQUALIFIED"
) {
  return complete(enrollmentId, reason);
}

// ── internals ────────────────────────────────────────────────────────────────

async function complete(
  enrollmentId: string,
  reason: "COMPLETED" | "REPLIED" | "PROPOSAL_ACCEPTED" | "PROPOSAL_DECLINED" | "MANUAL_STOP" | "DISQUALIFIED"
): Promise<StepOutcome> {
  const enrollment = await prisma.sequenceEnrollment.update({
    where: { id: enrollmentId },
    data: {
      status: reason === "COMPLETED" ? "COMPLETED" : "EXITED",
      exitedAt: new Date(),
      exitReason: reason,
      nextStepAt: null,
    },
  });
  await prisma.pipelineEvent.create({
    data: {
      leadId: enrollment.leadId,
      eventType: "SEQUENCE_EXITED",
      note: `Sequence "${enrollment.sequenceKey}" exited (${reason})`,
      metadataJson: { reason, sequenceKey: enrollment.sequenceKey } satisfies Prisma.JsonObject,
    },
  });
  return "EXITED";
}

async function leadRepliedSince(leadId: string, since: Date): Promise<boolean> {
  const count = await prisma.communication.count({
    where: { leadId, direction: "INBOUND", createdAt: { gte: since } },
  });
  return count > 0;
}

async function runStep(step: SequenceStep, leadId: string): Promise<StepOutcome> {
  switch (step.type) {
    case "SEND_EMAIL":
      if (!config.emailEnabled) return "SKIPPED"; // no adapter configured yet
      await sendMessage({ leadId, templateKey: step.templateKey, channel: "EMAIL" });
      return "EXECUTED";

    case "SEND_WHATSAPP":
      if (!config.whatsappEnabled) return "SKIPPED";
      // Cold-outbound on WhatsApp requires a Meta-approved template. The
      // adapter's `sendWhatsAppTemplate` pathway only fires when we pass
      // `whatsappTemplateName`. Without it, Meta rejects anything sent to a
      // lead who hasn't messaged us first. Rather than crash the sequence
      // step, we SKIP until the step is properly configured with an approved
      // template name.
      if (!step.whatsappTemplateName) {
        console.info(
          `[automation] SEND_WHATSAPP skipped for lead ${leadId}: step is missing whatsappTemplateName (template not yet approved in Meta Business Manager)`
        );
        return "SKIPPED";
      }
      try {
        await sendMessage({
          leadId,
          templateKey: step.templateKey,
          channel: "WHATSAPP",
          whatsappTemplateName: step.whatsappTemplateName,
        });
      } catch (err) {
        if (
          err instanceof Error &&
          (err.message.includes("not found") || err.message.includes("NOT_CONFIGURED"))
        ) {
          return "SKIPPED";
        }
        throw err;
      }
      return "EXECUTED";

    case "SEND_SMS":
      if (!config.smsEnabled) return "SKIPPED";
      await sendMessage({
        leadId,
        templateKey: step.templateKey,
        channel: "SMS",
      });
      return "EXECUTED";

    case "CREATE_TASK":
      await prisma.task.create({
        data: {
          leadId,
          taskType: step.taskType,
          title: step.title,
          description: step.note ?? null,
          priority: step.priority ?? "MEDIUM",
          dueAt: new Date(Date.now() + 15 * 60_000), // default 15-min SLA
        },
      });
      await prisma.pipelineEvent.create({
        data: { leadId, eventType: "TASK_CREATED", note: step.title },
      });
      return "EXECUTED";

    case "EXIT":
      return "EXITED";
  }
}
