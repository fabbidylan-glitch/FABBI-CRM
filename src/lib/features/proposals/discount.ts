/**
 * Proposal-level discount math — pure functions, no DB access. Used in three
 * places:
 *   1. recomputeProposalTotals() — to derive stored monthlyValue / onetimeValue
 *   2. EditableProposal UI — to render the Subtotal / Discount / Total rows
 *   3. Proposal + welcome emails — to include the breakdown in the client email
 *
 * Contract: the caller passes the subtotals (sum of line items) and the raw
 * discount fields off the Proposal row. Returns concrete dollar values to
 * apply per bucket, plus a human-readable label.
 */

export type DiscountInput = {
  discountLabel?: string | null;
  discountAmount?: number | null;
  discountPct?: number | null;
  discountAppliesTo?: "MONTHLY" | "ONETIME" | "BOTH" | null;
};

export type DiscountResult = {
  /** Amount taken off the monthly subtotal. 0 if no discount or scope excludes monthly. */
  monthly: number;
  /** Amount taken off the one-time subtotal. 0 if no discount or scope excludes one-time. */
  onetime: number;
  /** Convenience — how the rep / client should see the discount ("10% off", "-$500"). */
  label: string;
  /** Convenience — the sum of monthly + onetime dollars saved. */
  totalDollars: number;
};

export function computeDiscount(
  monthlySubtotal: number,
  onetimeSubtotal: number,
  d: DiscountInput
): DiscountResult {
  const scope = d.discountAppliesTo ?? "BOTH";
  const hasPct = d.discountPct !== null && d.discountPct !== undefined && d.discountPct > 0;
  const hasAmount = d.discountAmount !== null && d.discountAmount !== undefined && d.discountAmount > 0;

  if (!hasPct && !hasAmount) {
    return { monthly: 0, onetime: 0, label: "", totalDollars: 0 };
  }

  let monthly = 0;
  let onetime = 0;
  let labelCore = "";

  if (hasPct) {
    const pct = Number(d.discountPct);
    labelCore = `${pct}% off`;
    if (scope === "MONTHLY" || scope === "BOTH") monthly = monthlySubtotal * (pct / 100);
    if (scope === "ONETIME" || scope === "BOTH") onetime = onetimeSubtotal * (pct / 100);
  } else {
    const amount = Number(d.discountAmount);
    labelCore = `-$${amount.toLocaleString()}`;
    if (scope === "MONTHLY") {
      monthly = Math.min(amount, monthlySubtotal);
    } else if (scope === "ONETIME") {
      onetime = Math.min(amount, onetimeSubtotal);
    } else {
      // BOTH + flat: split proportionally across buckets so the net is exactly `amount`.
      const combined = monthlySubtotal + onetimeSubtotal;
      if (combined > 0) {
        monthly = Math.min(amount * (monthlySubtotal / combined), monthlySubtotal);
        onetime = Math.min(amount - monthly, onetimeSubtotal);
      }
    }
  }

  // Round to cents so totals tie when shown to the client.
  monthly = Math.round(monthly * 100) / 100;
  onetime = Math.round(onetime * 100) / 100;

  const label = d.discountLabel ? `${d.discountLabel} · ${labelCore}` : labelCore;
  return { monthly, onetime, label, totalDollars: monthly + onetime };
}

/** Describe which bucket(s) the discount touches for UI copy. */
export function scopeLabel(scope?: "MONTHLY" | "ONETIME" | "BOTH" | null): string {
  switch (scope) {
    case "MONTHLY":
      return "monthly";
    case "ONETIME":
      return "one-time";
    case "BOTH":
    default:
      return "both";
  }
}
