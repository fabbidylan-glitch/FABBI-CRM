import "server-only";

// Resend email adapter.
//
// Setup (see README):
//   1. Sign up at https://resend.com
//   2. Domains → Add Domain → "fabbi.co"
//   3. Add the 3 DNS records (SPF, DKIM, MX for bounces) to your DNS provider
//   4. Wait for verification (usually < 5 min)
//   5. API Keys → create one → paste into RESEND_API_KEY
//   6. Set MAIL_FROM to "Dylan from FABBI <dylan@fabbi.co>" (or similar)
//
// Outbound emails will hit inboxes with From: dylan@fabbi.co. Replies go to
// dylan@fabbi.co (or MAIL_REPLY_TO if set) and land in Outlook normally.

export type EmailSendResult = {
  provider: "resend";
  externalMessageId: string | null;
  sentAt: Date;
};

export async function sendEmailViaResend(params: {
  to: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  replyTo?: string;
}): Promise<EmailSendResult> {
  const apiKey = requireEnv("RESEND_API_KEY");
  const from = process.env.MAIL_FROM ?? "FABBI <hello@fabbi.co>";
  const replyTo = params.replyTo ?? process.env.MAIL_REPLY_TO ?? undefined;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [params.to],
      subject: params.subject,
      text: params.bodyText,
      html: params.bodyHtml,
      reply_to: replyTo,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Resend send failed (${res.status}): ${detail}`);
  }
  const json = (await res.json()) as { id?: string };
  return {
    provider: "resend",
    externalMessageId: json.id ?? null,
    sentAt: new Date(),
  };
}

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env var: ${key}`);
  return v;
}
