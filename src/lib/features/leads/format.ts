/**
 * Display helpers for multi-select lead attributes.
 *
 * Keep these in one place so the confirmation email, the Slack alert, and
 * any future dashboard UI all render the exact same labels from the raw
 * ServiceInterestUiEnum values persisted on Lead.serviceInterests.
 */

const SERVICE_INTEREST_LABELS: Record<string, string> = {
  BOOKKEEPING: "Bookkeeping",
  TAX_STRATEGY: "Tax Planning",
  TAX_PREP: "Tax Preparation",
  CFO: "Fractional CFO",
  COST_SEG: "Cost Segregation",
};

/**
 * Convert the raw UI values stored on Lead.serviceInterests into a human
 * comma-separated string. Unknown codes fall back to their raw value so we
 * never render a blank or confusing label.
 *
 * Examples:
 *   []                              → ""
 *   ["BOOKKEEPING"]                 → "Bookkeeping"
 *   ["BOOKKEEPING", "TAX_STRATEGY"] → "Bookkeeping, Tax Planning"
 *   ["BOOKKEEPING", "XYZ"]          → "Bookkeeping, XYZ"
 */
export function formatServiceInterests(serviceInterests: string[]): string {
  if (!serviceInterests || serviceInterests.length === 0) return "";
  return serviceInterests
    .map((s) => SERVICE_INTEREST_LABELS[s] ?? s)
    .join(", ");
}
