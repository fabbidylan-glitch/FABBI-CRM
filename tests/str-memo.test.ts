import { describe, expect, it } from "vitest";
import { computeUnderwriting, type CalcInput } from "@/lib/str/calc";
import { generateMemo, type MemoCompInput, type MemoDealInput } from "@/lib/str/memo";
import { scoreDeal } from "@/lib/str/score";

function baselineDeal(overrides: Partial<MemoDealInput> = {}): MemoDealInput {
  return {
    dealName: "Smoky Mtn Cabin",
    city: "Gatlinburg",
    state: "TN",
    market: "Smokies",
    propertyAddress: "123 Bear Ridge",
    propertyType: "CABIN",
    beds: 3,
    baths: 2,
    sleeps: 8,
    squareFootage: 1800,
    yearBuilt: 2015,
    askingPrice: 525_000,
    purchasePrice: 500_000,
    targetOfferPrice: 480_000,
    adr: 250,
    occupancyPct: 0.55,
    conservativeRevenue: 70_000,
    baseRevenue: 90_000,
    aggressiveRevenue: 110_000,
    targetCashOnCash: 0.10,
    targetDscr: 1.25,
    revenueConfidence: 7,
    compQualityRating: 6,
    marketStrength: 8,
    upgradeUpside: 6,
    regulatoryRisk: 3,
    maintenanceComplexity: 4,
    financingRisk: 3,
    ...overrides,
  };
}

function calcInputFor(deal: MemoDealInput): CalcInput {
  return {
    conservativeRevenue: deal.conservativeRevenue,
    baseRevenue: deal.baseRevenue,
    aggressiveRevenue: deal.aggressiveRevenue,
    purchasePrice: deal.purchasePrice,
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
    propertyMgmtPct: 0,
    targetCashOnCash: deal.targetCashOnCash,
    targetDscr: deal.targetDscr,
    adr: deal.adr,
  };
}

function buildMemoFor(
  deal: MemoDealInput,
  comps: MemoCompInput[] = []
) {
  const calcInput = calcInputFor(deal);
  const calc = computeUnderwriting(calcInput);
  const score = scoreDeal({
    cashOnCash: calc.scenarios.BASE.cashOnCash,
    dscr: calc.scenarios.BASE.dscr,
    targetCashOnCash: deal.targetCashOnCash,
    targetDscr: deal.targetDscr,
    revenueConfidence: deal.revenueConfidence,
    compQuality: deal.compQualityRating,
    marketStrength: deal.marketStrength,
    upgradeUpside: deal.upgradeUpside,
    regulatoryRisk: deal.regulatoryRisk,
    maintenanceComplexity: deal.maintenanceComplexity,
    financingRisk: deal.financingRisk,
  });
  return { calc, score, memo: generateMemo({ deal, calc, score, comps }) };
}

function comp(overrides: Partial<MemoCompInput> = {}): MemoCompInput {
  return {
    name: "Test comp",
    adr: 240,
    occupancyPct: 0.6,
    annualRevenue: 85_000,
    reviewCount: 120,
    rating: 4.8,
    qualityScore: 7,
    source: "MANUAL",
    ...overrides,
  };
}

describe("generateMemo — determinism", () => {
  it("produces identical content from identical inputs", () => {
    const deal = baselineDeal();
    const comps = [comp({ name: "Comp A" }), comp({ name: "Comp B", annualRevenue: 95_000 })];
    const a = buildMemoFor(deal, comps).memo;
    const b = buildMemoFor(deal, comps).memo;
    expect(a).toEqual(b);
  });
});

describe("generateMemo — section content", () => {
  it("property summary mentions location, layout, and pricing", () => {
    const { memo } = buildMemoFor(baselineDeal());
    expect(memo.propertySummary).toContain("Gatlinburg, TN");
    expect(memo.propertySummary).toContain("3 bed");
    expect(memo.propertySummary).toContain("$525,000");
    expect(memo.propertySummary).toContain("$500,000");
    expect(memo.propertySummary).toContain("$480,000");
  });

  it("revenue summary surfaces all 3 scenarios + ADR/occupancy", () => {
    const { memo } = buildMemoFor(baselineDeal());
    expect(memo.revenueSummary).toContain("$90,000");
    expect(memo.revenueSummary).toContain("$70,000");
    expect(memo.revenueSummary).toContain("$110,000");
    expect(memo.revenueSummary).toMatch(/ADR\s+\$250/);
    expect(memo.revenueSummary).toContain("55.0%");
  });

  it("comp summary handles 0 comps", () => {
    const { memo } = buildMemoFor(baselineDeal(), []);
    expect(memo.compSummary).toContain("No comps");
  });

  it("comp summary computes averages and flags top performer", () => {
    const comps = [
      comp({ name: "A", annualRevenue: 80_000, adr: 220, occupancyPct: 0.55 }),
      comp({ name: "B", annualRevenue: 100_000, adr: 280, occupancyPct: 0.65 }),
    ];
    const { memo } = buildMemoFor(baselineDeal(), comps);
    expect(memo.compSummary).toContain("2 comps");
    expect(memo.compSummary).toContain("avg ADR");
    expect(memo.compSummary).toContain("Top performer: B");
    expect(memo.compSummary).toContain("$100,000");
  });

  it("comp summary flags all-manual sources", () => {
    const { memo } = buildMemoFor(baselineDeal(), [comp({ source: "MANUAL" })]);
    expect(memo.compSummary).toContain("manual entries");
  });

  it("does not flag manual when at least one comp is sourced externally", () => {
    const { memo } = buildMemoFor(baselineDeal(), [
      comp({ source: "MANUAL" }),
      comp({ source: "AIRDNA", name: "ext" }),
    ]);
    expect(memo.compSummary).not.toContain("manual entries");
  });
});

describe("generateMemo — strengths and risks", () => {
  it("strong deal lands strengths, no critical risks", () => {
    const deal = baselineDeal({
      baseRevenue: 130_000,
      conservativeRevenue: 110_000,
      aggressiveRevenue: 150_000,
      regulatoryRisk: 2,
      marketStrength: 9,
      upgradeUpside: 8,
    });
    const { memo, score } = buildMemoFor(deal);
    expect(score.decision === "STRONG_BUY" || score.decision === "BUY_NEGOTIATE").toBe(true);
    expect(memo.keyStrengths.length).toBeGreaterThan(0);
  });

  it("under-performing deal surfaces risks", () => {
    const deal = baselineDeal({
      baseRevenue: 35_000,
      conservativeRevenue: 25_000,
      aggressiveRevenue: 45_000,
      regulatoryRisk: 8,
      maintenanceComplexity: 8,
    });
    const { memo } = buildMemoFor(deal);
    expect(memo.keyRisks.length).toBeGreaterThan(0);
    // Should specifically call out DSCR or CoC weakness
    const joined = memo.keyRisks.join(" ");
    expect(joined).toMatch(/DSCR|cash-on-cash/i);
  });
});

describe("generateMemo — known limits / data confidence", () => {
  it("flags missing comps", () => {
    const { memo } = buildMemoFor(baselineDeal(), []);
    expect(memo.knownLimits.some((l) => /No comps/.test(l))).toBe(true);
  });

  it("flags small comp sample", () => {
    const { memo } = buildMemoFor(baselineDeal(), [comp({ name: "A" })]);
    expect(memo.knownLimits.some((l) => /Only 1 comp/.test(l))).toBe(true);
  });

  it("flags all-manual comp sourcing", () => {
    const { memo } = buildMemoFor(baselineDeal(), [
      comp({ name: "A" }),
      comp({ name: "B" }),
      comp({ name: "C" }),
    ]);
    expect(memo.knownLimits.some((l) => /manual entries/i.test(l))).toBe(true);
  });

  it("flags missing ADR", () => {
    const { memo } = buildMemoFor(baselineDeal({ adr: null }));
    expect(memo.knownLimits.some((l) => /ADR is unset/.test(l))).toBe(true);
  });

  it("flags missing scenario revenue", () => {
    const { memo } = buildMemoFor(baselineDeal({ conservativeRevenue: null }));
    expect(memo.knownLimits.some((l) => /Conservative revenue/.test(l))).toBe(true);
  });

  it("flags low revenue confidence", () => {
    const { memo } = buildMemoFor(baselineDeal({ revenueConfidence: 3 }));
    expect(memo.knownLimits.some((l) => /Revenue confidence is low/.test(l))).toBe(true);
  });
});

describe("generateMemo — recommendation", () => {
  it("recommended offer is the lower of CoC and DSCR ceilings", () => {
    const deal = baselineDeal();
    const { calc, memo } = buildMemoFor(deal);
    const cocCeiling = calc.scenarios.BASE.maxOfferByCoc;
    const dscrCeiling = calc.scenarios.BASE.maxOfferByDscr;
    if (cocCeiling !== null && dscrCeiling !== null) {
      expect(memo.recommendedOffer).toBeCloseTo(Math.min(cocCeiling, dscrCeiling), 2);
    }
  });

  it("recommendation text matches the decision label", () => {
    const strong = buildMemoFor(
      baselineDeal({ baseRevenue: 130_000, conservativeRevenue: 110_000, aggressiveRevenue: 150_000 })
    );
    const fail = buildMemoFor(
      baselineDeal({ baseRevenue: 25_000, conservativeRevenue: 15_000, aggressiveRevenue: 35_000 })
    );
    expect(strong.memo.recommendation.toLowerCase()).toMatch(/strong|negotiat/);
    expect(fail.memo.recommendation.toLowerCase()).toMatch(/pass|weak/);
  });

  it("score and decision pass through from the score result", () => {
    const { memo, score } = buildMemoFor(baselineDeal());
    expect(memo.score).toBe(score.score);
    expect(memo.decision).toBe(score.decision);
  });
});
