import "server-only";
import { sendEmail } from "@/lib/integrations/email";
import { config } from "@/lib/config";

/**
 * Client welcome email — fired automatically when a proposal is accepted and
 * an Onboarding row is created. Branded as FABBI, kept short, with two things
 * the client needs most: what happens next, and where to reach us.
 *
 * Design principles:
 *   - Plain-text safe (HTML is a nicety, not required)
 *   - No tracking pixels or tricks; this is an internal business email
 *   - Links are optional — if no portal URL is configured, we just reference
 *     "your onboarding manager will reach out"
 */

export type WelcomeEmailInput = {
  to: string;
  clientFirstName: string | null;
  companyName: string | null;
  monthlyFee: number | null;
  catchupFee: number | null;
  taxFee: number | null;
  templateKey: string | null;
  onboardingManagerName: string | null;
  onboardingManagerEmail: string | null;
  /** Optional — link to the onboarding detail page / client portal. */
  portalUrl?: string;
};

export async function sendClientWelcomeEmail(input: WelcomeEmailInput) {
  const firstName = input.clientFirstName || "there";
  const firm = config.firmName || "FABBI";

  const managerLine = input.onboardingManagerName
    ? `${input.onboardingManagerName}${input.onboardingManagerEmail ? ` (${input.onboardingManagerEmail})` : ""} will be your onboarding manager.`
    : "Your onboarding manager will be in touch shortly.";

  const feeLines: string[] = [];
  if (input.monthlyFee) feeLines.push(`Monthly services: $${input.monthlyFee.toLocaleString()}/mo`);
  if (input.catchupFee) feeLines.push(`Catch-up (one-time): $${input.catchupFee.toLocaleString()}`);
  if (input.taxFee) feeLines.push(`Tax prep (one-time): $${input.taxFee.toLocaleString()}`);

  const nextSteps = [
    "A short welcome packet + document checklist (you'll get this from us in the next business day)",
    "Shared access to your QuickBooks / Xero and bank statements",
    "A 30-minute kickoff call to walk through your numbers and what we need from you",
  ];

  const subject = `Welcome to ${firm} — let's get started${input.companyName ? ` with ${input.companyName}` : ""}`;

  const bodyText = [
    `Hi ${firstName},`,
    "",
    `Thanks for signing the proposal — we're excited to have you on board at ${firm}.`,
    "",
    managerLine,
    "",
    ...(feeLines.length > 0 ? ["Here's what you signed up for:", ...feeLines.map((l) => `  • ${l}`), ""] : []),
    "Over the next few business days you'll hear from us about:",
    ...nextSteps.map((s) => `  • ${s}`),
    "",
    ...(input.portalUrl
      ? [
          `You can track your onboarding progress here: ${input.portalUrl}`,
          "",
        ]
      : []),
    `If anything comes up in the meantime, reply to this email or reach out to your onboarding manager directly.`,
    "",
    `Welcome aboard,`,
    `The ${firm} team`,
  ].join("\n");

  const bodyHtml = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#0f172a;">
    <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
      <div style="font-size:11px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:#758696;">
        ${firm}
      </div>
      <h1 style="font-size:24px;line-height:1.25;margin:8px 0 24px;color:#07183a;">
        Welcome${input.clientFirstName ? `, ${input.clientFirstName}` : ""}.
      </h1>
      <p style="font-size:15px;line-height:1.55;margin:0 0 16px;">
        Thanks for signing the proposal — we're excited to have you on board.
      </p>
      <p style="font-size:15px;line-height:1.55;margin:0 0 20px;">
        ${managerLine}
      </p>
      ${
        feeLines.length > 0
          ? `<div style="border:1px solid #e5ecf5;border-radius:8px;padding:16px;margin:0 0 20px;background:#fff;">
              <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.14em;color:#758696;margin-bottom:8px;">Your engagement</div>
              ${feeLines.map((l) => `<div style="font-size:14px;margin:4px 0;">${l}</div>`).join("")}
            </div>`
          : ""
      }
      <p style="font-size:15px;line-height:1.55;margin:0 0 8px;">Over the next few business days you'll hear from us about:</p>
      <ul style="font-size:14px;line-height:1.65;margin:0 0 24px;padding-left:20px;">
        ${nextSteps.map((s) => `<li>${s}</li>`).join("")}
      </ul>
      ${
        input.portalUrl
          ? `<p style="margin:0 0 24px;"><a href="${input.portalUrl}" style="display:inline-block;padding:10px 18px;background:#005bf7;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;">Track your onboarding →</a></p>`
          : ""
      }
      <p style="font-size:14px;line-height:1.55;color:#3f4956;margin:24px 0 0;">
        If anything comes up, reply to this email or reach your onboarding manager directly.
      </p>
      <p style="font-size:14px;line-height:1.55;color:#3f4956;margin:24px 0 0;">
        Welcome aboard,<br/>
        The ${firm} team
      </p>
    </div>
  </body>
</html>`;

  return sendEmail({
    to: input.to,
    subject,
    bodyText,
    bodyHtml,
    replyTo: input.onboardingManagerEmail ?? undefined,
  });
}
