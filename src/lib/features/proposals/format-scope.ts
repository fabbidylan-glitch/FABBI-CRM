import { computeDiscount } from "./discount";

/**
 * Format a proposal's scope + line items + discount into a clipboard-ready
 * text block the rep can paste directly into Anchor's proposal description
 * field. Intentionally plain text — no markdown, no fancy formatting — so it
 * pastes cleanly into any rich-text editor (Anchor, Notion, email).
 */

export type FormatScopeInput = {
  clientName: string | null;
  companyName: string | null;
  scopeSummary: string | null;
  lineItems: Array<{
    description: string;
    monthlyAmount: number | null;
    onetimeAmount: number | null;
  }>;
  discount: {
    label: string | null;
    amount: number | null;
    pct: number | null;
    appliesTo: "MONTHLY" | "ONETIME" | "BOTH" | null;
  };
};

export function formatScopeForAnchor(input: FormatScopeInput): string {
  const monthlyLines = input.lineItems.filter((li) => li.monthlyAmount && li.monthlyAmount > 0);
  const onetimeLines = input.lineItems.filter((li) => li.onetimeAmount && li.onetimeAmount > 0);

  const monthlySubtotal = monthlyLines.reduce((s, li) => s + (li.monthlyAmount ?? 0), 0);
  const onetimeSubtotal = onetimeLines.reduce((s, li) => s + (li.onetimeAmount ?? 0), 0);

  const discount = computeDiscount(monthlySubtotal, onetimeSubtotal, {
    discountLabel: input.discount.label,
    discountAmount: input.discount.amount,
    discountPct: input.discount.pct,
    discountAppliesTo: input.discount.appliesTo,
  });

  const monthlyTotal = Math.max(0, monthlySubtotal - discount.monthly);
  const onetimeTotal = Math.max(0, onetimeSubtotal - discount.onetime);

  const lines: string[] = [];

  const heading = input.companyName
    ? `SCOPE OF SERVICES — ${input.companyName}`
    : input.clientName
      ? `SCOPE OF SERVICES — ${input.clientName}`
      : `SCOPE OF SERVICES`;
  lines.push(heading);

  if (input.scopeSummary) {
    lines.push("");
    lines.push(input.scopeSummary);
  }

  if (monthlyLines.length > 0) {
    lines.push("");
    lines.push("MONTHLY SERVICES");
    for (const li of monthlyLines) {
      lines.push(`• ${li.description} — $${(li.monthlyAmount ?? 0).toLocaleString()}/mo`);
    }
    if (discount.monthly > 0) {
      lines.push(`  Subtotal: $${monthlySubtotal.toLocaleString()}/mo`);
      lines.push(`  ${discount.label || "Discount"}: −$${discount.monthly.toLocaleString()}/mo`);
      lines.push(`  Monthly total: $${monthlyTotal.toLocaleString()}/mo`);
    } else {
      lines.push(`  Monthly total: $${monthlyTotal.toLocaleString()}/mo`);
    }
  }

  if (onetimeLines.length > 0) {
    lines.push("");
    lines.push("ONE-TIME");
    for (const li of onetimeLines) {
      lines.push(`• ${li.description} — $${(li.onetimeAmount ?? 0).toLocaleString()}`);
    }
    if (discount.onetime > 0) {
      lines.push(`  Subtotal: $${onetimeSubtotal.toLocaleString()}`);
      lines.push(`  ${discount.label || "Discount"}: −$${discount.onetime.toLocaleString()}`);
      lines.push(`  One-time total: $${onetimeTotal.toLocaleString()}`);
    } else {
      lines.push(`  One-time total: $${onetimeTotal.toLocaleString()}`);
    }
  }

  lines.push("");
  lines.push("ASSUMPTIONS");
  lines.push("• Engagement begins month of signature; first deliverables within 15 business days.");
  lines.push("• Pricing holds for 30 days from send date.");
  lines.push("• Cleanup work (if any) is billed one-time and must be complete before recurring service begins.");
  lines.push("• Tax filings are billed separately per entity.");
  lines.push("• Either party can terminate with 30 days written notice.");

  return lines.join("\n");
}
