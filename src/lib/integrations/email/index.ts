import "server-only";
import { sendEmailViaM365, type EmailSendResult as M365Result } from "./m365";
import { sendEmailViaResend, type EmailSendResult as ResendResult } from "./resend";

export type EmailSendResult = M365Result | ResendResult;

export type SendEmailParams = {
  to: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  replyTo?: string;
};

const hasGraph = Boolean(
  process.env.MS_GRAPH_TENANT_ID &&
    process.env.MS_GRAPH_CLIENT_ID &&
    process.env.MS_GRAPH_CLIENT_SECRET &&
    process.env.MS_GRAPH_SENDER_MAILBOX
);
const hasResend = Boolean(process.env.RESEND_API_KEY);

/**
 * Pick whichever email provider is configured.
 *
 * Resend is the simpler setup (DNS records + one API key) and is preferred
 * when both are configured because it avoids the Azure AD + Exchange
 * application access policy dance. Set MS Graph creds and *unset* RESEND_API_KEY
 * to force Graph — e.g. if you need sent messages to appear in Outlook's
 * Sent Items folder.
 */
export async function sendEmail(params: SendEmailParams): Promise<EmailSendResult> {
  if (hasResend) return sendEmailViaResend(params);
  if (hasGraph) return sendEmailViaM365(params);
  throw new Error(
    "No email provider configured. Set RESEND_API_KEY (easy) or MS_GRAPH_* (advanced)."
  );
}

export function emailProviderName(): "resend" | "m365" | "none" {
  if (hasResend) return "resend";
  if (hasGraph) return "m365";
  return "none";
}
