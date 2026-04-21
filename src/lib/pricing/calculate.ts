import type { ScopingInput } from "./scoping";

/**
 * Rules-based pricing v1. Pure function — deterministic, fast, and cheap to
 * unit-test. No DB access here; `PricingRule` rows exist in the schema but
 * aren't wired into the calc yet (Phase 2 will let ops tune weights without a
 * deploy). For now the rates are inline constants you can read top-to-bottom.
 *
 * The calc returns a structured breakdown so the UI can show WHY a number came
 * out the way it did — reps need to defend pricing on calls.
 */

export type LineItem = {
  kind:
    | "MONTHLY_BOOKKEEPING"
    | "MONTHLY_TAX"
    | "MONTHLY_ADVISORY"
    | "MONTHLY_ADDON"
    | "ONETIME_CLEANUP"
    | "ONETIME_TAX_RETURN"
    | "ONETIME_SETUP"
    | "ONETIME_OTHER";
  description: string;
  monthly?: number;
  onetime?: number;
};

export type PricingBreakdown = {
  complexityLevel: "SIMPLE" | "STANDARD" | "COMPLEX" | "VERY_COMPLEX";
  complexityScore: number;
  monthlyRecommended: number;
  monthlyFloor: number;
  monthlyStretch: number;
  onetimeTotal: number;
  catchupQuote: number;
  taxQuote: number;
  advisoryMonthly: number;
  lineItems: LineItem[];
  /** Ordered, human-readable log of how the monthly recommended was built. */
  buildLog: Array<{ label: string; amount: number }>;
};

// Round to nearest $5 so quotes don't look algorithmic.
function round5(n: number): number {
  return Math.round(n / 5) * 5;
}

export function calculatePricing(input: ScopingInput): PricingBreakdown {
  const log: Array<{ label: string; amount: number }> = [];
  const lineItems: LineItem[] = [];

  // ── Base fee ───────────────────────────────────────────────────────────────
  const BASE = 450;
  let monthly = BASE;
  log.push({ label: "Base bookkeeping", amount: BASE });

  // ── Transaction volume ─────────────────────────────────────────────────────
  // First 50 txns included; $50 per 100 after that.
  const extraTxns = Math.max(0, input.monthlyTxnVolume - 50);
  const txnCost = Math.ceil(extraTxns / 100) * 50;
  if (txnCost > 0) {
    monthly += txnCost;
    log.push({ label: `Transaction volume (${input.monthlyTxnVolume}/mo)`, amount: txnCost });
  }

  // ── Additional entities ────────────────────────────────────────────────────
  if (input.entityCount > 1) {
    const entityCost = (input.entityCount - 1) * 150;
    monthly += entityCost;
    log.push({
      label: `Additional entities (+${input.entityCount - 1})`,
      amount: entityCost,
    });
  }

  // ── Account count ──────────────────────────────────────────────────────────
  // First 3 combined accounts (bank + CC) included; $15 per account over.
  const totalAccounts = input.bankAccounts + input.creditCardAccounts;
  const extraAccounts = Math.max(0, totalAccounts - 3);
  if (extraAccounts > 0) {
    const cost = extraAccounts * 15;
    monthly += cost;
    log.push({ label: `Extra accounts (+${extraAccounts})`, amount: cost });
  }

  // ── Payroll ────────────────────────────────────────────────────────────────
  if (input.payroll) {
    const payrollCost = 150 + input.payrollEmployees * 10;
    monthly += payrollCost;
    log.push({ label: `Payroll (${input.payrollEmployees} emp.)`, amount: payrollCost });
    lineItems.push({
      kind: "MONTHLY_ADDON",
      description: `Payroll oversight — ${input.payrollEmployees} employees`,
      monthly: payrollCost,
    });
  }

  // ── Sales tax ──────────────────────────────────────────────────────────────
  if (input.salesTax) {
    const states = Math.max(1, input.salesTaxStates);
    const salesTaxCost = 100 + (states - 1) * 50;
    monthly += salesTaxCost;
    log.push({ label: `Sales tax (${states} state${states > 1 ? "s" : ""})`, amount: salesTaxCost });
    lineItems.push({
      kind: "MONTHLY_ADDON",
      description: `Sales tax compliance — ${states} state${states > 1 ? "s" : ""}`,
      monthly: salesTaxCost,
    });
  }

  // ── AP/AR ──────────────────────────────────────────────────────────────────
  if (input.apArTracking) {
    monthly += 125;
    log.push({ label: "AP/AR tracking", amount: 125 });
    lineItems.push({ kind: "MONTHLY_ADDON", description: "AP / AR tracking", monthly: 125 });
  }

  // ── Inventory ──────────────────────────────────────────────────────────────
  if (input.inventory) {
    monthly += 200;
    log.push({ label: "Inventory tracking", amount: 200 });
    lineItems.push({ kind: "MONTHLY_ADDON", description: "Inventory tracking", monthly: 200 });
  }

  // ── Class/location ─────────────────────────────────────────────────────────
  if (input.classLocationTracking) {
    monthly += 75;
    log.push({ label: "Class / location tracking", amount: 75 });
  }

  // ── Multi-state (operational, not sales tax) ──────────────────────────────
  if (input.multiStateOperations > 1) {
    const cost = (input.multiStateOperations - 1) * 40;
    monthly += cost;
    log.push({ label: `Multi-state ops (+${input.multiStateOperations - 1})`, amount: cost });
  }

  // ── Niche/industry multiplier ──────────────────────────────────────────────
  const nicheBump: Record<string, number> = {
    STR: 1.12,
    REAL_ESTATE: 1.1,
    ECOMMERCE: 1.08,
    CONSTRUCTION: 1.05,
    RESTAURANT: 1.05,
  };
  const mult = nicheBump[input.industry];
  if (mult) {
    const before = monthly;
    monthly = monthly * mult;
    log.push({ label: `Niche complexity (${input.industry}) ×${mult}`, amount: monthly - before });
  }

  // ── Advisory (separate line, not multiplier) ───────────────────────────────
  const advisoryRates = {
    NONE: 0,
    QUARTERLY: 500,
    MONTHLY: 1500,
    FRACTIONAL_CFO: 3500,
  } as const;
  const advisoryMonthly = advisoryRates[input.advisoryLevel];
  if (advisoryMonthly > 0) {
    lineItems.push({
      kind: "MONTHLY_ADVISORY",
      description: `Advisory — ${input.advisoryLevel.replaceAll("_", " ").toLowerCase()}`,
      monthly: advisoryMonthly,
    });
  }

  // ── One-time: catch-up cleanup ─────────────────────────────────────────────
  // $500 base + $225/month behind (rounded).
  const catchupQuote =
    input.cleanupMonths > 0 ? round5(500 + input.cleanupMonths * 225) : 0;
  if (catchupQuote > 0) {
    lineItems.push({
      kind: "ONETIME_CLEANUP",
      description: `Catch-up bookkeeping — ${input.cleanupMonths} months`,
      onetime: catchupQuote,
    });
  }

  // ── One-time: tax prep ─────────────────────────────────────────────────────
  const taxRates = {
    NONE: 0,
    PERSONAL_1040: 650,
    BUSINESS_RETURN: 1500,
    PERSONAL_PLUS_BUSINESS: 1950,
    MULTI_ENTITY: 3500,
  } as const;
  const taxQuote = taxRates[input.taxScope];
  if (taxQuote > 0) {
    lineItems.push({
      kind: "ONETIME_TAX_RETURN",
      description: `Tax prep — ${input.taxScope.replaceAll("_", " ").toLowerCase()}`,
      onetime: taxQuote,
    });
  }

  // ── Finalize monthly tiers ────────────────────────────────────────────────
  const monthlyRecommended = round5(monthly);
  const monthlyFloor = round5(monthly * 0.85);
  const monthlyStretch = round5(monthly * 1.2);

  // The core bookkeeping line = recommended minus the explicit add-on lines
  // (advisory is priced separately and NOT part of `monthly`).
  const addonTotal = lineItems
    .filter((li) => li.kind === "MONTHLY_ADDON")
    .reduce((sum, li) => sum + (li.monthly ?? 0), 0);
  lineItems.unshift({
    kind: "MONTHLY_BOOKKEEPING",
    description: "Monthly bookkeeping + accounting",
    monthly: monthlyRecommended - addonTotal,
  });

  const onetimeTotal = catchupQuote + taxQuote;

  // ── Complexity classification ─────────────────────────────────────────────
  // A quick scoring for the UI's complexity pill.
  let complexityScore = 0;
  if (input.entityCount > 2) complexityScore += 2;
  else if (input.entityCount > 1) complexityScore += 1;
  if (input.monthlyTxnVolume > 500) complexityScore += 2;
  else if (input.monthlyTxnVolume > 200) complexityScore += 1;
  if (input.payroll) complexityScore += 1;
  if (input.salesTax) complexityScore += 1;
  if (input.inventory) complexityScore += 1;
  if (input.classLocationTracking) complexityScore += 1;
  if (input.multiStateOperations > 1) complexityScore += 1;
  if (input.cleanupMonths > 6) complexityScore += 2;
  else if (input.cleanupMonths > 0) complexityScore += 1;
  if (input.taxScope === "MULTI_ENTITY") complexityScore += 2;
  if (input.advisoryLevel === "FRACTIONAL_CFO") complexityScore += 1;

  const complexityLevel: PricingBreakdown["complexityLevel"] =
    complexityScore <= 1
      ? "SIMPLE"
      : complexityScore <= 4
        ? "STANDARD"
        : complexityScore <= 7
          ? "COMPLEX"
          : "VERY_COMPLEX";

  return {
    complexityLevel,
    complexityScore,
    monthlyRecommended,
    monthlyFloor,
    monthlyStretch,
    onetimeTotal,
    catchupQuote,
    taxQuote,
    advisoryMonthly,
    lineItems,
    buildLog: log,
  };
}
