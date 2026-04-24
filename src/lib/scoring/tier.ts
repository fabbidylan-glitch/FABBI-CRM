import type { LeadIntakeInput } from "@/lib/validators/lead-intake";

/*
 * Prioritization tier for sales triage. Independent of the primary scoring
 * engine in ./score.ts — that one is multivariate and drives sequence
 * enrollment + grading. This one is the simple bucketing formula the sales
 * team uses to decide "call this lead now vs. add to the queue".
 *
 * Rules (additive):
 *   +3  Revenue $1M+
 *   +2  Revenue $500K–$1M
 *   +2  STR or Real Estate niche
 *   +1  Multi-state (>1 state of operation)
 *   +1  High tax paid last year ($50K+)
 *   -2  Revenue under $250K
 *
 * Thresholds:
 *   HIGH    5+
 *   MEDIUM  3–4
 *   LOW     <3
 */

export type LeadTierValue = "HIGH" | "MEDIUM" | "LOW";

export type TierResult = {
  score: number;
  tier: LeadTierValue;
  reasons: string[];
};

type TierInput = Pick<
  LeadIntakeInput,
  "annualRevenueRange" | "niche" | "statesOfOperation" | "taxesPaidLastYearRange"
>;

const REAL_ESTATE_NICHES = new Set([
  "STR_OWNER",
  "AIRBNB_VRBO_OPERATOR",
  "REAL_ESTATE_INVESTOR",
  "HIGH_INCOME_STR_STRATEGY",
]);

const HIGH_TAX_RANGES = new Set(["FROM_50K_TO_100K", "OVER_100K"]);

export function computeLeadTier(input: TierInput): TierResult {
  let score = 0;
  const reasons: string[] = [];

  if (input.annualRevenueRange === "OVER_1M") {
    score += 3;
    reasons.push("+3 revenue $1M+");
  } else if (input.annualRevenueRange === "FROM_500K_TO_1M") {
    score += 2;
    reasons.push("+2 revenue $500K–$1M");
  } else if (input.annualRevenueRange === "UNDER_250K") {
    score -= 2;
    reasons.push("-2 revenue under $250K");
  }

  if (REAL_ESTATE_NICHES.has(input.niche)) {
    score += 2;
    reasons.push("+2 STR or real estate");
  }

  const stateCount = input.statesOfOperation?.length ?? 0;
  if (stateCount > 1) {
    score += 1;
    reasons.push("+1 multi-state");
  }

  if (input.taxesPaidLastYearRange && HIGH_TAX_RANGES.has(input.taxesPaidLastYearRange)) {
    score += 1;
    reasons.push("+1 high taxes paid");
  }

  const tier: LeadTierValue = score >= 5 ? "HIGH" : score >= 3 ? "MEDIUM" : "LOW";
  return { score, tier, reasons };
}
