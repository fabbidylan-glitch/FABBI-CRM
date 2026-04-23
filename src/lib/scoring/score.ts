import "server-only";
import { prisma } from "@/lib/db";
import type { LeadIntakeInput } from "@/lib/validators/lead-intake";

// Default weights mirror RULE_CONFIGS["scoring.weights.v1"] in prisma/seed.ts.
// Kept in-code so scoring works even before the RuleConfig row is populated.
const DEFAULT_WEIGHTS = {
  revenue: {
    UNDER_250K: 0,
    FROM_250K_TO_500K: 14,
    FROM_500K_TO_1M: 24,
    OVER_1M: 30,
    UNKNOWN: 0,
  },
  taxes: {
    UNDER_10K: 0,
    FROM_10K_TO_25K: 8,
    FROM_25K_TO_50K: 14,
    FROM_50K_TO_100K: 20,
    OVER_100K: 25,
    UNKNOWN: 0,
  },
  service: {
    TAX_PREP: 8,
    BOOKKEEPING: 12,
    TAX_STRATEGY: 16,
    BOOKKEEPING_AND_TAX: 16,
    CFO: 18,
    FULL_SERVICE: 20,
    UNSURE: 4,
  },
  propertyCount: {
    NONE: 0,
    ONE: 2,
    TWO_TO_FOUR: 6,
    FIVE_TO_NINE: 10,
    TEN_PLUS: 15,
    UNKNOWN: 0,
  },
  urgency: {
    RESEARCHING: 2,
    NEXT_30_DAYS: 7,
    NOW: 10,
    UNKNOWN: 0,
  },
  source: {
    REFERRAL: 10,
    PARTNER_REFERRAL: 8,
    ORGANIC_BRANDED: 6,
    GOOGLE_ADS: 5,
    META_ADS: 3,
    LINKEDIN_ADS: 3,
    ORGANIC_SEARCH: 4,
    WEBSITE: 3,
    LANDING_PAGE: 3,
    CALENDLY: 5,
    MANUAL: 2,
    CSV_IMPORT: 0,
    EVENT: 4,
    PODCAST: 4,
    OTHER: 1,
  },
  complexity: { w2Income: 3, payroll: 4, multipleStates: 3, otherBusinessIncome: 3 },
} as const;

const GRADE_THRESHOLDS = { A: 80, B: 60, C: 40 };

type Weights = typeof DEFAULT_WEIGHTS;

export type ScoreBreakdown = {
  revenueScore: number;
  taxScore: number;
  serviceScore: number;
  fitScore: number;
  urgencyScore: number;
  sourceScore: number;
  complexityScore: number;
  bookedConsultScore: number;
  totalScore: number;
};

export type ScoreResult = {
  score: number;
  grade: "A" | "B" | "C" | "D";
  qualification: "QUALIFIED" | "MANUAL_REVIEW" | "NURTURE_ONLY" | "DISQUALIFIED";
  breakdown: ScoreBreakdown;
};

async function loadWeights(): Promise<Weights> {
  if (!process.env.DATABASE_URL) return DEFAULT_WEIGHTS;
  try {
    const row = await prisma.ruleConfig.findUnique({ where: { key: "scoring.weights.v1" } });
    if (row?.valueJson) return { ...DEFAULT_WEIGHTS, ...(row.valueJson as Partial<Weights>) };
  } catch (err) {
    // Fall back to in-code defaults, but make the failure visible so we notice
    // if the rule_configs row stops loading in production (silent default-only
    // scoring would slowly make customized weights useless).
    console.error("[scoring] loadWeights failed, using DEFAULT_WEIGHTS:", err);
  }
  return DEFAULT_WEIGHTS;
}

export async function scoreLead(input: Pick<
  LeadIntakeInput,
  | "annualRevenueRange"
  | "taxesPaidLastYearRange"
  | "serviceInterest"
  | "propertyCount"
  | "urgency"
  | "source"
  | "statesOfOperation"
  | "w2IncomeFlag"
  | "payrollFlag"
  | "otherBusinessIncomeFlag"
  | "niche"
  | "monthlyAdSpendRange"
  | "salesChannels"
>): Promise<ScoreResult> {
  const w = await loadWeights();

  const revenueScore = w.revenue[input.annualRevenueRange] ?? 0;
  const taxScore = w.taxes[input.taxesPaidLastYearRange] ?? 0;
  const serviceScore = w.service[input.serviceInterest] ?? 0;
  const urgencyScore = w.urgency[input.urgency] ?? 0;
  const sourceScore = (w.source as Record<string, number>)[input.source] ?? 0;

  const fitScore =
    input.niche === "HIGH_INCOME_STR_STRATEGY"
      ? 10
      : input.niche === "STR_OWNER" || input.niche === "AIRBNB_VRBO_OPERATOR"
        ? 8
        : input.niche === "E_COMMERCE"
          ? 8
          : input.niche === "REAL_ESTATE_INVESTOR"
            ? 7
            : input.niche === "MULTI_SERVICE_CLIENT"
              ? 6
              : 0;

  // E-commerce: ad spend is a proxy for size/complexity (bigger spend → more
  // channels → more reconciliation work). Multi-channel sellers get a small
  // bump too — a single-channel Shopify store is much simpler to work with.
  const adSpendScore =
    input.monthlyAdSpendRange === "OVER_100K"
      ? 12
      : input.monthlyAdSpendRange === "FROM_25K_TO_100K"
        ? 9
        : input.monthlyAdSpendRange === "FROM_5K_TO_25K"
          ? 5
          : input.monthlyAdSpendRange === "UNDER_5K"
            ? 2
            : 0;
  const multiChannelBonus = (input.salesChannels?.length ?? 0) >= 3 ? 3 : 0;

  const propScore = w.propertyCount[input.propertyCount] ?? 0;
  const complexityScore =
    (input.w2IncomeFlag ? w.complexity.w2Income : 0) +
    (input.payrollFlag ? w.complexity.payroll : 0) +
    (input.otherBusinessIncomeFlag ? w.complexity.otherBusinessIncome : 0) +
    ((input.statesOfOperation?.length ?? 0) > 1 ? w.complexity.multipleStates : 0) +
    propScore +
    adSpendScore +
    multiChannelBonus;

  const total = Math.min(
    100,
    revenueScore + taxScore + serviceScore + fitScore + urgencyScore + sourceScore + complexityScore
  );

  const grade: ScoreResult["grade"] =
    total >= GRADE_THRESHOLDS.A
      ? "A"
      : total >= GRADE_THRESHOLDS.B
        ? "B"
        : total >= GRADE_THRESHOLDS.C
          ? "C"
          : "D";

  const disqualified =
    input.annualRevenueRange === "UNDER_250K" && input.taxesPaidLastYearRange === "UNDER_10K";

  const qualification: ScoreResult["qualification"] = disqualified
    ? "DISQUALIFIED"
    : grade === "A"
      ? "QUALIFIED"
      : grade === "B"
        ? "MANUAL_REVIEW"
        : grade === "C"
          ? "NURTURE_ONLY"
          : "DISQUALIFIED";

  return {
    score: total,
    grade,
    qualification,
    breakdown: {
      revenueScore,
      taxScore,
      serviceScore,
      fitScore,
      urgencyScore,
      sourceScore,
      complexityScore,
      bookedConsultScore: 0,
      totalScore: total,
    },
  };
}
