import "server-only";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/integrations/email";
import { sendSmsViaTelnyx } from "@/lib/integrations/sms/telnyx";
import { sendWhatsAppTemplate, sendWhatsAppText } from "@/lib/integrations/whatsapp/meta";
import { renderTemplate, textToHtml } from "@/lib/messaging/render";
import type {
  CommunicationChannel,
  DeliveryStatus,
  Lead,
  MessageTemplate,
  User,
} from "@prisma/client";

export class MessagingError extends Error {
  constructor(
    message: string,
    public readonly code: "NOT_CONFIGURED" | "MISSING_CONTACT" | "PROVIDER_ERROR" | "BAD_TEMPLATE"
  ) {
    super(message);
  }
}

export type SendInput = {
  leadId: string;
  templateKey: string;
  channel: CommunicationChannel;
  actorUserId?: string | null;
  // Additional variables to merge into the template context
  extraVars?: Record<string, string>;
  // For WhatsApp outside the 24h window, supply a pre-approved template name
  whatsappTemplateName?: string;
  whatsappLanguageCode?: string;
};

export type SendOutput = {
  communicationId: string;
  externalMessageId: string | null;
  deliveryStatus: DeliveryStatus;
};

/**
 * Render a template and dispatch it via the configured adapter, then log the
 * Communication row + timeline event in a single transaction.
 */
export async function sendMessage(input: SendInput): Promise<SendOutput> {
  const lead = await prisma.lead.findUnique({ where: { id: input.leadId } });
  if (!lead) throw new MessagingError(`Lead ${input.leadId} not found`, "BAD_TEMPLATE");

  const template = await prisma.messageTemplate.findUnique({ where: { key: input.templateKey } });
  if (!template) throw new MessagingError(`Template ${input.templateKey} not found`, "BAD_TEMPLATE");
  if (template.channel !== input.channel)
    throw new MessagingError(
      `Template ${input.templateKey} is for ${template.channel}, not ${input.channel}`,
      "BAD_TEMPLATE"
    );

  const actor = input.actorUserId
    ? await prisma.user.findUnique({ where: { id: input.actorUserId } })
    : null;

  const vars = buildVars(lead, actor, input.extraVars);
  const subject = template.subject ? renderTemplate(template.subject, vars) : null;
  const bodyText = renderTemplate(template.bodyText, vars);

  // Pre-send Communication row in QUEUED state so we always have a record even
  // if the provider call throws.
  const comm = await prisma.communication.create({
    data: {
      leadId: lead.id,
      channel: input.channel,
      direction: "OUTBOUND",
      templateKey: template.key,
      subject,
      bodyText,
      deliveryStatus: "QUEUED",
    },
  });

  try {
    let externalId: string | null = null;

    if (input.channel === "EMAIL") {
      if (!config.emailEnabled)
        throw new MessagingError("Email is not configured", "NOT_CONFIGURED");
      if (!lead.email) throw new MessagingError("Lead has no email address", "MISSING_CONTACT");
      const res = await sendEmail({
        to: lead.email,
        subject: subject ?? "(no subject)",
        bodyText,
        bodyHtml: textToHtml(bodyText),
      });
      externalId = res.externalMessageId;
    } else if (input.channel === "WHATSAPP") {
      if (!config.whatsappEnabled)
        throw new MessagingError("WhatsApp Cloud API is not configured", "NOT_CONFIGURED");
      const to = lead.phoneE164;
      if (!to) throw new MessagingError("Lead has no E.164 phone number", "MISSING_CONTACT");

      const res = input.whatsappTemplateName
        ? await sendWhatsAppTemplate({
            toE164: to,
            templateName: input.whatsappTemplateName,
            languageCode: input.whatsappLanguageCode ?? "en_US",
            variables: input.extraVars
              ? Object.values(input.extraVars).map(String)
              : [vars.first_name ?? ""],
          })
        : await sendWhatsAppText({ toE164: to, body: bodyText });
      externalId = res.externalMessageId;
    } else if (input.channel === "SMS") {
      if (!config.smsEnabled)
        throw new MessagingError("SMS (Telnyx) is not configured", "NOT_CONFIGURED");
      const to = lead.phoneE164;
      if (!to) throw new MessagingError("Lead has no E.164 phone number", "MISSING_CONTACT");
      const res = await sendSmsViaTelnyx({ toE164: to, body: bodyText });
      externalId = res.externalMessageId;
    } else {
      throw new MessagingError(`Channel ${input.channel} not yet supported`, "NOT_CONFIGURED");
    }

    const updated = await prisma.communication.update({
      where: { id: comm.id },
      data: {
        externalMessageId: externalId,
        deliveryStatus: "SENT",
        sentAt: new Date(),
      },
    });

    await prisma.$transaction([
      prisma.lead.update({
        where: { id: lead.id },
        data: { lastContactedAt: new Date() },
      }),
      prisma.pipelineEvent.create({
        data: {
          leadId: lead.id,
          actorUserId: input.actorUserId ?? null,
          eventType: "COMMUNICATION_SENT",
          note: `Sent ${input.channel.toLowerCase()} via "${template.name}"`,
        },
      }),
    ]);

    return {
      communicationId: updated.id,
      externalMessageId: updated.externalMessageId,
      deliveryStatus: updated.deliveryStatus,
    };
  } catch (err) {
    await prisma.communication.update({
      where: { id: comm.id },
      data: {
        deliveryStatus: "FAILED",
        failedAt: new Date(),
        metadataJson: { error: err instanceof Error ? err.message : String(err) },
      },
    });
    throw err;
  }
}

function buildVars(
  lead: Lead,
  actor: User | null,
  extras: Record<string, string> | undefined
): Record<string, string> {
  return {
    first_name: lead.firstName ?? "",
    last_name: lead.lastName ?? "",
    full_name: [lead.firstName, lead.lastName].filter(Boolean).join(" "),
    email: lead.email ?? "",
    company: lead.companyName ?? "",
    service_interest: prettyEnum(lead.serviceInterest),
    niche: prettyEnum(lead.niche),
    owner_name: actor ? `${actor.firstName} ${actor.lastName}` : config.firmName,
    firm_name: config.firmName,
    booking_link: process.env.CALENDLY_DEFAULT_EVENT_URL ?? "",
    proposal_link: "",
    pain_point_summary: lead.painPoint ?? "",
    ...extras,
  };
}

function prettyEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// Type helper so TS doesn't complain about the template param being unused at module scope.
export type _Template = MessageTemplate;
