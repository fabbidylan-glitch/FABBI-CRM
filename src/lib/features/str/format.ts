/**
 * Display helpers for the STR module. Pure formatting functions only — no DB
 * or React in here. Server components import these to format Prisma values
 * before passing to client components.
 */

export type DecisionLabel =
  | "STRONG_BUY"
  | "BUY_NEGOTIATE"
  | "WEAK"
  | "PASS"
  | null;

export type StatusLabel =
  | "NEW"
  | "RESEARCHING"
  | "UNDERWRITING"
  | "OFFER_MADE"
  | "UNDER_CONTRACT"
  | "PASSED"
  | "ACQUIRED";

/** Tailwind classes for the colored decision badge. The lookup is a static
 * record so Tailwind's JIT can see the literals at build time. */
export const DECISION_CLASSES: Record<NonNullable<DecisionLabel>, string> = {
  STRONG_BUY: "bg-emerald-50 text-emerald-700 ring-emerald-200/80",
  BUY_NEGOTIATE: "bg-sky-50 text-sky-700 ring-sky-200/80",
  WEAK: "bg-amber-50 text-amber-800 ring-amber-200/80",
  PASS: "bg-rose-50 text-rose-700 ring-rose-200/80",
};

export const DECISION_LABEL: Record<NonNullable<DecisionLabel>, string> = {
  STRONG_BUY: "Strong buy",
  BUY_NEGOTIATE: "Buy / negotiate",
  WEAK: "Weak",
  PASS: "Pass",
};

export const STATUS_LABEL: Record<StatusLabel, string> = {
  NEW: "New",
  RESEARCHING: "Researching",
  UNDERWRITING: "Underwriting",
  OFFER_MADE: "Offer made",
  UNDER_CONTRACT: "Under contract",
  PASSED: "Passed",
  ACQUIRED: "Acquired",
};

const usd0 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const usd2 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMoney(n: number | null | undefined, opts?: { decimals?: 0 | 2 }): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const fmt = opts?.decimals === 2 ? usd2 : usd0;
  return fmt.format(n);
}

export function formatPercent(n: number | null | undefined, fractionDigits = 1): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(fractionDigits)}%`;
}

export function formatRatio(n: number | null | undefined, fractionDigits = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return `${n.toFixed(fractionDigits)}×`;
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Display name combining city/state, falling back to market or em-dash. */
export function formatLocation(
  market: string | null,
  city: string | null,
  state: string | null
): string {
  if (city && state) return `${city}, ${state}`;
  if (market) return market;
  if (state) return state;
  return "—";
}
