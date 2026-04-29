import { describe, expect, it } from "vitest";
import { scoreDeal, SCORE_WEIGHTS, type ScoreInput } from "@/lib/str/score";

function baseScoreInput(overrides: Partial<ScoreInput> = {}): ScoreInput {
  return {
    cashOnCash: 0.10,
    dscr: 1.25,
    targetCashOnCash: 0.10,
    targetDscr: 1.25,
    revenueConfidence: 7,
    compQuality: 7,
    marketStrength: 7,
    upgradeUpside: 7,
    regulatoryRisk: 3,
    maintenanceComplexity: 3,
    financingRisk: 3,
    ...overrides,
  };
}

describe("SCORE_WEIGHTS", () => {
  it("weights sum to exactly 1.00", () => {
    const sum = Object.values(SCORE_WEIGHTS).reduce((s, w) => s + w, 0);
    expect(sum).toBeCloseTo(1.0, 9);
  });

  it("CoC and DSCR carry the heaviest weight", () => {
    const sortedWeights = Object.entries(SCORE_WEIGHTS).sort((a, b) => b[1] - a[1]);
    expect(sortedWeights[0][0]).toBe("cashOnCash");
    expect(sortedWeights[1][0]).toBe("dscr");
  });
});

describe("scoreDeal — decision thresholds", () => {
  it("a strong deal lands in STRONG_BUY", () => {
    const r = scoreDeal(
      baseScoreInput({
        cashOnCash: 0.18, // exceeds 1.2× target → saturates to 1.0
        dscr: 1.80,
        revenueConfidence: 9,
        compQuality: 9,
        marketStrength: 9,
        upgradeUpside: 9,
        regulatoryRisk: 1,
        maintenanceComplexity: 1,
        financingRisk: 1,
      })
    );
    expect(r.score).toBeGreaterThanOrEqual(80);
    expect(r.decision).toBe("STRONG_BUY");
  });

  it("a marginal deal lands in WEAK", () => {
    // CoC and DSCR at half target; ratings near neutral.
    const r = scoreDeal(
      baseScoreInput({
        cashOnCash: 0.05,
        dscr: 0.9,
        revenueConfidence: 5,
        compQuality: 5,
        marketStrength: 5,
        upgradeUpside: 5,
        regulatoryRisk: 5,
        maintenanceComplexity: 5,
        financingRisk: 5,
      })
    );
    expect(r.decision).toBe("WEAK");
  });

  it("a bad deal is a PASS", () => {
    const r = scoreDeal(
      baseScoreInput({
        cashOnCash: -0.02,
        dscr: 0.5,
        revenueConfidence: 2,
        compQuality: 2,
        marketStrength: 2,
        upgradeUpside: 2,
        regulatoryRisk: 9,
        maintenanceComplexity: 9,
        financingRisk: 9,
      })
    );
    expect(r.score).toBeLessThan(50);
    expect(r.decision).toBe("PASS");
  });
});

describe("scoreDeal — component breakdown", () => {
  it("returns one component per weight", () => {
    const r = scoreDeal(baseScoreInput());
    expect(r.components).toHaveLength(Object.keys(SCORE_WEIGHTS).length);
  });

  it("each component's weighted value equals raw × weight", () => {
    const r = scoreDeal(baseScoreInput());
    for (const c of r.components) {
      expect(c.weighted).toBeCloseTo(c.raw * c.weight, 9);
    }
  });

  it("weighted components sum (×100) to the final score", () => {
    const r = scoreDeal(baseScoreInput());
    const sum = r.components.reduce((s, c) => s + c.weighted, 0) * 100;
    expect(Math.round(sum)).toBe(r.score);
  });
});

describe("scoreDeal — input direction", () => {
  it("higher revenue confidence increases the score", () => {
    const lo = scoreDeal(baseScoreInput({ revenueConfidence: 1 }));
    const hi = scoreDeal(baseScoreInput({ revenueConfidence: 10 }));
    expect(hi.score).toBeGreaterThan(lo.score);
  });

  it("higher regulatory risk decreases the score (inverted)", () => {
    const lo = scoreDeal(baseScoreInput({ regulatoryRisk: 1 }));
    const hi = scoreDeal(baseScoreInput({ regulatoryRisk: 10 }));
    expect(lo.score).toBeGreaterThan(hi.score);
  });

  it("CoC at 1.2× target saturates the component", () => {
    const r = scoreDeal(
      baseScoreInput({ cashOnCash: 0.20, targetCashOnCash: 0.10 })
    );
    const cocComp = r.components.find((c) => c.label.startsWith("Cash-on-cash"));
    expect(cocComp?.raw).toBeCloseTo(1.0, 6);
  });
});

describe("scoreDeal — robustness", () => {
  it("non-finite quantitative inputs do not produce NaN scores", () => {
    const r = scoreDeal(
      baseScoreInput({ cashOnCash: NaN, dscr: Infinity })
    );
    expect(Number.isFinite(r.score)).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it("negative target rates fall back gracefully (no divide-by-zero)", () => {
    const r = scoreDeal(
      baseScoreInput({ targetCashOnCash: 0, targetDscr: 0 })
    );
    expect(Number.isFinite(r.score)).toBe(true);
  });
});
