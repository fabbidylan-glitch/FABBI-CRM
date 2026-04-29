/**
 * STR underwriting math. Pure functions — no DB, no I/O. Server actions
 * convert Prisma Decimals to numbers before calling in, and convert results
 * back to Decimals before persisting.
 *
 * The calc returns a structured breakdown so the UI can show every input that
 * fed the result. Reps need to defend a number on a call without re-deriving
 * it by hand.
 *
 * Conventions:
 * - Money is plain `number` (USD, two decimals worth of precision).
 * - Rates and ratios are decimal fractions: 0.0725 = 7.25%, 1.25 = 1.25× DSCR.
 * - All calc results are *annual* unless the field name says otherwise.
 */
export const SCENARIO_TYPES = ["CONSERVATIVE", "BASE", "AGGRESSIVE"] as const;
export type ScenarioType = (typeof SCENARIO_TYPES)[number];

/** Subset of STRDeal fields the calc needs. Kept intentionally narrow so unit
 * tests can construct one inline without touching the Prisma client. */
export type CalcInput = {
  // Scenario revenue
  conservativeRevenue: number | null;
  baseRevenue: number | null;
  aggressiveRevenue: number | null;

  // Acquisition
  purchasePrice: number;
  downPaymentPct: number;
  interestRate: number;
  loanTermYears: number;
  interestOnly: boolean;
  closingCosts: number;
  renovationBudget: number;
  furnitureBudget: number;
  initialReserves: number;

  // Operating expenses (annual)
  propertyTaxes: number;
  insurance: number;
  utilities: number;
  internet: number;
  repairsMaintenance: number;
  supplies: number;
  cleaningExpense: number;
  exteriorServices: number;
  hoa: number;
  accounting: number;
  miscExpense: number;
  // Percentage expenses applied to gross revenue
  platformFeesPct: number;
  propertyMgmtPct: number;

  // Targets (used for max-offer math)
  targetCashOnCash: number;
  targetDscr: number;

  // Optional: ADR for break-even calc
  adr: number | null;

  // Custom expense lines, already annualized to USD
  customAnnualExpenses?: number;
};

export type ScenarioMetrics = {
  scenarioType: ScenarioType;
  grossRevenue: number;
  operatingExpenses: number;
  noi: number;
  monthlyMortgage: number;
  annualDebtService: number;
  annualCashFlow: number;
  monthlyCashFlow: number;
  cashOnCash: number;
  capRate: number;
  dscr: number;
  breakEvenOccupancy: number;
  totalCashInvested: number;
  maxOfferByCoc: number | null;
  maxOfferByDscr: number | null;
};

export type CalcResult = {
  scenarios: Record<ScenarioType, ScenarioMetrics>;
  // Shared values that don't vary by scenario.
  loanAmount: number;
  downPayment: number;
  totalCashInvested: number;
  monthlyMortgage: number;
  annualDebtService: number;
  potentialGrossRevenue: number; // ADR × 365 if ADR present, else 0
};

/**
 * Standard amortizing mortgage payment.
 *
 * Formula: M = P * (r * (1+r)^n) / ((1+r)^n - 1)
 *
 * Edge cases:
 * - n <= 0 or P <= 0 → 0
 * - r === 0 → P / n (interest-free)
 * - interestOnly → P * r (monthly interest only, principal due at term end)
 */
export function monthlyMortgagePayment(
  loanAmount: number,
  annualInterestRate: number,
  loanTermYears: number,
  interestOnly: boolean = false
): number {
  if (loanAmount <= 0 || loanTermYears <= 0) return 0;
  const r = annualInterestRate / 12;
  if (interestOnly) return loanAmount * r;
  const n = loanTermYears * 12;
  if (r === 0) return loanAmount / n;
  const factor = Math.pow(1 + r, n);
  return loanAmount * (r * factor) / (factor - 1);
}

/** Annualized debt service per dollar of loan principal. Useful for solving
 * back from a target metric (max-offer math) without re-running the full
 * mortgage formula for every candidate price. */
function annualDebtServiceFactor(
  annualInterestRate: number,
  loanTermYears: number,
  interestOnly: boolean
): number {
  return monthlyMortgagePayment(1, annualInterestRate, loanTermYears, interestOnly) * 12;
}

function totalCashInvested(input: CalcInput): number {
  const downPayment = input.purchasePrice * input.downPaymentPct;
  return (
    downPayment +
    input.closingCosts +
    input.renovationBudget +
    input.furnitureBudget +
    input.initialReserves
  );
}

/** Operating expenses for a given gross revenue. Splits flat expenses from
 * percentage-of-revenue expenses (platform + property management) so the
 * break-even and max-offer solvers can use them cleanly. */
function operatingExpenseBreakdown(input: CalcInput, grossRevenue: number) {
  const flat =
    input.propertyTaxes +
    input.insurance +
    input.utilities +
    input.internet +
    input.repairsMaintenance +
    input.supplies +
    input.cleaningExpense +
    input.exteriorServices +
    input.hoa +
    input.accounting +
    input.miscExpense +
    (input.customAnnualExpenses ?? 0);
  const variableRate = input.platformFeesPct + input.propertyMgmtPct;
  const variable = grossRevenue * variableRate;
  return { flat, variable, variableRate, total: flat + variable };
}

/**
 * Break-even occupancy: the occupancy rate at which annual revenue equals
 * total annual costs (operating + debt service). Computed against potential
 * gross revenue at 100% occupancy (ADR × 365). If ADR is missing, returns 0.
 *
 * Solves for occ in:
 *   occ * potentialGross * (1 - variableRate) = flatExpenses + debtService
 */
function breakEvenOccupancy(
  input: CalcInput,
  flatExpenses: number,
  variableRate: number,
  annualDebtService: number,
  potentialGross: number
): number {
  if (!potentialGross || potentialGross <= 0) return 0;
  const denominator = potentialGross * (1 - variableRate);
  if (denominator <= 0) return 0;
  const required = flatExpenses + annualDebtService;
  return required / denominator;
}

/**
 * Max purchase price that still hits the target cash-on-cash return.
 *
 * Let:
 *   P = purchase price (unknown)
 *   A = NOI (independent of P given fixed revenue/op-ex assumptions)
 *   B = (1 - downPaymentPct) × annualDebtServiceFactor — debt service per $ of P
 *   C = downPaymentPct — cash equity per $ of P
 *   D = closingCosts + renovationBudget + furnitureBudget + initialReserves
 *
 * cashOnCash(P) = (A - P·B) / (P·C + D)
 *
 * Setting this equal to target t and solving:
 *   P = (A - D·t) / (t·C + B)
 *
 * Returns null if NOI is non-positive (no price makes the math work) or if
 * the target is unattainable (denominator non-positive, or P <= 0).
 */
function solveMaxOfferByCoc(
  noi: number,
  input: CalcInput
): number | null {
  if (noi <= 0) return null;
  const t = input.targetCashOnCash;
  const B = (1 - input.downPaymentPct) * annualDebtServiceFactor(
    input.interestRate,
    input.loanTermYears,
    input.interestOnly
  );
  const C = input.downPaymentPct;
  const D =
    input.closingCosts +
    input.renovationBudget +
    input.furnitureBudget +
    input.initialReserves;
  const numerator = noi - D * t;
  const denominator = t * C + B;
  if (denominator <= 0) return null;
  const price = numerator / denominator;
  return price > 0 ? price : null;
}

/**
 * Max purchase price that still hits the target DSCR.
 *
 * DSCR = NOI / annualDebtService
 * annualDebtService = P * (1 - downPaymentPct) * dsf
 *   where dsf = annualDebtServiceFactor(rate, term, interestOnly)
 *
 * So: target = NOI / (P × (1 - downPaymentPct) × dsf)
 *     P     = NOI / (target × (1 - downPaymentPct) × dsf)
 */
function solveMaxOfferByDscr(noi: number, input: CalcInput): number | null {
  if (noi <= 0) return null;
  const dsf = annualDebtServiceFactor(
    input.interestRate,
    input.loanTermYears,
    input.interestOnly
  );
  const denominator = input.targetDscr * (1 - input.downPaymentPct) * dsf;
  if (denominator <= 0) return null;
  return noi / denominator;
}

function pickRevenue(input: CalcInput, scenario: ScenarioType): number {
  if (scenario === "CONSERVATIVE") return input.conservativeRevenue ?? 0;
  if (scenario === "AGGRESSIVE") return input.aggressiveRevenue ?? 0;
  return input.baseRevenue ?? 0;
}

function computeScenario(
  input: CalcInput,
  scenario: ScenarioType,
  shared: {
    loanAmount: number;
    monthlyMortgage: number;
    annualDebtService: number;
    totalCashInvested: number;
    potentialGrossRevenue: number;
  }
): ScenarioMetrics {
  const grossRevenue = pickRevenue(input, scenario);
  const opex = operatingExpenseBreakdown(input, grossRevenue);
  const noi = grossRevenue - opex.total;
  const annualCashFlow = noi - shared.annualDebtService;
  const cashOnCash =
    shared.totalCashInvested > 0 ? annualCashFlow / shared.totalCashInvested : 0;
  const capRate = input.purchasePrice > 0 ? noi / input.purchasePrice : 0;
  const dscr = shared.annualDebtService > 0 ? noi / shared.annualDebtService : 0;
  const breakEven = breakEvenOccupancy(
    input,
    opex.flat,
    opex.variableRate,
    shared.annualDebtService,
    shared.potentialGrossRevenue
  );

  return {
    scenarioType: scenario,
    grossRevenue,
    operatingExpenses: opex.total,
    noi,
    monthlyMortgage: shared.monthlyMortgage,
    annualDebtService: shared.annualDebtService,
    annualCashFlow,
    monthlyCashFlow: annualCashFlow / 12,
    cashOnCash,
    capRate,
    dscr,
    breakEvenOccupancy: breakEven,
    totalCashInvested: shared.totalCashInvested,
    maxOfferByCoc: solveMaxOfferByCoc(noi, input),
    maxOfferByDscr: solveMaxOfferByDscr(noi, input),
  };
}

/** Compute all three scenarios for a deal in one pass. The shared fields
 * (loan amount, debt service, cash invested) don't vary by scenario, so we
 * compute them once and feed them into each scenario branch. */
export function computeUnderwriting(input: CalcInput): CalcResult {
  const downPayment = input.purchasePrice * input.downPaymentPct;
  const loanAmount = Math.max(0, input.purchasePrice - downPayment);
  const monthlyMortgage = monthlyMortgagePayment(
    loanAmount,
    input.interestRate,
    input.loanTermYears,
    input.interestOnly
  );
  const annualDebtService = monthlyMortgage * 12;
  const totalCash = totalCashInvested(input);
  const potentialGrossRevenue = (input.adr ?? 0) * 365;

  const shared = {
    loanAmount,
    monthlyMortgage,
    annualDebtService,
    totalCashInvested: totalCash,
    potentialGrossRevenue,
  };

  return {
    scenarios: {
      CONSERVATIVE: computeScenario(input, "CONSERVATIVE", shared),
      BASE: computeScenario(input, "BASE", shared),
      AGGRESSIVE: computeScenario(input, "AGGRESSIVE", shared),
    },
    loanAmount,
    downPayment,
    totalCashInvested: totalCash,
    monthlyMortgage,
    annualDebtService,
    potentialGrossRevenue,
  };
}
