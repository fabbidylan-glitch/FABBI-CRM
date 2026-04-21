import "server-only";

// Telnyx Messaging API sender.
//
// Telnyx setup (see README):
//   1. Sign up at https://portal.telnyx.com (requires ID verification for US long-code)
//   2. Number search → buy a local or toll-free long-code number
//   3. Messaging → create a Messaging Profile, assign the number
//   4. API Keys → create a V2 key, copy into TELNYX_API_KEY
//   5. Webhook → point at /api/public/telnyx/webhook for inbound + delivery receipts

export type SmsSendResult = {
  provider: "telnyx";
  externalMessageId: string | null;
  sentAt: Date;
};

export async function sendSmsViaTelnyx(params: {
  toE164: string;
  body: string;
}): Promise<SmsSendResult> {
  const apiKey = requireEnv("TELNYX_API_KEY");
  const from = process.env.TELNYX_SMS_FROM || null;
  const profileId = process.env.TELNYX_MESSAGING_PROFILE_ID || null;

  if (!from && !profileId) {
    throw new Error(
      "Either TELNYX_SMS_FROM or TELNYX_MESSAGING_PROFILE_ID must be set to send SMS"
    );
  }

  const body: Record<string, unknown> = {
    to: params.toE164,
    text: params.body,
  };
  if (from) body.from = from;
  if (profileId) body.messaging_profile_id = profileId;

  const res = await fetch("https://api.telnyx.com/v2/messages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Telnyx send failed (${res.status}): ${detail}`);
  }

  const json = (await res.json()) as { data?: { id?: string } };
  return {
    provider: "telnyx",
    externalMessageId: json.data?.id ?? null,
    sentAt: new Date(),
  };
}

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env var: ${key}`);
  return v;
}
