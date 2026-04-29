/**
 * Deterministic STR acquisition memo generator. Pure function — no LLM, no
 * I/O. Takes the same shapes the calc + score libraries emit and returns
 * structured memo content the UI can render and persist.
 *
 * Why deterministic for v1: the user wants memos that are auditable and
 * reproducible. Two reps running the generator on the same inputs must get
 * the same memo — that's not true for an LLM call. When we wire Anthropic
 * later, this generator becomes the fallback + the seed for the prompt.
 */

import type { CalcResult, ScenarioMetrics, ScenarioType } from "./calc";
import type { ScoreResult } from "./score";

export type MemoCompInput = {
  name: string;
  adr: number | null;
  occupancyPct: number | null;
  annualRevenue: number | null;
  reviewCount: number | null;
  rating: number | null;
  qualityScore: number | null;
  source: string;
};

export type MemoDealInput = {
  dealName: string;
  city: string | null;
  state: string | null;
  market: string | null;
  propertyAddress: string | null;
  propertyType: string | null;
  beds: number | null;
  baths: number | null;
  sleeps: number | null;
  squareFootage: number | null;
  yearBuilt: number | null;
  askingPrice: number | null;
  purchasePrice: number;
  targetOfferPrice: number | null;
  adr: number | null;
  occupancyPct: number | null;
  conservativeRevenue: number | null;
  baseRevenue: number | null;
  aggressiveRevenue: number | null;
  targetCashOnCash: number;
  targetDscr: number;
  // Qualitative ratings 0–10
  revenueConfidence: number;
  compQualityRating: number;
  marketStrength: number;
  upgradeUpside: number;
  regulatoryRisk: number;
  maintenanceComplexity: number;
  financingRisk: number;
};

export type MemoInput = {
  deal: MemoDealInput;
  calc: CalcResult;
  score: ScoreResult;
  comps: MemoCompInput[];
  /** Which scenario the memo's headline numbers come from. Default BASE. */
  scenario?: ScenarioType;
};

export type MemoContent = {
  scenarioType: ScenarioType;
  propertySummary: string;
  revenueSummary: string;
  compSummary: string;
  keyStrengths: string[];
  keyRisks: string[];
  knownLimits: string[];
  baseCaseReturnPct: number; // CoC at chosen scenario
  downsideReturnPct: number; // CoC at conservative
  recommendedOffer: number | null;
  recommendation: string;
  decision: ScoreResult["decision"];
  score: number;
};

const usd0 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function money(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "n/a";
  return usd0.format(n);
}

function pct(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "n/a";
  return `${(n * 100).toFixed(digits)}%`;
}

function ratio(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "n/a";
  return `${n.toFixed(digits)}×`;
}

function avg(nums: Array<number | null>): number | null {
  const xs = nums.filter((n): n is number => n !== null && Number.isFinite(n));
  if (xs.length === 0) return null;
  return xs.reduce((s, n) => s + n, 0) / xs.length;
}

function locationLine(deal: MemoDealInput): string {
  if (deal.city && deal.state) return `${deal.city}, ${deal.state}`;
  if (deal.market) return deal.market;
  if (deal.state) return deal.state;
  return "an unspecified market";
}

function propertyLine(deal: MemoDealInput): string {
  const bits: string[] = [];
  if (deal.propertyType) {
    bits.push(deal.propertyType.replace(/_/g, " ").toLowerCase());
  }
  const layout: string[] = [];
  if (deal.beds !== null) layout.push(`${deal.beds} bed`);
  if (deal.baths !== null) layout.push(`${deal.baths} bath`);
  if (deal.sleeps !== null) layout.push(`sleeps ${deal.sleeps}`);
  if (layout.length) bits.push(layout.join(" / "));
  if (deal.squareFootage) bits.push(`${deal.squareFootage.toLocaleString()} sq ft`);
  if (deal.yearBuilt) bits.push(`built ${deal.yearBuilt}`);
  return bits.length > 0 ? bits.join(", ") : "Property details TBD";
}

function buildPropertySummary(deal: MemoDealInput): string {
  const property = propertyLine(deal);
  const location = locationLine(deal);
  const askPart =
    deal.askingPrice !== null
      ? `Listed at ${money(deal.askingPrice)}; modeling acquisition at ${money(deal.purchasePrice)}.`
      : `Modeling acquisition at ${money(deal.purchasePrice)}.`;
  const targetPart =
    deal.targetOfferPrice !== null
      ? ` Current target offer: ${money(deal.targetOfferPrice)}.`
      : "";
  return `${capitalize(property)} in ${location}. ${askPart}${targetPart}`.trim();
}

function buildRevenueSummary(deal: MemoDealInput, calc: CalcResult): string {
  const base = calc.scenarios.BASE.grossRevenue;
  const cons = calc.scenarios.CONSERVATIVE.grossRevenue;
  const agg = calc.scenarios.AGGRESSIVE.grossRevenue;
  const range =
    cons > 0 || agg > 0
      ? `Range: ${money(cons)} (conservative) → ${money(agg)} (aggressive).`
      : "";
  const adrLine =
    deal.adr !== null
      ? ` ADR ${money(deal.adr)} at ${pct(deal.occupancyPct ?? 0)} occupancy.`
      : "";
  return `Base case gross revenue: ${money(base)}. ${range}${adrLine}`.trim();
}

function buildCompSummary(comps: MemoCompInput[]): string {
  if (comps.length === 0) {
    return "No comps recorded yet — revenue assumptions are unsupported.";
  }
  const adrAvg = avg(comps.map((c) => c.adr));
  const occAvg = avg(comps.map((c) => c.occupancyPct));
  const revAvg = avg(comps.map((c) => c.annualRevenue));
  const top = comps.reduce<MemoCompInput | null>((best, c) => {
    if (c.annualRevenue === null) return best;
    if (best === null || (best.annualRevenue ?? 0) < c.annualRevenue) return c;
    return best;
  }, null);
  const allManual = comps.every((c) => c.source === "MANUAL");
  const sourceNote = allManual
    ? " All comps are manual entries — not validated against an external data source."
    : "";
  const stats = [
    adrAvg !== null ? `avg ADR ${money(adrAvg)}` : null,
    occAvg !== null ? `avg occupancy ${pct(occAvg, 0)}` : null,
    revAvg !== null ? `avg revenue ${money(revAvg)}` : null,
  ]
    .filter(Boolean)
    .join(", ");
  const topNote = top?.annualRevenue
    ? ` Top performer: ${top.name} at ${money(top.annualRevenue)}.`
    : "";
  return `${comps.length} comp${comps.length === 1 ? "" : "s"} (${stats || "limited stats"}).${topNote}${sourceNote}`.trim();
}

/** Strengths: pull components that scored above 0.7 (raw 0–1) plus any
 * decisive metric wins (CoC > 1.5× target, DSCR > 1.5× target, lots of
 * upgrade upside, etc.). */
function buildStrengths(input: MemoInput): string[] {
  const out: string[] = [];
  const { deal, calc, score } = input;
  const base = calc.scenarios.BASE;

  if (base.cashOnCash >= deal.targetCashOnCash * 1.2) {
    out.push(
      `Cash-on-cash of ${pct(base.cashOnCash)} clears the ${pct(
        deal.targetCashOnCash
      )} target with margin.`
    );
  }
  if (base.dscr >= deal.targetDscr * 1.2) {
    out.push(
      `DSCR of ${ratio(base.dscr)} comfortably exceeds the ${ratio(deal.targetDscr)} threshold.`
    );
  }
  if (base.annualCashFlow > 0 && base.cashOnCash > 0.05) {
    out.push(
      `Positive monthly cash flow of ${money(base.monthlyCashFlow)} from day one.`
    );
  }
  if (deal.upgradeUpside >= 7) {
    out.push("Meaningful renovation upside to lift ADR or occupancy.");
  }
  if (deal.marketStrength >= 7) {
    out.push("Strong market signals — destination demand looks durable.");
  }
  if (deal.regulatoryRisk <= 3) {
    out.push("Regulatory environment is permissive for STRs.");
  }

  // Pull any component that scored above 0.7 raw and isn't already echoed
  // above (avoids duplication with the CoC/DSCR-specific lines).
  const namedComponents = score.components.filter((c) => c.raw >= 0.7);
  for (const c of namedComponents) {
    if (c.label.startsWith("Cash-on-cash") || c.label === "DSCR") continue;
    out.push(`${c.label}: ${c.detail}.`);
  }

  return dedupeKeepOrder(out).slice(0, 6);
}

/** Risks: pull components below 0.4 raw plus failure modes — negative cash
 * flow, DSCR < 1, very high break-even occupancy, etc. */
function buildRisks(input: MemoInput): string[] {
  const out: string[] = [];
  const { deal, calc, score } = input;
  const base = calc.scenarios.BASE;
  const cons = calc.scenarios.CONSERVATIVE;

  if (base.dscr < 1) {
    out.push(
      `DSCR of ${ratio(base.dscr)} does not cover debt service in the base case.`
    );
  } else if (base.dscr < deal.targetDscr) {
    out.push(
      `DSCR of ${ratio(base.dscr)} falls short of the ${ratio(deal.targetDscr)} target.`
    );
  }
  if (base.cashOnCash < 0) {
    out.push(
      `Negative cash-on-cash (${pct(base.cashOnCash)}) in the base case.`
    );
  } else if (base.cashOnCash < deal.targetCashOnCash) {
    out.push(
      `Cash-on-cash of ${pct(base.cashOnCash)} is below the ${pct(deal.targetCashOnCash)} target.`
    );
  }
  if (cons.annualCashFlow < 0) {
    out.push(
      `Conservative scenario goes cash-flow-negative (${money(cons.annualCashFlow)}/yr).`
    );
  }
  if (
    base.breakEvenOccupancy > 0 &&
    base.breakEvenOccupancy > 0.7
  ) {
    out.push(
      `Break-even occupancy is high at ${pct(base.breakEvenOccupancy, 0)} — little margin if bookings soften.`
    );
  }
  if (deal.regulatoryRisk >= 7) {
    out.push("Regulatory/zoning risk is elevated — confirm STR is permitted long-term.");
  }
  if (deal.maintenanceComplexity >= 7) {
    out.push("High maintenance complexity (pool, hot tub, septic, etc.) — budget operational drag.");
  }
  if (deal.financingRisk >= 7) {
    out.push("Financing risk is elevated — verify lender, rate lock, and DSCR-loan covenants.");
  }

  // Components with raw < 0.4 that haven't already been folded in.
  for (const c of score.components.filter((c) => c.raw < 0.4)) {
    if (c.label.startsWith("Cash-on-cash") || c.label === "DSCR") continue;
    out.push(`${c.label}: ${c.detail}.`);
  }

  return dedupeKeepOrder(out).slice(0, 6);
}

/** Known limits / data confidence bullets. Surfaces every weak-input signal
 * that affects how much we should trust the memo's numbers. */
function buildKnownLimits(input: MemoInput): string[] {
  const out: string[] = [];
  const { deal, comps, calc } = input;

  // Comp signals
  if (comps.length === 0) {
    out.push("No comps entered — revenue assumptions are not validated by external data.");
  } else if (comps.length < 3) {
    out.push(`Only ${comps.length} comp${comps.length === 1 ? "" : "s"} — small sample size.`);
  }
  if (comps.length > 0 && comps.every((c) => c.source === "MANUAL")) {
    out.push("All comps are manual entries — not pulled from BNB Calc / AirDNA / Google Maps.");
  }

  // Revenue signals
  if (deal.baseRevenue === null) {
    out.push("Base-case revenue is unset — calc defaulted it to $0.");
  }
  if (deal.conservativeRevenue === null) {
    out.push("Conservative revenue not specified — downside scenario is unmodeled.");
  }
  if (deal.aggressiveRevenue === null) {
    out.push("Aggressive revenue not specified — upside scenario is unmodeled.");
  }
  if (deal.adr === null) {
    out.push("ADR is unset — break-even occupancy could not be computed.");
  }
  if (deal.occupancyPct === null) {
    out.push("Occupancy assumption is unset.");
  }
  if (calc.potentialGrossRevenue === 0 && deal.adr === null) {
    out.push("No potential-gross-revenue baseline — break-even ratio defaults to 0.");
  }

  // Confidence ratings
  if (deal.revenueConfidence < 5) {
    out.push(
      `Revenue confidence is low (${deal.revenueConfidence}/10) — treat the base case as a rough estimate.`
    );
  }
  if (deal.compQualityRating < 5) {
    out.push(
      `Comp quality rated low (${deal.compQualityRating}/10) — comparable selection should be revisited.`
    );
  }

  // Operating expense signals — flag if all expense fields are zero/null
  // (means the user hasn't filled in operating costs yet)
  const opex = calc.scenarios.BASE.operatingExpenses;
  if (opex === 0) {
    out.push("Operating expenses are $0 — likely unfilled. NOI is overstated.");
  }

  return out;
}

/** Recommended offer = the lower of the two max-offer ceilings, both
 * computed against the base scenario. If either is null, fall back to the
 * other; if both are null, no recommendation. */
function buildRecommendedOffer(base: ScenarioMetrics): number | null {
  const a = base.maxOfferByCoc;
  const b = base.maxOfferByDscr;
  if (a === null && b === null) return null;
  if (a === null) return b;
  if (b === null) return a;
  return Math.min(a, b);
}

function buildRecommendation(
  decision: ScoreResult["decision"],
  recommendedOffer: number | null,
  purchasePrice: number,
  targetOfferPrice: number | null
): string {
  const offerLine = recommendedOffer
    ? ` Underwriting suggests a max offer of ${money(recommendedOffer)}.`
    : "";
  const gapLine =
    recommendedOffer !== null && purchasePrice > 0
      ? ` Modeled price of ${money(purchasePrice)} is ${
          purchasePrice <= recommendedOffer
            ? "within"
            : `${money(purchasePrice - recommendedOffer)} above`
        } that ceiling.`
      : "";
  const targetLine =
    targetOfferPrice !== null
      ? ` Current target offer is ${money(targetOfferPrice)}.`
      : "";

  switch (decision) {
    case "STRONG_BUY":
      return `Strong buy — the deal clears every key threshold.${offerLine}${gapLine}${targetLine}`;
    case "BUY_NEGOTIATE":
      return `Buy with negotiation — the deal works at the right price but doesn't have margin to spare.${offerLine}${gapLine}${targetLine}`;
    case "WEAK":
      return `Weak — the deal is borderline and needs better terms or stronger revenue evidence before proceeding.${offerLine}${gapLine}${targetLine}`;
    case "PASS":
      return `Pass — the underwriting does not support the modeled price.${offerLine}${gapLine}${targetLine}`;
  }
}

export function generateMemo(input: MemoInput): MemoContent {
  const scenarioType: ScenarioType = input.scenario ?? "BASE";
  const chosen = input.calc.scenarios[scenarioType];
  const downside = input.calc.scenarios.CONSERVATIVE;
  const base = input.calc.scenarios.BASE;
  const recommendedOffer = buildRecommendedOffer(base);

  return {
    scenarioType,
    propertySummary: buildPropertySummary(input.deal),
    revenueSummary: buildRevenueSummary(input.deal, input.calc),
    compSummary: buildCompSummary(input.comps),
    keyStrengths: buildStrengths(input),
    keyRisks: buildRisks(input),
    knownLimits: buildKnownLimits(input),
    baseCaseReturnPct: chosen.cashOnCash,
    downsideReturnPct: downside.cashOnCash,
    recommendedOffer,
    recommendation: buildRecommendation(
      input.score.decision,
      recommendedOffer,
      input.deal.purchasePrice,
      input.deal.targetOfferPrice
    ),
    decision: input.score.decision,
    score: input.score.score,
  };
}

function dedupeKeepOrder(xs: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of xs) {
    if (seen.has(x)) continue;
    seen.add(x);
    out.push(x);
  }
  return out;
}

function capitalize(s: string): string {
  if (s.length === 0) return s;
  return s[0].toUpperCase() + s.slice(1);
}
