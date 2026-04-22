import "server-only";
import { sendEmail } from "@/lib/integrations/email";
import { config } from "@/lib/config";

/**
 * Proposal-sent email — the first time a prospect sees FABBI branding, so we
 * invest in polish. Structure mirrors a top-tier accounting firm's engagement
 * letter: personal greeting, scope at a glance, investment breakdown, CTA,
 * assurance, signature. Email-safe HTML: table-based layout, inline styles,
 * no CSS that older clients choke on.
 */

export type ProposalEmailInput = {
  to: string;
  clientFirstName: string | null;
  companyName: string | null;
  monthlySubtotal: number;
  onetimeSubtotal: number;
  monthlyTotal: number;
  onetimeTotal: number;
  /** Discount to show as a distinct line in the breakdown. */
  discount?: {
    /** Short, semantic label, e.g. "New client discount" — no amount in here.
     *  The amount is shown separately in the right column. */
    label: string;
    monthly: number;
    onetime: number;
  } | null;
  scopeSummary: string | null;
  signingUrl: string;
  sender: {
    name: string | null;
    email: string | null;
  };
};

export type RenderedProposalEmail = {
  subject: string;
  to: string;
  bodyText: string;
  bodyHtml: string;
  replyTo?: string;
};

/**
 * Pure: build the email's subject/text/html from the proposal. Used both
 * by the preview endpoint and the actual send.
 */
export function renderProposalEmail(input: ProposalEmailInput): RenderedProposalEmail {
  const firstName = input.clientFirstName?.trim() || "there";
  const firm = config.firmName || "FABBI";
  const rawName = input.sender.name?.trim() || "";
  // If the user record has no real name (common when Clerk auto-populated
  // from an email handle like "fabbidylan"), fall back to the firm so the
  // email isn't signed by "fabbidylan" or similar.
  const senderName = rawName && rawName.includes(" ") ? rawName : `The ${firm} team`;

  const targetCompanyOrClient =
    input.companyName ||
    [input.clientFirstName, null].filter(Boolean).join(" ") ||
    "your business";

  const subject = `${firm} proposal for ${targetCompanyOrClient}`;

  const hasMonthlyDiscount = Boolean(input.discount && input.discount.monthly > 0);
  const hasOnetimeDiscount = Boolean(input.discount && input.discount.onetime > 0);
  const discountLabel = input.discount?.label || "Discount";

  // ── Plaintext body ─────────────────────────────────────────────────────────
  const textLines: string[] = [];
  textLines.push(`Hi ${firstName},`);
  textLines.push("");
  textLines.push(
    `Thanks for taking the time to walk through what you need. Below is the proposal we've put together${input.companyName ? ` for ${input.companyName}` : ""}.`
  );
  textLines.push("");
  if (input.scopeSummary) {
    textLines.push(`Scope: ${input.scopeSummary}`);
    textLines.push("");
  }
  if (input.monthlyTotal > 0) {
    textLines.push("MONTHLY SERVICES");
    if (hasMonthlyDiscount) {
      textLines.push(`  Subtotal:        $${input.monthlySubtotal.toLocaleString()}/mo`);
      textLines.push(
        `  ${discountLabel}:   −$${input.discount!.monthly.toLocaleString()}/mo`
      );
      textLines.push(`  Total:           $${input.monthlyTotal.toLocaleString()}/mo`);
    } else {
      textLines.push(`  $${input.monthlyTotal.toLocaleString()}/mo`);
    }
    textLines.push("");
  }
  if (input.onetimeTotal > 0) {
    textLines.push("ONE-TIME");
    if (hasOnetimeDiscount) {
      textLines.push(`  Subtotal:        $${input.onetimeSubtotal.toLocaleString()}`);
      textLines.push(
        `  ${discountLabel}:   −$${input.discount!.onetime.toLocaleString()}`
      );
      textLines.push(`  Total:           $${input.onetimeTotal.toLocaleString()}`);
    } else {
      textLines.push(`  $${input.onetimeTotal.toLocaleString()}`);
    }
    textLines.push("");
  }
  textLines.push("Review & sign here:");
  textLines.push(input.signingUrl);
  textLines.push("");
  textLines.push(
    "This pricing holds for 30 days from send. If anything looks off or you'd like to tweak the scope, just reply to this email — happy to adjust."
  );
  textLines.push("");
  textLines.push("Thanks,");
  textLines.push(senderName);
  textLines.push(firm);
  const bodyText = textLines.join("\n");

  // ── HTML body ──────────────────────────────────────────────────────────────
  // Table-based layout for maximum email-client compatibility. Inline styles
  // everywhere. Max width 600px. Accent gradient bar at the top so it reads
  // as intentionally branded, not a default template.
  const brandAccent = "#005bf7";
  const brandDark = "#07183a";
  const muted = "#758696";
  const hairline = "#e5ecf5";
  const surface = "#f4f6fb";
  const emerald = "#047857";

  const discountRow = (label: string, amount: number, suffix = "") => `
    <tr>
      <td style="padding:4px 0;font-size:13px;color:${emerald};">${escapeHtml(label)}</td>
      <td style="padding:4px 0;font-size:13px;color:${emerald};text-align:right;" align="right">−$${amount.toLocaleString()}${suffix}</td>
    </tr>`;

  const subtotalRow = (amount: number, suffix = "") => `
    <tr>
      <td style="padding:4px 0;font-size:13px;color:${muted};">Subtotal</td>
      <td style="padding:4px 0;font-size:13px;color:${muted};text-align:right;" align="right">$${amount.toLocaleString()}${suffix}</td>
    </tr>`;

  const monthlyBlock =
    input.monthlyTotal > 0
      ? `
    <div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
        <tr>
          <td colspan="2" style="padding:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${muted};">Monthly services</td>
        </tr>
        ${hasMonthlyDiscount ? subtotalRow(input.monthlySubtotal, "/mo") : ""}
        ${hasMonthlyDiscount ? discountRow(discountLabel, input.discount!.monthly, "/mo") : ""}
        <tr>
          <td style="padding:10px 0 0;border-top:1px solid ${hairline};font-size:14px;font-weight:600;color:${brandDark};">Total</td>
          <td style="padding:10px 0 0;border-top:1px solid ${hairline};font-size:24px;font-weight:600;color:${brandDark};text-align:right;letter-spacing:-0.01em;" align="right">
            $${input.monthlyTotal.toLocaleString()}<span style="font-size:14px;font-weight:400;color:${muted};"> /mo</span>
          </td>
        </tr>
      </table>
    </div>`
      : "";

  const onetimeBlock =
    input.onetimeTotal > 0
      ? `
    <div style="${input.monthlyTotal > 0 ? "margin-top:20px;padding-top:20px;border-top:1px solid " + hairline + ";" : ""}">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
        <tr>
          <td colspan="2" style="padding:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${muted};">One-time</td>
        </tr>
        ${hasOnetimeDiscount ? subtotalRow(input.onetimeSubtotal) : ""}
        ${hasOnetimeDiscount ? discountRow(discountLabel, input.discount!.onetime) : ""}
        <tr>
          <td style="padding:10px 0 0;border-top:1px solid ${hairline};font-size:14px;font-weight:600;color:${brandDark};">Total</td>
          <td style="padding:10px 0 0;border-top:1px solid ${hairline};font-size:20px;font-weight:600;color:${brandDark};text-align:right;" align="right">
            $${input.onetimeTotal.toLocaleString()}
          </td>
        </tr>
      </table>
    </div>`
      : "";

  const bodyHtml = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:${surface};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${brandDark};">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${surface};">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid ${hairline};">
            <!-- Accent bar -->
            <tr>
              <td style="height:4px;background:linear-gradient(90deg,${brandAccent} 0%,#123b96 60%,${brandDark} 100%);line-height:4px;">&nbsp;</td>
            </tr>

            <!-- Letterhead -->
            <tr>
              <td style="padding:36px 40px 8px;">
                <div style="font-size:11px;font-weight:700;letter-spacing:0.24em;text-transform:uppercase;color:${muted};">
                  ${escapeHtml(firm)}
                </div>
                <div style="margin-top:3px;font-size:12px;color:${muted};">
                  Accounting · Tax · Advisory
                </div>
              </td>
            </tr>

            <!-- Greeting -->
            <tr>
              <td style="padding:20px 40px 8px;">
                <h1 style="margin:0;font-size:26px;line-height:1.25;font-weight:600;color:${brandDark};letter-spacing:-0.015em;">
                  Your proposal is ready${input.clientFirstName ? `, ${escapeHtml(input.clientFirstName)}` : ""}.
                </h1>
              </td>
            </tr>

            <!-- Opening -->
            <tr>
              <td style="padding:12px 40px 20px;">
                <p style="margin:0;font-size:15px;line-height:1.6;color:#3f4956;">
                  Thanks for taking the time to walk through what you need. Below is the engagement we&rsquo;ve put together${input.companyName ? ` for <strong style="color:${brandDark};">${escapeHtml(input.companyName)}</strong>` : ""}. Everything is in-line — the signing link is at the bottom.
                </p>
              </td>
            </tr>

            ${
              input.scopeSummary
                ? `
            <!-- Scope summary quote -->
            <tr>
              <td style="padding:0 40px 24px;">
                <div style="border-left:3px solid ${brandAccent};padding:6px 0 6px 14px;font-size:14px;color:#3f4956;line-height:1.5;">
                  ${escapeHtml(input.scopeSummary)}
                </div>
              </td>
            </tr>`
                : ""
            }

            <!-- Investment breakdown -->
            <tr>
              <td style="padding:0 40px 28px;">
                <div style="border:1px solid ${hairline};border-radius:10px;overflow:hidden;">
                  <div style="padding:14px 20px;background:#f8fafc;border-bottom:1px solid ${hairline};">
                    <div style="font-size:10px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:${muted};">Investment</div>
                  </div>
                  <div style="padding:20px;">
                    ${monthlyBlock}
                    ${onetimeBlock}
                  </div>
                </div>
              </td>
            </tr>

            <!-- CTA -->
            <tr>
              <td style="padding:0 40px 32px;" align="center">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="border-radius:8px;background:linear-gradient(180deg,${brandAccent} 0%,#0043b8 100%);">
                      <a href="${input.signingUrl}" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;">
                        Review &amp; sign →
                      </a>
                    </td>
                  </tr>
                </table>
                <div style="margin-top:12px;font-size:12px;color:${muted};">
                  Signing is handled securely through Anchor, our engagement + billing platform.
                </div>
              </td>
            </tr>

            <!-- Fine print -->
            <tr>
              <td style="padding:0 40px 24px;">
                <div style="font-size:12px;color:${muted};line-height:1.7;background:#f8fafc;border:1px solid ${hairline};border-radius:8px;padding:14px 16px;">
                  <strong style="color:${brandDark};">A few notes:</strong> pricing holds for 30 days from send.
                  Engagement begins the month you sign — first deliverables within 15 business days.
                  If anything feels off or you want to tweak scope, just reply to this email and we&rsquo;ll
                  rework it together.
                </div>
              </td>
            </tr>

            <!-- Signature -->
            <tr>
              <td style="padding:0 40px 36px;">
                <div style="font-size:15px;color:#3f4956;line-height:1.6;">
                  Looking forward to working together,<br/>
                  <span style="color:${brandDark};font-weight:600;">${escapeHtml(senderName)}</span>
                  <br/>
                  <span style="font-size:12px;color:${muted};">${escapeHtml(firm)}</span>
                </div>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:18px 40px;background:#f8fafc;border-top:1px solid ${hairline};">
                <div style="font-size:11px;color:${muted};line-height:1.6;">
                  ${escapeHtml(firm)} · Accounting, tax &amp; advisory<br/>
                  You&rsquo;re receiving this because we recently discussed your accounting needs.
                </div>
              </td>
            </tr>
          </table>

          <div style="max-width:600px;margin:12px auto 0;text-align:center;font-size:11px;color:${muted};">
            Sent from ${escapeHtml(firm)}&rsquo;s proposal system.
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return {
    to: input.to,
    subject,
    bodyText,
    bodyHtml,
    replyTo: input.sender.email ?? undefined,
  };
}

/** Build + send in one shot. */
export async function sendProposalEmail(input: ProposalEmailInput) {
  const rendered = renderProposalEmail(input);
  return sendEmail(rendered);
}

/** Minimal HTML escape — we're injecting user-controlled strings like client
 *  name and company into the template, so block the common attack chars. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
