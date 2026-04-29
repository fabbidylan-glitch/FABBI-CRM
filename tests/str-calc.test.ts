import { describe, expect, it } from "vitest";
import {
  computeUnderwriting,
  monthlyMortgagePayment,
  type CalcInput,
} from "@/lib/str/calc";

/**
 * Baseline deal used as a fixture across tests. Numbers chosen to be roughly
 * realistic for a $500k STR with 25% down, 7.25% / 30yr financing, so the
 * resulting metrics fall in plausible ranges (CoC mid-single-digits, DSCR > 1).
 */
function baselineInput(overrides: Partial<CalcInput> = {}): CalcInput {
  return {
    conservativeRevenue: 70_000,
    baseRevenue: 90_000,
    aggressiveRevenue: 110_000,

    purchasePrice: 500_000,
    downPaymentPct: 0.25,
    interestRate: 0.0725,
    loanTermYears: 30,
    interestOnly: false,
    closingCosts: 12_000,
    renovationBudget: 15_000,
    furnitureBudget: 25_000,
    initialReserves: 10_000,

    propertyTaxes: 5_000,
    insurance: 2_400,
    utilities: 3_600,
    internet: 1_200,
    repairsMaintenance: 3_000,
    supplies: 1_500,
    cleaningExpense: 4_000,
    exteriorServices: 2_000,
    hoa: 0,
    accounting: 1_200,
    miscExpense: 800,
    platformFeesPct: 0.03,
    propertyMgmtPct: 0.0,

    targetCashOnCash: 0.10,
    targetDscr: 1.25,
    adr: 250,
    ...overrides,
  };
}

describe("monthlyMortgagePayment", () => {
  it("matches the textbook 30-year fixed payment", () => {
    // $375,000 @ 7.25% / 30yr → $2,558.16 per month (standard amortization)
    const p = monthlyMortgagePayment(375_000, 0.0725, 30, false);
    expect(p).toBeCloseTo(2_558.16, 1);
  });

  it("zero interest rate gives a straight-line payment", () => {
    // $360,000 / 360 months = $1,000 even
    const p = monthlyMortgagePayment(360_000, 0, 30, false);
    expect(p).toBeCloseTo(1_000, 6);
  });

  it("interest-only mode returns just the monthly interest", () => {
    // $400,000 @ 6% interest-only → $2,000/mo
    const p = monthlyMortgagePayment(400_000, 0.06, 30, true);
    expect(p).toBeCloseTo(2_000, 6);
  });

  it("returns 0 for non-positive principal or term", () => {
    expect(monthlyMortgagePayment(0, 0.07, 30, false)).toBe(0);
    expect(monthlyMortgagePayment(-1, 0.07, 30, false)).toBe(0);
    expect(monthlyMortgagePayment(100_000, 0.07, 0, false)).toBe(0);
  });
});

describe("computeUnderwriting — shared values", () => {
  it("derives loan amount, down payment, and total cash invested", () => {
    const r = computeUnderwriting(baselineInput());
    expect(r.downPayment).toBeCloseTo(125_000, 2);
    expect(r.loanAmount).toBeCloseTo(375_000, 2);
    expect(r.totalCashInvested).toBeCloseTo(187_000, 2);
    // Mortgage on $375k @ 7.25%/30yr ≈ $2,558.16 → annual ≈ $30,697.93
    expect(r.monthlyMortgage).toBeCloseTo(2_558.16, 1);
    expect(r.annualDebtService).toBeCloseTo(30_697.93, 0);
  });

  it("potential gross revenue is ADR × 365 when ADR is set", () => {
    const r = computeUnderwriting(baselineInput());
    expect(r.potentialGrossRevenue).toBe(250 * 365);
  });

  it("potential gross revenue is 0 when ADR is null (break-even falls back to 0)", () => {
    const r = computeUnderwriting(baselineInput({ adr: null }));
    expect(r.potentialGrossRevenue).toBe(0);
    expect(r.scenarios.BASE.breakEvenOccupancy).toBe(0);
  });
});

describe("computeUnderwriting — base scenario metrics", () => {
  it("computes NOI = revenue − operating expenses", () => {
    const input = baselineInput();
    const r = computeUnderwriting(input);
    // Flat opex sum: 5000+2400+3600+1200+3000+1500+4000+2000+0+1200+800 = 24,700
    // Variable opex: 90,000 × 0.03 = 2,700
    // Total: 27,400 → NOI = 90,000 - 27,400 = 62,600
    expect(r.scenarios.BASE.operatingExpenses).toBeCloseTo(27_400, 2);
    expect(r.scenarios.BASE.noi).toBeCloseTo(62_600, 2);
  });

  it("annual cash flow = NOI − annual debt service", () => {
    const r = computeUnderwriting(baselineInput());
    expect(r.scenarios.BASE.annualCashFlow).toBeCloseTo(
      r.scenarios.BASE.noi - r.annualDebtService,
      2
    );
  });

  it("monthly cash flow = annual / 12", () => {
    const r = computeUnderwriting(baselineInput());
    expect(r.scenarios.BASE.monthlyCashFlow).toBeCloseTo(
      r.scenarios.BASE.annualCashFlow / 12,
      6
    );
  });

  it("cash-on-cash = annual cash flow / total cash invested", () => {
    const r = computeUnderwriting(baselineInput());
    expect(r.scenarios.BASE.cashOnCash).toBeCloseTo(
      r.scenarios.BASE.annualCashFlow / r.totalCashInvested,
      6
    );
  });

  it("cap rate = NOI / purchase price", () => {
    const r = computeUnderwriting(baselineInput());
    expect(r.scenarios.BASE.capRate).toBeCloseTo(62_600 / 500_000, 6);
  });

  it("DSCR = NOI / annual debt service", () => {
    const r = computeUnderwriting(baselineInput());
    expect(r.scenarios.BASE.dscr).toBeCloseTo(
      r.scenarios.BASE.noi / r.annualDebtService,
      6
    );
  });
});

describe("computeUnderwriting — scenario ordering", () => {
  it("aggressive cash flow > base > conservative when only revenue varies", () => {
    const r = computeUnderwriting(baselineInput());
    expect(r.scenarios.AGGRESSIVE.annualCashFlow).toBeGreaterThan(
      r.scenarios.BASE.annualCashFlow
    );
    expect(r.scenarios.BASE.annualCashFlow).toBeGreaterThan(
      r.scenarios.CONSERVATIVE.annualCashFlow
    );
  });

  it("variable expenses scale with revenue (platform fee % applied per scenario)", () => {
    const r = computeUnderwriting(baselineInput());
    expect(r.scenarios.AGGRESSIVE.operatingExpenses).toBeGreaterThan(
      r.scenarios.CONSERVATIVE.operatingExpenses
    );
  });
});

describe("computeUnderwriting — break-even occupancy", () => {
  it("break-even falls between 0 and 1 when costs are within potential revenue", () => {
    const r = computeUnderwriting(baselineInput());
    expect(r.scenarios.BASE.breakEvenOccupancy).toBeGreaterThan(0);
    expect(r.scenarios.BASE.breakEvenOccupancy).toBeLessThan(1);
  });

  it("break-even rises when fixed costs increase", () => {
    const lo = computeUnderwriting(baselineInput({ propertyTaxes: 1_000 }));
    const hi = computeUnderwriting(baselineInput({ propertyTaxes: 20_000 }));
    expect(hi.scenarios.BASE.breakEvenOccupancy).toBeGreaterThan(
      lo.scenarios.BASE.breakEvenOccupancy
    );
  });
});

describe("computeUnderwriting — max offer math", () => {
  it("max offer by CoC equals current price when CoC exactly meets target", () => {
    // Tune target to the actual CoC the baseline produces, then the solver
    // should report ~the current purchase price as the max.
    const base = computeUnderwriting(baselineInput());
    const tuned = computeUnderwriting(
      baselineInput({ targetCashOnCash: base.scenarios.BASE.cashOnCash })
    );
    expect(tuned.scenarios.BASE.maxOfferByCoc).not.toBeNull();
    expect(tuned.scenarios.BASE.maxOfferByCoc!).toBeCloseTo(500_000, -2);
  });

  it("max offer by DSCR is null when NOI is non-positive", () => {
    // Crush revenue below opex → negative NOI
    const r = computeUnderwriting(
      baselineInput({ baseRevenue: 1_000, conservativeRevenue: 1_000, aggressiveRevenue: 1_000 })
    );
    expect(r.scenarios.BASE.maxOfferByDscr).toBeNull();
    expect(r.scenarios.BASE.maxOfferByCoc).toBeNull();
  });

  it("a stricter DSCR target produces a lower max offer", () => {
    const lax = computeUnderwriting(baselineInput({ targetDscr: 1.10 }));
    const strict = computeUnderwriting(baselineInput({ targetDscr: 1.50 }));
    expect(strict.scenarios.BASE.maxOfferByDscr!).toBeLessThan(
      lax.scenarios.BASE.maxOfferByDscr!
    );
  });
});

describe("computeUnderwriting — interest-only toggle", () => {
  it("interest-only payment is lower than amortizing (positive principal)", () => {
    const amortizing = computeUnderwriting(baselineInput({ interestOnly: false }));
    const io = computeUnderwriting(baselineInput({ interestOnly: true }));
    expect(io.monthlyMortgage).toBeLessThan(amortizing.monthlyMortgage);
    expect(io.scenarios.BASE.dscr).toBeGreaterThan(amortizing.scenarios.BASE.dscr);
  });
});

describe("computeUnderwriting — custom annual expenses", () => {
  it("are added to operating expenses on every scenario", () => {
    const baseline = computeUnderwriting(baselineInput());
    const withExtra = computeUnderwriting(baselineInput({ customAnnualExpenses: 5_000 }));
    expect(withExtra.scenarios.BASE.operatingExpenses).toBeCloseTo(
      baseline.scenarios.BASE.operatingExpenses + 5_000,
      2
    );
    expect(withExtra.scenarios.CONSERVATIVE.operatingExpenses).toBeCloseTo(
      baseline.scenarios.CONSERVATIVE.operatingExpenses + 5_000,
      2
    );
  });
});
