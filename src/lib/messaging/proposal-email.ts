import "server-only";
import { sendEmail } from "@/lib/integrations/email";
import { config } from "@/lib/config";

/**
 * Proposal-sent email — fired after a successful Anchor push. Contains a
 * short note from the rep + a prominent "Review & Sign" button that links to
 * the Anchor-hosted signing URL.
 *
 * Keeping this CRM-owned (rather than letting Anchor email directly) means
 * the client's first touch looks like FABBI, not a generic Anchor template.
 */

export type ProposalEmailInput = {
  to: string;
  clientFirstName: string | null;
  companyName: string | null;
  monthlyTotal: number;
  onetimeTotal: number;
  scopeSummary: string | null;
  signingUrl: string;
  sender: {
    name: string | null;
    email: string | null;
  };
};

export async function sendProposalEmail(input: ProposalEmailInput) {
  const firstName = input.clientFirstName || "there";
  const firm = config.firmName || "FABBI";
  const senderName = input.sender.name || firm;

  const subject = `Your ${firm} proposal is ready`;

  const bodyText = [
    `Hi ${firstName},`,
    "",
    `Thanks for the conversation — here's the proposal we put together${input.companyName ? ` for ${input.companyName}` : ""}.`,
    "",
    ...(input.scopeSummary ? [`Scope: ${input.scopeSummary}`, ""] : []),
    `Monthly services: $${input.monthlyTotal.toLocaleString()}/mo`,
    ...(input.onetimeTotal > 0 ? [`One-time (catch-up + tax): $${input.onetimeTotal.toLocaleString()}`] : []),
    "",
    `You can review the full proposal and sign here:`,
    input.signingUrl,
    "",
    `The pricing holds for 30 days. If anything looks off or you want to tweak the scope, just reply.`,
    "",
    `Thanks,`,
    `${senderName}`,
    firm,
  ].join("\n");

  const bodyHtml = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#0f172a;">
    <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
      <div style="font-size:11px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:#758696;">
        ${firm}
      </div>
      <h1 style="font-size:22px;line-height:1.3;margin:8px 0 20px;color:#07183a;">
        Your proposal is ready${input.clientFirstName ? `, ${input.clientFirstName}` : ""}.
      </h1>
      <p style="font-size:15px;line-height:1.55;margin:0 0 20px;">
        Thanks for the conversation — here's the proposal we put together${input.companyName ? ` for <strong>${input.companyName}</strong>` : ""}.
      </p>

      <div style="border:1px solid #e5ecf5;border-radius:8px;padding:16px;margin:0 0 24px;background:#fff;">
        ${input.scopeSummary ? `<div style="font-size:13px;color:#3f4956;margin-bottom:12px;">${input.scopeSummary}</div>` : ""}
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.14em;color:#758696;margin-bottom:6px;">Monthly</div>
        <div style="font-size:22px;font-weight:600;color:#07183a;">$${input.monthlyTotal.toLocaleString()}<span style="font-size:14px;font-weight:400;color:#758696;"> /mo</span></div>
        ${
          input.onetimeTotal > 0
            ? `<div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.14em;color:#758696;margin:14px 0 6px;">One-time</div>
               <div style="font-size:16px;font-weight:600;color:#07183a;">$${input.onetimeTotal.toLocaleString()}</div>`
            : ""
        }
      </div>

      <p style="margin:0 0 8px;font-size:15px;">Review the full proposal and sign below:</p>
      <p style="margin:0 0 24px;">
        <a href="${input.signingUrl}" style="display:inline-block;padding:12px 22px;background:#005bf7;color:#fff;text-decoration:none;border-radius:6px;font-size:15px;font-weight:600;box-shadow:0 1px 2px 0 rgba(7,24,58,0.12);">
          Review & sign →
        </a>
      </p>

      <p style="font-size:13px;line-height:1.55;color:#3f4956;margin:24px 0 0;">
        This pricing holds for 30 days. If anything looks off or you'd like to tweak the scope, just reply to this email.
      </p>

      <p style="font-size:14px;line-height:1.55;color:#3f4956;margin:24px 0 0;">
        Thanks,<br/>
        ${senderName}<br/>
        <span style="color:#758696;">${firm}</span>
      </p>
    </div>
  </body>
</html>`;

  return sendEmail({
    to: input.to,
    subject,
    bodyText,
    bodyHtml,
    replyTo: input.sender.email ?? undefined,
  });
}
