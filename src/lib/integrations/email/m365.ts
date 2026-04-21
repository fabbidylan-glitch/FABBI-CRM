import "server-only";

// Microsoft Graph client-credentials flow sending mail as a single fixed mailbox.
//
// Azure AD setup (see README):
//   1. Register a new app in Azure Portal → App registrations.
//   2. Add API permission: Microsoft Graph → Application → Mail.Send.
//   3. Grant admin consent.
//   4. Create a client secret.
//   5. Run New-ApplicationAccessPolicy in Exchange Online PowerShell so the
//      app can *only* send from MS_GRAPH_SENDER_MAILBOX (least privilege).

type TokenCache = { accessToken: string; expiresAt: number };
let tokenCache: TokenCache | null = null;

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 60_000) return tokenCache.accessToken;

  const tenantId = requireEnv("MS_GRAPH_TENANT_ID");
  const clientId = requireEnv("MS_GRAPH_CLIENT_ID");
  const clientSecret = requireEnv("MS_GRAPH_CLIENT_SECRET");

  const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`MS Graph token exchange failed (${res.status}): ${detail}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = {
    accessToken: json.access_token,
    expiresAt: now + json.expires_in * 1000,
  };
  return json.access_token;
}

export type EmailSendResult = {
  provider: "m365";
  externalMessageId: string | null;
  sentAt: Date;
};

export async function sendEmailViaM365(params: {
  to: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  replyTo?: string;
}): Promise<EmailSendResult> {
  const mailbox = requireEnv("MS_GRAPH_SENDER_MAILBOX");
  const replyTo = params.replyTo ?? process.env.MS_GRAPH_REPLY_TO ?? mailbox;
  const token = await getAccessToken();

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/sendMail`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          subject: params.subject,
          body: {
            contentType: params.bodyHtml ? "HTML" : "Text",
            content: params.bodyHtml ?? params.bodyText,
          },
          toRecipients: [{ emailAddress: { address: params.to } }],
          replyTo: replyTo ? [{ emailAddress: { address: replyTo } }] : undefined,
        },
        saveToSentItems: true,
      }),
    }
  );

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`MS Graph sendMail failed (${res.status}): ${detail}`);
  }

  // Graph's sendMail returns 202 Accepted with no body and no message id.
  // To get a message id we would have to use /createMessage + /send, or poll
  // Sent Items. For now we record the send timestamp as the external ref.
  return { provider: "m365", externalMessageId: null, sentAt: new Date() };
}

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env var: ${key}`);
  return v;
}
