/**
 * Sequence definitions.
 *
 * Each sequence is a list of timed steps. `minutesAfterEnroll` is the delay
 * from when the lead was enrolled; step 0 with 0 minutes runs immediately
 * inline at enrollment time, everything else is picked up by the cron.
 *
 * Keeping these in code (rather than a `Sequence` DB table) for the first
 * iteration — once the Admin UI lands these move to the database so non-devs
 * can edit cadences without a deploy.
 */

export type SequenceStep =
  | {
      type: "SEND_EMAIL";
      minutesAfterEnroll: number;
      templateKey: string;
      note?: string;
    }
  | {
      type: "SEND_WHATSAPP";
      minutesAfterEnroll: number;
      templateKey: string;
      whatsappTemplateName?: string;
      note?: string;
    }
  | {
      type: "SEND_SMS";
      minutesAfterEnroll: number;
      templateKey: string;
      note?: string;
    }
  | {
      type: "CREATE_TASK";
      minutesAfterEnroll: number;
      taskType: "CALL" | "EMAIL" | "SMS" | "WHATSAPP" | "MEETING" | "REVIEW" | "INTERNAL" | "OTHER";
      title: string;
      priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
      note?: string;
    }
  | {
      type: "EXIT";
      minutesAfterEnroll: number;
      reason?: string;
    };

export type SequenceDefinition = {
  key: string;
  name: string;
  description?: string;
  steps: SequenceStep[];
};

/**
 * Fires when a qualified or manual-review lead is created.
 * Cadence is aligned with Claude.md §8 "Sequence 1 — New Lead A/B Fit".
 */
const newLeadQualified: SequenceDefinition = {
  key: "new_lead_qualified_v1",
  name: "New qualified lead — first 96 hours",
  description:
    "Instant confirmation, schedule prompt, multi-touch follow-up, then exit to Cold Nurture.",
  steps: [
    { type: "SEND_EMAIL", minutesAfterEnroll: 0, templateKey: "inquiry.confirmation.email" },
    {
      type: "CREATE_TASK",
      minutesAfterEnroll: 5,
      taskType: "CALL",
      title: "First-touch call — new qualified lead",
      priority: "HIGH",
      note: "A-lead SLA: under 5 minutes from submission.",
    },
    {
      type: "SEND_EMAIL",
      minutesAfterEnroll: 18 * 60,
      templateKey: "qualified.schedule.email",
    },
    {
      type: "SEND_WHATSAPP",
      minutesAfterEnroll: 36 * 60,
      // TODO: after creating + getting a Meta-approved template, set:
      //   templateKey:          a WhatsApp-channel MessageTemplate row
      //   whatsappTemplateName: the exact template name approved in Meta Business Manager
      // Until both are set, this step is SKIPped at runtime.
      templateKey: "qualified.schedule.wa",
      whatsappTemplateName: undefined,
    },
    {
      type: "SEND_EMAIL",
      minutesAfterEnroll: 54 * 60,
      templateKey: "qualified.schedule.email",
    },
    {
      type: "CREATE_TASK",
      minutesAfterEnroll: 72 * 60,
      taskType: "CALL",
      title: "Call #2 — still no response",
      priority: "MEDIUM",
    },
    {
      type: "SEND_EMAIL",
      minutesAfterEnroll: 96 * 60,
      templateKey: "proposal.breakup.d5.email",
    },
    { type: "EXIT", minutesAfterEnroll: 96 * 60 + 1, reason: "COMPLETED" },
  ],
};

/** Fires when a consult is booked via Calendly. */
const consultReminder: SequenceDefinition = {
  key: "consult_reminder_v1",
  name: "Consult reminders",
  description: "Confirmation + 24h and 2h reminders.",
  steps: [
    {
      type: "SEND_EMAIL",
      minutesAfterEnroll: 0,
      templateKey: "consult.reminder.24h.email",
      note: "Booking confirmation email (uses 24h template for now).",
    },
    {
      type: "SEND_EMAIL",
      minutesAfterEnroll: 24 * 60,
      templateKey: "consult.reminder.24h.email",
    },
    {
      type: "CREATE_TASK",
      minutesAfterEnroll: 24 * 60 + 120,
      taskType: "CALL",
      title: "2-hour pre-consult reminder call (optional)",
      priority: "LOW",
    },
  ],
};

/** Fires when a proposal moves to SENT. */
const proposalFollowup: SequenceDefinition = {
  key: "proposal_followup_v1",
  name: "Proposal follow-up",
  description: "Multi-touch sequence after Ignition proposal is sent.",
  steps: [
    { type: "SEND_EMAIL", minutesAfterEnroll: 18 * 60, templateKey: "proposal.followup.d1.email" },
    // WhatsApp step is SKIPped until a Meta-approved template is wired in.
    // See comment above on `new_lead_qualified_v1` for setup steps.
    {
      type: "SEND_WHATSAPP",
      minutesAfterEnroll: 36 * 60,
      templateKey: "proposal.followup.d1.wa",
      whatsappTemplateName: undefined,
    },
    { type: "SEND_EMAIL", minutesAfterEnroll: 54 * 60, templateKey: "proposal.followup.d1.email" },
    {
      type: "CREATE_TASK",
      minutesAfterEnroll: 72 * 60,
      taskType: "CALL",
      title: "Proposal follow-up call",
      priority: "HIGH",
    },
    { type: "SEND_EMAIL", minutesAfterEnroll: 96 * 60, templateKey: "proposal.breakup.d5.email" },
    { type: "EXIT", minutesAfterEnroll: 96 * 60 + 1, reason: "COMPLETED" },
  ],
};

/** Fires when a consult was booked but the lead didn't show up. */
const consultNoShow: SequenceDefinition = {
  key: "consult_no_show_v1",
  name: "Consult no-show rebooking",
  description: "Light-touch rebooking sequence after a no-show. Exits if they reply or reschedule.",
  steps: [
    // Instant nudge while the missed meeting is fresh in their mind.
    {
      type: "SEND_EMAIL",
      minutesAfterEnroll: 0,
      templateKey: "consult.no_show.rebook.email",
    },
    {
      type: "SEND_SMS",
      minutesAfterEnroll: 5,
      templateKey: "consult.no_show.rebook.sms",
    },
    // Day-1 follow-up if they haven't rebooked yet.
    {
      type: "SEND_EMAIL",
      minutesAfterEnroll: 24 * 60,
      templateKey: "consult.no_show.rebook.email",
    },
    // Day-3 task for the owner to personally call.
    {
      type: "CREATE_TASK",
      minutesAfterEnroll: 72 * 60,
      taskType: "CALL",
      title: "Call — missed consult, try to rebook",
      priority: "MEDIUM",
    },
    // Day-6 final email, then exit.
    {
      type: "SEND_EMAIL",
      minutesAfterEnroll: 144 * 60,
      templateKey: "proposal.breakup.d5.email",
    },
    { type: "EXIT", minutesAfterEnroll: 144 * 60 + 1, reason: "COMPLETED" },
  ],
};

export const SEQUENCES: Record<string, SequenceDefinition> = {
  [newLeadQualified.key]: newLeadQualified,
  [consultReminder.key]: consultReminder,
  [proposalFollowup.key]: proposalFollowup,
  [consultNoShow.key]: consultNoShow,
};

export function getSequence(key: string): SequenceDefinition | undefined {
  return SEQUENCES[key];
}
