import "server-only";
import { prisma } from "@/lib/db";
import type { PipelineStage, TaskPriority, TaskType } from "@prisma/client";
import { addBusinessHours } from "./business-hours";

/**
 * Workflow enforcement: when a lead's stage transitions, create the follow-up
 * work that SHOULD happen next so nothing falls through the cracks.
 *
 * Called from every stage-change entry point:
 *   - PATCH /api/leads/[id]/stage           (manual dropdown)
 *   - POST  /api/leads/bulk                 (bulk stage change)
 *   - POST  /api/leads/[id]/consult-outcome (Showed up → CONSULT_COMPLETED)
 *   - POST  /api/public/calendly/webhook    (Calendly booking → CONSULT_BOOKED)
 *   - POST  /api/public/anchor/webhook      (Anchor accepted → WON)
 *
 * Idempotent: we skip task creation when a comparable open task already
 * exists for the lead (matched by title substring). So rapid yo-yo stage
 * changes don't pile up duplicate tasks.
 */

type StageRule = {
  taskType: TaskType;
  title: string;
  description?: string;
  priority: TaskPriority;
  /** Due date offset from "now" in hours. */
  dueInHours: number;
  /** Substring used to dedupe: if an open task's title contains this, skip. */
  dedupeKey: string;
};

const STAGE_TASK_RULES: Partial<Record<PipelineStage, StageRule[]>> = {
  QUALIFIED: [
    {
      taskType: "CALL",
      title: "Schedule consult — qualified lead",
      description:
        "Lead is qualified. Call or text the booking link within the day; if no response within 24h, send a follow-up email.",
      priority: "HIGH",
      dueInHours: 4,
      dedupeKey: "Schedule consult",
    },
  ],
  CONSULT_BOOKED: [
    {
      taskType: "REVIEW",
      title: "Pre-consult prep — review lead details",
      description:
        "Review the lead's niche, revenue, services interest, and pain point. Have the right discovery questions ready.",
      priority: "MEDIUM",
      dueInHours: 1,
      dedupeKey: "Pre-consult prep",
    },
  ],
  CONSULT_COMPLETED: [
    {
      taskType: "REVIEW",
      title: "Draft proposal",
      description: "Turn the discovery into a proposal in Anchor. Aim to send within 48h.",
      priority: "HIGH",
      dueInHours: 24,
      dedupeKey: "Draft proposal",
    },
  ],
  PROPOSAL_SENT: [
    {
      taskType: "CALL",
      title: "Follow up on proposal",
      description:
        "Call or email — confirm they received it, answer questions, nudge toward signature.",
      priority: "HIGH",
      dueInHours: 48,
      dedupeKey: "Follow up on proposal",
    },
    {
      taskType: "EMAIL",
      title: "Second follow-up on proposal",
      description: "If no reply to the first nudge, send a value-add email (case study, testimonial).",
      priority: "MEDIUM",
      dueInHours: 120,
      dedupeKey: "Second follow-up on proposal",
    },
  ],
  FOLLOW_UP_NEGOTIATION: [
    {
      taskType: "CALL",
      title: "Close the deal — negotiation call",
      description: "Jump on a call to address remaining objections and land the signature.",
      priority: "URGENT",
      dueInHours: 24,
      dedupeKey: "Close the deal",
    },
  ],
  WON: [
    {
      taskType: "INTERNAL",
      title: "Kick off onboarding — collect EIN + prior-year returns",
      description:
        "Client won. Collect EIN, prior-year tax returns, QuickBooks access. Schedule kickoff call.",
      priority: "HIGH",
      dueInHours: 24,
      dedupeKey: "Kick off onboarding",
    },
    {
      taskType: "INTERNAL",
      title: "Send welcome email + onboarding checklist",
      description: "Send the won-client welcome email with intake checklist attached.",
      priority: "HIGH",
      dueInHours: 4,
      dedupeKey: "Send welcome email",
    },
  ],
};

export async function ensureStageTasks(params: {
  leadId: string;
  toStage: PipelineStage;
  actorUserId?: string | null;
}): Promise<{ created: number; skipped: number }> {
  const rules = STAGE_TASK_RULES[params.toStage];
  if (!rules || rules.length === 0) return { created: 0, skipped: 0 };

  const lead = await prisma.lead.findUnique({
    where: { id: params.leadId },
    select: { ownerUserId: true },
  });

  let created = 0;
  let skipped = 0;

  for (const rule of rules) {
    // Skip if an open task matching the dedupe key already exists — prevents
    // duplicates when the user yo-yos through stages during testing.
    const existing = await prisma.task.findFirst({
      where: {
        leadId: params.leadId,
        status: { in: ["OPEN", "IN_PROGRESS", "OVERDUE"] },
        title: { contains: rule.dedupeKey, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (existing) {
      skipped++;
      continue;
    }

    await prisma.task.create({
      data: {
        leadId: params.leadId,
        // Assign to the lead owner if set, else the actor who made the change.
        // If neither is available, the task is unassigned and surfaces in
        // the "Unassigned" dashboard widget.
        assignedUserId: lead?.ownerUserId ?? params.actorUserId ?? null,
        taskType: rule.taskType,
        title: rule.title,
        description: rule.description,
        priority: rule.priority,
        // Use business-hours math so "due in 48h" lands Monday morning, not
        // Saturday night. Urgent tasks (<=1h) stay raw so same-day work still
        // fires immediately.
        dueAt:
          rule.dueInHours <= 1
            ? new Date(Date.now() + rule.dueInHours * 3_600_000)
            : addBusinessHours(new Date(), rule.dueInHours),
      },
    });
    await prisma.pipelineEvent.create({
      data: {
        leadId: params.leadId,
        actorUserId: params.actorUserId ?? null,
        eventType: "TASK_CREATED",
        note: `Auto-created on stage → ${params.toStage}: ${rule.title}`,
      },
    });
    created++;
  }

  return { created, skipped };
}
