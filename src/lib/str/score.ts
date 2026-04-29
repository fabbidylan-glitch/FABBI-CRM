/**
 * STR deal scoring. Pure function that combines computed underwriting metrics
 * (cash-on-cash, DSCR) with qualitative ratings (1–10) the user enters on the
 * deal. Returns a 0–100 score plus a transparent breakdown so the UI can show
 * which components moved the needle.
 *
 * The score → decision thresholds match the spec:
 *   80–100  STRONG_BUY
 *   65–79   BUY_NEGOTIATE
 *   50–64   WEAK
 *   < 50    PASS
 */

export type ScoreDecision = "STRONG_BUY" | "BUY_NEGOTIATE" | "WEAK" | "PASS";

/**
 * Component weights — they sum to 1.00. Tweakable as constants so we can
 * tune by editing one place. Quantitative metrics (CoC, DSCR) carry the most
 * weight; risk inputs are subtractive (higher value → lower score) and small.
 */
export const SCORE_WEIGHTS = {
  cashOnCash: 0.25,
  dscr: 0.20,
  revenueConfidence: 0.15,
  compQuality: 0.10,
  marketStrength: 0.10,
  upgradeUpside: 0.10,
  regulatoryRisk: 0.05,
  maintenanceComplexity: 0.03,
  financingRisk: 0.02,
} as const;

// Sanity: weights must sum to 1. Any drift here is a bug — fail fast at import
// time so a typo shows up in tests rather than silently rebalancing the score.
const WEIGHT_SUM = Object.values(SCORE_WEIGHTS).reduce((s, w) => s + w, 0);
if (Math.abs(WEIGHT_SUM - 1) > 1e-9) {
  throw new Error(`SCORE_WEIGHTS must sum to 1.00; got ${WEIGHT_SUM.toFixed(4)}`);
}

export const DECISION_THRESHOLDS = {
  STRONG_BUY: 80,
  BUY_NEGOTIATE: 65,
  WEAK: 50,
} as const;

/**
 * Quantitative metrics map to [0, 1] relative to the user's targets. Hitting
 * the target gives ~0.83; exceeding it by 20% saturates at 1.0. The sub-target
 * gradient is steep so a deal that barely covers debt (DSCR ≈ 1) scores poorly.
 */
const STRETCH_MULTIPLIER = 1.2;

export type ScoreInput = {
  // Computed metrics (from the BASE scenario, typically)
  cashOnCash: number; // e.g. 0.12 = 12%
  dscr: number;
  // Targets
  targetCashOnCash: number;
  targetDscr: number;
  // Qualitative ratings — 0 to 10 scale, both directions
  revenueConfidence: number; // higher = more confident
  compQuality: number; // higher = better comps
  marketStrength: number;
  upgradeUpside: number;
  regulatoryRisk: number; // higher = riskier (subtractive)
  maintenanceComplexity: number; // higher = more complex (subtractive)
  financingRisk: number; // higher = riskier (subtractive)
};

export type ScoreComponent = {
  label: string;
  weight: number;
  raw: number; // 0–1 normalized
  weighted: number; // raw × weight, contributes to final 0–1
  /** Human-readable explanation of how this component was computed. */
  detail: string;
};

export type ScoreResult = {
  score: number; // 0–100, integer
  decision: ScoreDecision;
  components: ScoreComponent[];
};

function clamp01(n: number): number {
  if (Number.isNaN(n) || !Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/** A 0–10 rating where higher is better. */
function ratingPositive(rating: number): number {
  return clamp01(rating / 10);
}

/** A 0–10 rating where higher is worse — risk inverts. */
function ratingInverted(rating: number): number {
  return clamp01(1 - rating / 10);
}

function scoreCashOnCash(actual: number, target: number): number {
  if (target <= 0) return clamp01(actual);
  return clamp01(actual / (target * STRETCH_MULTIPLIER));
}

function scoreDscr(actual: number, target: number): number {
  if (target <= 0) return clamp01(actual);
  return clamp01(actual / (target * STRETCH_MULTIPLIER));
}

function decisionFor(score: number): ScoreDecision {
  if (score >= DECISION_THRESHOLDS.STRONG_BUY) return "STRONG_BUY";
  if (score >= DECISION_THRESHOLDS.BUY_NEGOTIATE) return "BUY_NEGOTIATE";
  if (score >= DECISION_THRESHOLDS.WEAK) return "WEAK";
  return "PASS";
}

export function scoreDeal(input: ScoreInput): ScoreResult {
  const components: ScoreComponent[] = [
    {
      label: "Cash-on-cash return",
      weight: SCORE_WEIGHTS.cashOnCash,
      raw: scoreCashOnCash(input.cashOnCash, input.targetCashOnCash),
      weighted: 0,
      detail: `${(input.cashOnCash * 100).toFixed(1)}% vs target ${(input.targetCashOnCash * 100).toFixed(1)}%`,
    },
    {
      label: "DSCR",
      weight: SCORE_WEIGHTS.dscr,
      raw: scoreDscr(input.dscr, input.targetDscr),
      weighted: 0,
      detail: `${input.dscr.toFixed(2)}× vs target ${input.targetDscr.toFixed(2)}×`,
    },
    {
      label: "Revenue confidence",
      weight: SCORE_WEIGHTS.revenueConfidence,
      raw: ratingPositive(input.revenueConfidence),
      weighted: 0,
      detail: `${input.revenueConfidence}/10`,
    },
    {
      label: "Comp quality",
      weight: SCORE_WEIGHTS.compQuality,
      raw: ratingPositive(input.compQuality),
      weighted: 0,
      detail: `${input.compQuality}/10`,
    },
    {
      label: "Market strength",
      weight: SCORE_WEIGHTS.marketStrength,
      raw: ratingPositive(input.marketStrength),
      weighted: 0,
      detail: `${input.marketStrength}/10`,
    },
    {
      label: "Upgrade upside",
      weight: SCORE_WEIGHTS.upgradeUpside,
      raw: ratingPositive(input.upgradeUpside),
      weighted: 0,
      detail: `${input.upgradeUpside}/10`,
    },
    {
      label: "Regulatory/zoning risk",
      weight: SCORE_WEIGHTS.regulatoryRisk,
      raw: ratingInverted(input.regulatoryRisk),
      weighted: 0,
      detail: `${input.regulatoryRisk}/10 (lower is better)`,
    },
    {
      label: "Maintenance complexity",
      weight: SCORE_WEIGHTS.maintenanceComplexity,
      raw: ratingInverted(input.maintenanceComplexity),
      weighted: 0,
      detail: `${input.maintenanceComplexity}/10 (lower is better)`,
    },
    {
      label: "Financing risk",
      weight: SCORE_WEIGHTS.financingRisk,
      raw: ratingInverted(input.financingRisk),
      weighted: 0,
      detail: `${input.financingRisk}/10 (lower is better)`,
    },
  ];

  let total = 0;
  for (const c of components) {
    c.weighted = c.raw * c.weight;
    total += c.weighted;
  }

  const score = Math.round(clamp01(total) * 100);
  return { score, decision: decisionFor(score), components };
}
