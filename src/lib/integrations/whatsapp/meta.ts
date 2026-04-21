import "server-only";

// Meta WhatsApp Cloud API sender.
//
// Meta Business setup (see README):
//   1. Create a Meta Developer app with the "WhatsApp" product.
//   2. Link a WhatsApp Business Account + phone number.
//   3. Generate a permanent system-user access token.
//   4. Configure the webhook URL to POST /api/public/whatsapp/webhook and set
//      META_WA_VERIFY_TOKEN to the same value you put in Meta's dashboard.

const DEFAULT_VERSION = "v20.0";

export type WhatsAppSendResult = {
  provider: "meta-whatsapp";
  externalMessageId: string | null;
  sentAt: Date;
};

/**
 * Send a free-form text message. Only works within the 24-hour "customer
 * service window" — i.e. after the lead has replied to us. For cold outbound
 * you must use a pre-approved template via `sendTemplate`.
 */
export async function sendWhatsAppText(params: {
  toE164: string;
  body: string;
}): Promise<WhatsAppSendResult> {
  return sendGraph({
    messaging_product: "whatsapp",
    to: stripPlus(params.toE164),
    type: "text",
    text: { preview_url: true, body: params.body },
  });
}

/**
 * Send a pre-approved template message. Required for the first outbound to a
 * lead who hasn't messaged us first. Template names + language must match what
 * was approved in the Meta Business Manager.
 */
export async function sendWhatsAppTemplate(params: {
  toE164: string;
  templateName: string;
  languageCode: string;
  variables?: string[];
}): Promise<WhatsAppSendResult> {
  const components = params.variables?.length
    ? [
        {
          type: "body",
          parameters: params.variables.map((v) => ({ type: "text", text: v })),
        },
      ]
    : undefined;

  return sendGraph({
    messaging_product: "whatsapp",
    to: stripPlus(params.toE164),
    type: "template",
    template: {
      name: params.templateName,
      language: { code: params.languageCode },
      components,
    },
  });
}

async function sendGraph(body: unknown): Promise<WhatsAppSendResult> {
  const phoneNumberId = requireEnv("META_WA_PHONE_NUMBER_ID");
  const token = requireEnv("META_WA_ACCESS_TOKEN");
  const version = process.env.META_WA_GRAPH_VERSION ?? DEFAULT_VERSION;

  const res = await fetch(
    `https://graph.facebook.com/${version}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Meta WhatsApp send failed (${res.status}): ${detail}`);
  }

  const json = (await res.json()) as { messages?: Array<{ id: string }> };
  return {
    provider: "meta-whatsapp",
    externalMessageId: json.messages?.[0]?.id ?? null,
    sentAt: new Date(),
  };
}

function stripPlus(e164: string): string {
  return e164.replace(/^\+/, "");
}

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env var: ${key}`);
  return v;
}
