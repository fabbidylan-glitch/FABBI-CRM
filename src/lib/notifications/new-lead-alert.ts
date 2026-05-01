import "server-only";
import { config } from "@/lib/config";
import { emailProviderName, sendEmail } from "@/lib/integrations/email";
import type { LeadTierValue } from "@/lib/scoring/tier";

/*
 * Internal new-lead alert. Fires from the intake pipeline right after a Lead
 * row is written so the sales team can respond within minutes, not a day.
 *
 * Channels (best-effort, non-blocking on failure):
 *   1. NEW_LEAD_SLACK_WEBHOOK_URL  — POSTs a formatted message
 *   2. NEW_LEAD_ALERT_EMAIL        — sends via the configured provider
 *      (Resend or MS Graph). Comma-separated for multiple recipients.
 *
 * HIGH-tier leads get visual emphasis (🔥 prefix + header line) so the
 * notification is scannable in a busy channel/inbox.
 *
 * Never throws; all failures are logged and swallowed so a notification
 * outage can't block lead creation.
 */

export type NewLeadAlertPayload = {
  leadId: string;
  firstName: string;
  lastName?: string | null;
  email: string;
  phone?: string | null;
  revenueRange: string;
  serviceInterest: string;
  /** Raw multi-select values from the intake form. Preferred for display. */
  serviceInterests?: string[];
  niche: string;
  statesOfOperation?: string[];
  tier: LeadTierValue;
  tierScore: number;
  tierReasons: string[];
  leadScore: number;
  leadGrade: "A" | "B" | "C" | "D" | null;
  qualification: string;
  sourcePage?: string | null;
  painPoint?: string | null;

  // Mini-brand attribution forwarded from the marketing site. All optional;
  // direct intake submits with all four null and these rows are skipped.
  sourceSubdomain?: string | null;
  serviceLine?: string | null;
  landingPageUrl?: string | null;
  referrer?: string | null;
};

export async function sendNewLeadAlert(payload: NewLeadAlertPayload): Promise<void> {
  const results = await Promise.allSettled([sendSlack(payload), sendInternalEmail(payload)]);
  for (const r of results) {
    if (r.status === "rejected") {
      console.error("[new-lead-alert] channel failed", r.reason);
    }
  }
}

async function sendSlack(payload: NewLeadAlertPayload): Promise<void> {
  const url = process.env.NEW_LEAD_SLACK_WEBHOOK_URL;
  if (!url) return;

  const isHigh = payload.tier === "HIGH";
  const tierEmoji = isHigh ? "🔥" : payload.tier === "MEDIUM" ? "⭐" : "•";
  const header = isHigh
    ? `${tierEmoji} *HIGH-TIER LEAD — respond now*`
    : `${tierEmoji} New lead — ${payload.tier.toLowerCase()} tier`;

  const fullName = [payload.firstName, payload.lastName].filter(Boolean).join(" ").trim();
  const states = (payload.statesOfOperation ?? []).join(", ") || "—";

  // Prefer the raw multi-select values so Cost Segregation doesn't collapse
  // into Tax Planning (which is what the primary ServiceInterest enum does).
  const services = payload.serviceInterests ?? [];
  const servicesDisplay =
    services.length > 0
      ? services.map(humanUiService).join(", ")
      : humanService(payload.serviceInterest);

  const lines: string[] = [
    header,
    `*${fullName}*  <mailto:${payload.email}|${payload.email}>${payload.phone ? `  •  ${payload.phone}` : ""}`,
    `Revenue: *${humanRevenue(payload.revenueRange)}*  •  Interested in: *${servicesDisplay}*  •  Niche: *${humanNiche(payload.niche)}*`,
    `Tier score: *${payload.tierScore}* (${payload.tierReasons.join(" · ") || "no positive signals"})  •  Fit score: ${payload.leadScore}/100${payload.leadGrade ? ` (${payload.leadGrade})` : ""}`,
    `States: ${states}  •  Landing: ${payload.sourcePage || "—"}`,
  ];
  if (payload.painPoint) {
    lines.push(`> ${truncate(payload.painPoint, 240)}`);
  }

  // Mini-brand attribution rows. Only render rows whose values exist so a
  // direct intake submission produces no blank lines. URLs render as Slack
  // hyperlinks (<url|host/path>) so long query strings don't blow up the
  // message; full URL is preserved on click.
  const attribLines: string[] = [];
  if (payload.sourceSubdomain) {
    attribLines.push(`Sub-brand: \`${payload.sourceSubdomain}\``);
  }
  if (payload.serviceLine) {
    attribLines.push(`Service line: \`${payload.serviceLine}\``);
  }
  if (payload.landingPageUrl) {
    attribLines.push(`Landing page: ${slackHyperlink(payload.landingPageUrl)}`);
  }
  if (payload.referrer) {
    attribLines.push(`Referrer: ${slackHyperlink(payload.referrer)}`);
  }
  if (attribLines.length > 0) {
    lines.push(...attribLines);
  }

  const body = {
    text: lines.join("\n"),
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`slack webhook returned ${res.status}`);
  }
}

async function sendInternalEmail(payload: NewLeadAlertPayload): Promise<void> {
  const raw = process.env.NEW_LEAD_ALERT_EMAIL;
  if (!raw) return;

  // Don't blow up if no provider is configured — just log and move on.
  // (The Slack channel still covers the alerting use-case in that mode.)
  if (emailProviderName() === "none") {
    console.info("[new-lead-alert] email recipients set but no provider configured", {
      to: raw,
      leadId: payload.leadId,
    });
    return;
  }

  // Comma-or-semicolon separated list, trimmed. Both Resend and Graph accept
  // a comma-joined string in the To header.
  const recipients = raw
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (recipients.length === 0) return;

  const isHigh = payload.tier === "HIGH";
  const tierEmoji = isHigh ? "🔥" : payload.tier === "MEDIUM" ? "⭐" : "•";
  const fullName =
    [payload.firstName, payload.lastName].filter(Boolean).join(" ").trim() ||
    payload.email;
  const subject = isHigh
    ? `${tierEmoji} HIGH-tier lead — ${fullName} (${humanRevenue(payload.revenueRange)})`
    : `${tierEmoji} New lead — ${fullName} (${humanNiche(payload.niche)})`;

  const services = payload.serviceInterests ?? [];
  const servicesDisplay =
    services.length > 0
      ? services.map(humanUiService).join(", ")
      : humanService(payload.serviceInterest);
  const states = (payload.statesOfOperation ?? []).join(", ") || "—";

  const leadUrl = config.appUrl ? `${config.appUrl}/leads/${payload.leadId}` : null;

  // Plain-text fallback — every email client renders it.
  const textLines: string[] = [
    isHigh
      ? `${tierEmoji} HIGH-TIER LEAD — respond now`
      : `${tierEmoji} New ${payload.tier.toLowerCase()}-tier lead`,
    "",
    `Name:     ${fullName}`,
    `Email:    ${payload.email}`,
    payload.phone ? `Phone:    ${payload.phone}` : null,
    `Revenue:  ${humanRevenue(payload.revenueRange)}`,
    `Interested in: ${servicesDisplay}`,
    `Niche:    ${humanNiche(payload.niche)}`,
    `Tier:     ${payload.tier} (score ${payload.tierScore})`,
    payload.tierReasons.length > 0
      ? `Signals:  ${payload.tierReasons.join(" · ")}`
      : null,
    `Fit:      ${payload.leadScore}/100${payload.leadGrade ? ` (${payload.leadGrade})` : ""}`,
    `States:   ${states}`,
    payload.sourcePage ? `Landing:  ${payload.sourcePage}` : null,
    payload.sourceSubdomain ? `Sub-brand: ${payload.sourceSubdomain}` : null,
    payload.serviceLine ? `Service line: ${payload.serviceLine}` : null,
    payload.landingPageUrl ? `Landing page: ${truncate(payload.landingPageUrl, 200)}` : null,
    payload.referrer ? `Referrer: ${truncate(payload.referrer, 200)}` : null,
    payload.painPoint ? `\nPain point:\n${truncate(payload.painPoint, 600)}` : null,
    leadUrl ? `\nOpen lead in CRM: ${leadUrl}` : null,
  ].filter((l): l is string => l !== null);

  const bodyText = textLines.join("\n");

  // Lightweight HTML version. No external CSS — keep deliverability high and
  // render predictably across Outlook/Gmail/Apple Mail without a render lib.
  const headerColor = isHigh ? "#dc2626" : payload.tier === "MEDIUM" ? "#0a4d8c" : "#475569";
  const rows: Array<[string, string]> = [
    ["Email", escapeHtml(payload.email)],
    ...(payload.phone ? [["Phone", escapeHtml(payload.phone)] as [string, string]] : []),
    ["Revenue", escapeHtml(humanRevenue(payload.revenueRange))],
    ["Interested in", escapeHtml(servicesDisplay)],
    ["Niche", escapeHtml(humanNiche(payload.niche))],
    [
      "Tier",
      `${escapeHtml(payload.tier)} <span style="color:#64748b">(score ${payload.tierScore})</span>`,
    ],
    ...(payload.tierReasons.length > 0
      ? [["Signals", escapeHtml(payload.tierReasons.join(" · "))] as [string, string]]
      : []),
    [
      "Fit",
      `${payload.leadScore}/100${payload.leadGrade ? ` <span style="color:#64748b">(${escapeHtml(payload.leadGrade)})</span>` : ""}`,
    ],
    ["States", escapeHtml(states)],
    ...(payload.sourcePage
      ? [["Landing", escapeHtml(payload.sourcePage)] as [string, string]]
      : []),
    ...(payload.sourceSubdomain
      ? [["Sub-brand", `<code>${escapeHtml(payload.sourceSubdomain)}</code>`] as [string, string]]
      : []),
    ...(payload.serviceLine
      ? [["Service line", `<code>${escapeHtml(payload.serviceLine)}</code>`] as [string, string]]
      : []),
    ...(payload.landingPageUrl
      ? [["Landing page", htmlAnchor(payload.landingPageUrl)] as [string, string]]
      : []),
    ...(payload.referrer
      ? [["Referrer", htmlAnchor(payload.referrer)] as [string, string]]
      : []),
  ];
  const bodyHtml = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
    <tr><td style="padding:18px 22px;background:${headerColor};color:#ffffff">
      <div style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;opacity:0.85">${tierEmoji} ${escapeHtml(payload.tier)} tier</div>
      <div style="font-size:18px;font-weight:600;margin-top:4px">${escapeHtml(fullName)}</div>
    </td></tr>
    <tr><td style="padding:20px 22px">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:14px;line-height:1.5">
        ${rows
          .map(
            ([k, v]) =>
              `<tr><td style="padding:6px 0;color:#64748b;width:120px">${escapeHtml(k)}</td><td style="padding:6px 0;color:#0f172a">${v}</td></tr>`
          )
          .join("")}
      </table>
      ${
        payload.painPoint
          ? `<div style="margin-top:18px;padding:12px 14px;background:#f1f5f9;border-radius:6px;border-left:3px solid ${headerColor};font-size:13px;line-height:1.5;color:#0f172a"><div style="font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#64748b;margin-bottom:6px">Pain point</div>${escapeHtml(truncate(payload.painPoint, 800))}</div>`
          : ""
      }
      ${
        leadUrl
          ? `<div style="margin-top:22px"><a href="${escapeHtml(leadUrl)}" style="display:inline-block;background:#005bf7;color:#ffffff;text-decoration:none;font-weight:600;font-size:13px;padding:10px 16px;border-radius:6px">Open lead in CRM →</a></div>`
          : ""
      }
    </td></tr>
  </table>
</body></html>`;

  await sendEmail({
    to: recipients.join(", "),
    subject,
    bodyText,
    bodyHtml,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function humanRevenue(v: string): string {
  switch (v) {
    case "UNDER_250K":
      return "<$250K";
    case "FROM_250K_TO_500K":
      return "$250K–$500K";
    case "FROM_500K_TO_1M":
      return "$500K–$1M";
    case "OVER_1M":
      return "$1M+";
    default:
      return "unknown";
  }
}

// Raw multi-select values from the intake form (before primary derivation).
function humanUiService(v: string): string {
  switch (v) {
    case "BOOKKEEPING":
      return "Bookkeeping";
    case "TAX_STRATEGY":
      return "Tax Planning";
    case "TAX_PREP":
      return "Tax Prep";
    case "CFO":
      return "Fractional CFO";
    case "COST_SEG":
      return "Cost Segregation";
    default:
      return v;
  }
}

function humanService(v: string): string {
  switch (v) {
    case "BOOKKEEPING":
      return "Bookkeeping";
    case "TAX_STRATEGY":
      return "Tax Planning";
    case "TAX_PREP":
      return "Tax Prep";
    case "CFO":
      return "Fractional CFO";
    case "BOOKKEEPING_AND_TAX":
      return "Books + Tax";
    case "FULL_SERVICE":
      return "Full service";
    default:
      return "Unsure";
  }
}

function humanNiche(v: string): string {
  switch (v) {
    case "STR_OWNER":
    case "AIRBNB_VRBO_OPERATOR":
      return "STR operator";
    case "REAL_ESTATE_INVESTOR":
      return "Real estate investor";
    case "HIGH_INCOME_STR_STRATEGY":
      return "High-income STR";
    case "E_COMMERCE":
      return "E-commerce";
    case "GENERAL_SMB":
      return "Service business";
    case "MULTI_SERVICE_CLIENT":
      return "Multi-service";
    default:
      return "Other";
  }
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

/**
 * Slack hyperlink format: <url|display>. Falls back to the raw string if
 * the URL doesn't parse (e.g. "(direct)" for empty referrers, or malformed
 * inputs). Display text is host + truncated path so long query strings
 * don't dominate the message.
 */
function slackHyperlink(raw: string): string {
  const trimmed = raw.trim();
  try {
    const u = new URL(trimmed);
    const path = u.pathname === "/" ? "" : u.pathname;
    const display = truncate(`${u.hostname}${path}`, 60);
    return `<${trimmed}|${display}>`;
  } catch {
    return truncate(trimmed, 80);
  }
}

/**
 * <a href> tag for the HTML email. URL is escaped, display text is host +
 * truncated path. Falls back to escaped raw string if not a valid URL.
 */
function htmlAnchor(raw: string): string {
  const trimmed = raw.trim();
  try {
    const u = new URL(trimmed);
    const path = u.pathname === "/" ? "" : u.pathname;
    const display = truncate(`${u.hostname}${path}`, 60);
    return `<a href="${escapeHtml(trimmed)}" style="color:#005bf7;text-decoration:none">${escapeHtml(display)}</a>`;
  } catch {
    return escapeHtml(truncate(trimmed, 80));
  }
}
