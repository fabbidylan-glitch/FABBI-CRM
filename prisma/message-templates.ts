/**
 * Single source of truth for MessageTemplate rows.
 *
 * Two callers import this:
 *   1. prisma/seed.ts — full dev seed, via syncMessageTemplates()
 *   2. prisma/sync-templates.ts — production-safe standalone runner that
 *      ONLY touches message templates (no Leads, Users, etc. — unlike the
 *      full seed which is unsafe to run against prod data)
 *
 * Any edit to a template body/subject/variables belongs here. The sync
 * function is idempotent (upsert by key), additive, and never deletes
 * templates — a template removed from the array will remain in the DB
 * until manually deleted, which is intentional so we don't accidentally
 * break in-flight sequences or historical comms.
 */

import { CommunicationChannel, type PrismaClient } from "@prisma/client";

export type MessageTemplateSeed = {
  key: string;
  name: string;
  channel: CommunicationChannel;
  category: string;
  subject: string | null;
  bodyText: string;
  variables: string[];
};

export const MESSAGE_TEMPLATES: MessageTemplateSeed[] = [
  {
    key: "inquiry.confirmation.email",
    name: "Inquiry received — confirmation",
    channel: CommunicationChannel.EMAIL,
    category: "inquiry_confirmation",
    subject: "We got your request — here's what happens next",
    bodyText:
      "Hi {{first_name}},\n\n" +
      "{{selected_services}}" +
      "Thanks for reaching out to FABBI. Here's what happens next:\n\n" +
      "  • We're reviewing your setup now\n" +
      "  • We'll identify tax savings opportunities\n" +
      "  • You'll hear from us shortly\n\n" +
      "{{booking_link}}\n\n" +
      "Talk soon,\n{{owner_name}}\nFABBI",
    variables: ["first_name", "selected_services", "booking_link", "owner_name"],
  },
  {
    key: "qualified.schedule.email",
    name: "Qualified — schedule consult",
    channel: CommunicationChannel.EMAIL,
    category: "schedule_consult",
    subject: "Let's find a time, {{first_name}}",
    bodyText:
      "Hi {{first_name}},\n\nBased on what you shared, I think we can help. " +
      "Grab a time that works here: {{booking_link}}.\n\nTalk soon,\n{{owner_name}}",
    variables: ["first_name", "booking_link", "owner_name"],
  },
  {
    key: "qualified.schedule.sms",
    name: "Qualified — schedule consult (SMS)",
    channel: CommunicationChannel.SMS,
    category: "schedule_consult",
    subject: null,
    bodyText:
      "Hi {{first_name}}, {{owner_name}} from FABBI. Book a consult here: {{booking_link}} — " +
      "reply STOP to opt out.",
    variables: ["first_name", "owner_name", "booking_link"],
  },
  {
    key: "consult.reminder.24h.email",
    name: "Consult reminder — 24h",
    channel: CommunicationChannel.EMAIL,
    category: "consult_reminder",
    subject: "Reminder: our call tomorrow",
    bodyText: "Hi {{first_name}}, looking forward to our conversation tomorrow. — {{owner_name}}",
    variables: ["first_name", "owner_name"],
  },
  {
    key: "proposal.followup.d1.email",
    name: "Proposal follow-up — day 1",
    channel: CommunicationChannel.EMAIL,
    category: "proposal_followup",
    subject: "Following up on your proposal",
    bodyText:
      "Hi {{first_name}}, wanted to make sure the proposal I sent arrived OK: {{proposal_link}}. " +
      "Happy to jump on a quick call to walk through it. — {{owner_name}}",
    variables: ["first_name", "proposal_link", "owner_name"],
  },
  {
    key: "proposal.breakup.d5.email",
    name: "Proposal breakup — final",
    channel: CommunicationChannel.EMAIL,
    category: "breakup",
    subject: "Closing the loop",
    bodyText:
      "Hi {{first_name}}, I haven't heard back so I'll close out your file for now. " +
      "If the timing changes, just reply and we'll pick it back up. — {{owner_name}}",
    variables: ["first_name", "owner_name"],
  },
  {
    key: "won.welcome.email",
    name: "Won — welcome + onboarding",
    channel: CommunicationChannel.EMAIL,
    category: "welcome_onboarding",
    subject: "Welcome to FABBI, {{first_name}}",
    bodyText:
      "Welcome aboard, {{first_name}}. Your onboarding checklist is attached. " +
      "Your dedicated contact at {{firm_name}} is {{owner_name}}.",
    variables: ["first_name", "owner_name", "firm_name"],
  },
  {
    key: "consult.no_show.rebook.email",
    name: "Consult no-show — rebook nudge",
    channel: CommunicationChannel.EMAIL,
    category: "no_show_rebook",
    subject: "Sorry we missed you, {{first_name}}",
    bodyText:
      "Hi {{first_name}},\n\nLooks like our call today didn't happen on your end — totally fine, life happens. " +
      "Grab a new time whenever works for you: {{booking_link}}\n\nIf it's easier, reply here with a few windows and I'll send an invite.\n\n— {{owner_name}}",
    variables: ["first_name", "booking_link", "owner_name"],
  },
  {
    key: "consult.no_show.rebook.sms",
    name: "Consult no-show — rebook (SMS)",
    channel: CommunicationChannel.SMS,
    category: "no_show_rebook",
    subject: null,
    bodyText:
      "Hi {{first_name}}, {{owner_name}} from FABBI. Missed you on today's call — rebook a time here: {{booking_link}}. Reply STOP to opt out.",
    variables: ["first_name", "owner_name", "booking_link"],
  },
  {
    key: "consult.thankyou.email",
    name: "Consult completed — thank you",
    channel: CommunicationChannel.EMAIL,
    category: "consult_thankyou",
    subject: "Thanks for the conversation, {{first_name}}",
    bodyText:
      "Hi {{first_name}},\n\nThanks for spending the time with us today — great learning about {{service_interest}} on your side. " +
      "I'll pull a tailored proposal together and send it over shortly. " +
      "If anything else comes to mind in the meantime, just reply here.\n\n— {{owner_name}}, FABBI",
    variables: ["first_name", "service_interest", "owner_name"],
  },
];

export type SyncResult = {
  created: number;
  updated: number;
  total: number;
};

/**
 * Upsert every template by its stable `key`. Safe to run repeatedly and
 * safe to run against prod — does NOT touch Leads, Users, RuleConfigs, or
 * any other table. Returns counts for logging.
 */
export async function syncMessageTemplates(
  prisma: PrismaClient
): Promise<SyncResult> {
  let created = 0;
  let updated = 0;

  for (const t of MESSAGE_TEMPLATES) {
    const existing = await prisma.messageTemplate.findUnique({
      where: { key: t.key },
      select: { id: true },
    });

    await prisma.messageTemplate.upsert({
      where: { key: t.key },
      update: {
        name: t.name,
        channel: t.channel,
        category: t.category,
        subject: t.subject ?? null,
        bodyText: t.bodyText,
        variables: t.variables,
      },
      create: {
        key: t.key,
        name: t.name,
        channel: t.channel,
        category: t.category,
        subject: t.subject ?? null,
        bodyText: t.bodyText,
        variables: t.variables,
      },
    });

    if (existing) updated += 1;
    else created += 1;
  }

  return { created, updated, total: MESSAGE_TEMPLATES.length };
}
