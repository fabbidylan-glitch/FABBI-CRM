import { describe, expect, it } from "vitest";
import { calculatePricing } from "@/lib/pricing/calculate";
import { SCOPING_DEFAULTS } from "@/lib/pricing/scoping";

describe("calculatePricing — baseline", () => {
  it("defaults give a sane starting price", () => {
    const r = calculatePricing(SCOPING_DEFAULTS);
    expect(r.monthlyRecommended).toBeGreaterThan(300);
    expect(r.monthlyRecommended).toBeLessThan(700);
    expect(r.monthlyFloor).toBeLessThan(r.monthlyRecommended);
    expect(r.monthlyStretch).toBeGreaterThan(r.monthlyRecommended);
    expect(r.complexityLevel).toBe("SIMPLE");
  });

  it("floor is ~85% and stretch is ~120% of recommended", () => {
    const r = calculatePricing({
      ...SCOPING_DEFAULTS,
      monthlyTxnVolume: 400, // push recommended higher to make rounding insignificant
    });
    expect(r.monthlyFloor / r.monthlyRecommended).toBeCloseTo(0.85, 1);
    expect(r.monthlyStretch / r.monthlyRecommended).toBeCloseTo(1.2, 1);
  });
});

describe("calculatePricing — transaction volume", () => {
  it("50 txns included, 150 adds one tier ($50)", () => {
    const r50 = calculatePricing({ ...SCOPING_DEFAULTS, monthlyTxnVolume: 50 });
    const r150 = calculatePricing({ ...SCOPING_DEFAULTS, monthlyTxnVolume: 150 });
    expect(r150.monthlyRecommended - r50.monthlyRecommended).toBe(50);
  });

  it("high volume pushes complexity to COMPLEX", () => {
    const r = calculatePricing({ ...SCOPING_DEFAULTS, monthlyTxnVolume: 800 });
    expect(r.complexityScore).toBeGreaterThanOrEqual(2);
  });
});

describe("calculatePricing — add-ons", () => {
  it("payroll flag adds base + per-employee cost", () => {
    const without = calculatePricing(SCOPING_DEFAULTS);
    const withPayroll = calculatePricing({
      ...SCOPING_DEFAULTS,
      payroll: true,
      payrollEmployees: 10,
    });
    // 150 base + 10 × 10 = 250 delta before rounding
    expect(withPayroll.monthlyRecommended - without.monthlyRecommended).toBe(250);
  });

  it("sales tax with 3 states = 100 + 2×50 = 200", () => {
    const r = calculatePricing({
      ...SCOPING_DEFAULTS,
      salesTax: true,
      salesTaxStates: 3,
    });
    const base = calculatePricing(SCOPING_DEFAULTS);
    expect(r.monthlyRecommended - base.monthlyRecommended).toBe(200);
  });
});

describe("calculatePricing — one-time work", () => {
  it("cleanup months add to onetimeTotal, not monthly", () => {
    const r = calculatePricing({ ...SCOPING_DEFAULTS, cleanupMonths: 6 });
    expect(r.catchupQuote).toBeGreaterThan(0);
    expect(r.onetimeTotal).toBe(r.catchupQuote + r.taxQuote);
    const base = calculatePricing(SCOPING_DEFAULTS);
    expect(r.monthlyRecommended).toBe(base.monthlyRecommended); // monthly unchanged
  });

  it("multi-entity tax scope costs more than 1040", () => {
    const personal = calculatePricing({
      ...SCOPING_DEFAULTS,
      taxScope: "PERSONAL_1040",
    });
    const multi = calculatePricing({ ...SCOPING_DEFAULTS, taxScope: "MULTI_ENTITY" });
    expect(multi.taxQuote).toBeGreaterThan(personal.taxQuote);
  });
});

describe("calculatePricing — complexity ladder", () => {
  it("a messy high-volume multi-entity STR hits VERY_COMPLEX", () => {
    const r = calculatePricing({
      ...SCOPING_DEFAULTS,
      industry: "STR",
      entityCount: 4,
      monthlyTxnVolume: 800,
      payroll: true,
      payrollEmployees: 5,
      salesTax: true,
      salesTaxStates: 5,
      inventory: true,
      classLocationTracking: true,
      multiStateOperations: 3,
      cleanupMonths: 12,
      taxScope: "MULTI_ENTITY",
      advisoryLevel: "FRACTIONAL_CFO",
    });
    expect(r.complexityLevel).toBe("VERY_COMPLEX");
    expect(r.monthlyRecommended).toBeGreaterThan(2000);
  });
});

describe("calculatePricing — line items", () => {
  it("always includes a MONTHLY_BOOKKEEPING line", () => {
    const r = calculatePricing(SCOPING_DEFAULTS);
    const bk = r.lineItems.find((li) => li.kind === "MONTHLY_BOOKKEEPING");
    expect(bk).toBeDefined();
    expect(bk?.monthly).toBeGreaterThan(0);
  });

  it("bookkeeping + add-ons sum to monthly recommended", () => {
    const r = calculatePricing({
      ...SCOPING_DEFAULTS,
      payroll: true,
      payrollEmployees: 2,
      salesTax: true,
      salesTaxStates: 2,
    });
    const monthlySum = r.lineItems
      .filter(
        (li) =>
          li.kind === "MONTHLY_BOOKKEEPING" || li.kind === "MONTHLY_ADDON"
      )
      .reduce((sum, li) => sum + (li.monthly ?? 0), 0);
    expect(monthlySum).toBe(r.monthlyRecommended);
  });
});
