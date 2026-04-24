import "server-only";
import type { LeadTierValue } from "@/lib/scoring/tier";

/*
 * Internal new-lead alert. Fires from the intake pipeline right after a Lead
 * row is written so the sales team can respond within minutes, not a day.
 *
 * Channels (best-effort, non-blocking on failure):
 *   1. NEW_LEAD_SLACK_WEBHOOK_URL  — POSTs a formatted message
 *   2. NEW_LEAD_ALERT_EMAIL        — TODO: wire through internal email
 *
 * HIGH-tier leads get visual emphasis (🔥 prefix + header line) so the
 * notification is scannable in a busy channel.
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

async function sendInternalEmail(_payload: NewLeadAlertPayload): Promise<void> {
  const to = process.env.NEW_LEAD_ALERT_EMAIL;
  if (!to) return;
  // TODO: wire through the internal messaging layer (sendMessage() is
  // lead-scoped and writes to the Communication table; internal alerts
  // need a separate sender). Until then, the Slack path covers the main
  // use case and this logs so ops knows it's not silently dropped.
  console.info("[new-lead-alert] email channel requested but not yet implemented", {
    to,
    leadId: _payload.leadId,
    tier: _payload.tier,
  });
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
