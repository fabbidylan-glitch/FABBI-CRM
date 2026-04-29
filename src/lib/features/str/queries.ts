import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  computeUnderwriting,
  type CalcInput,
  type ScenarioType,
} from "@/lib/str/calc";
import { scoreDeal } from "@/lib/str/score";

/**
 * Convert a Prisma Decimal | null to a plain number with a fallback. The calc
 * library is pure-number; this is the only place that bridges the DB type.
 */
export function dec(value: Prisma.Decimal | null | undefined, fallback = 0): number {
  if (value === null || value === undefined) return fallback;
  return value.toNumber();
}

function decOrNull(value: Prisma.Decimal | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return value.toNumber();
}

/** Sums STRExpense rows into a single annual USD figure. Used by the
 * underwriting recompute so custom expense lines roll into the operating-
 * expense total alongside the standard fields on the STRDeal row. */
function annualizeCustomExpenses(
  expenses: Array<{ amount: Prisma.Decimal; frequency: string }>
): number {
  let total = 0;
  for (const e of expenses) {
    const amount = e.amount.toNumber();
    switch (e.frequency) {
      case "MONTHLY":
        total += amount * 12;
        break;
      case "ANNUAL":
        total += amount;
        break;
      case "PER_BOOKING":
        // Without a known booking count we have to make an assumption. 100
        // bookings/year is a reasonable mid-market default for an STR; users
        // who care about precision should encode the expense as ANNUAL.
        total += amount * 100;
        break;
      case "ONE_TIME":
        // One-time expenses don't belong in operating expenses; they live in
        // the renovation/closing/reserves buckets. Skip.
        break;
      default:
        total += amount;
    }
  }
  return total;
}

/** Build the CalcInput for the calc library from a STRDeal row + expenses. */
export function toCalcInput(
  deal: {
    purchasePrice: Prisma.Decimal;
    downPaymentPct: Prisma.Decimal;
    interestRate: Prisma.Decimal;
    loanTermYears: number;
    interestOnly: boolean;
    closingCosts: Prisma.Decimal;
    renovationBudget: Prisma.Decimal;
    furnitureBudget: Prisma.Decimal;
    initialReserves: Prisma.Decimal;
    conservativeRevenue: Prisma.Decimal | null;
    baseRevenue: Prisma.Decimal | null;
    aggressiveRevenue: Prisma.Decimal | null;
    adr: Prisma.Decimal | null;
    propertyTaxes: Prisma.Decimal | null;
    insurance: Prisma.Decimal | null;
    utilities: Prisma.Decimal | null;
    internet: Prisma.Decimal | null;
    repairsMaintenance: Prisma.Decimal | null;
    supplies: Prisma.Decimal | null;
    cleaningExpense: Prisma.Decimal | null;
    exteriorServices: Prisma.Decimal | null;
    hoa: Prisma.Decimal | null;
    accounting: Prisma.Decimal | null;
    miscExpense: Prisma.Decimal | null;
    platformFeesPct: Prisma.Decimal | null;
    propertyMgmtPct: Prisma.Decimal | null;
    targetCashOnCash: Prisma.Decimal;
    targetDscr: Prisma.Decimal;
  },
  expenses: Array<{ amount: Prisma.Decimal; frequency: string }>
): CalcInput {
  return {
    conservativeRevenue: decOrNull(deal.conservativeRevenue),
    baseRevenue: decOrNull(deal.baseRevenue),
    aggressiveRevenue: decOrNull(deal.aggressiveRevenue),
    purchasePrice: dec(deal.purchasePrice),
    downPaymentPct: dec(deal.downPaymentPct),
    interestRate: dec(deal.interestRate),
    loanTermYears: deal.loanTermYears,
    interestOnly: deal.interestOnly,
    closingCosts: dec(deal.closingCosts),
    renovationBudget: dec(deal.renovationBudget),
    furnitureBudget: dec(deal.furnitureBudget),
    initialReserves: dec(deal.initialReserves),
    propertyTaxes: dec(deal.propertyTaxes),
    insurance: dec(deal.insurance),
    utilities: dec(deal.utilities),
    internet: dec(deal.internet),
    repairsMaintenance: dec(deal.repairsMaintenance),
    supplies: dec(deal.supplies),
    cleaningExpense: dec(deal.cleaningExpense),
    exteriorServices: dec(deal.exteriorServices),
    hoa: dec(deal.hoa),
    accounting: dec(deal.accounting),
    miscExpense: dec(deal.miscExpense),
    platformFeesPct: dec(deal.platformFeesPct),
    propertyMgmtPct: dec(deal.propertyMgmtPct),
    targetCashOnCash: dec(deal.targetCashOnCash, 0.10),
    targetDscr: dec(deal.targetDscr, 1.25),
    adr: decOrNull(deal.adr),
    customAnnualExpenses: annualizeCustomExpenses(expenses),
  };
}

/**
 * Recompute the 3 scenarios + score + decision for a deal and persist them.
 * Called from every mutation (create/update/comp change) so the cached
 * scenario rows + STRDeal.score never drift from the inputs.
 */
export async function recomputeDeal(dealId: string): Promise<void> {
  const deal = await prisma.sTRDeal.findUnique({
    where: { id: dealId },
    include: { expenses: true },
  });
  if (!deal) throw new Error(`STRDeal ${dealId} not found`);

  const calcInput = toCalcInput(deal, deal.expenses);
  const result = computeUnderwriting(calcInput);

  // Score is computed from BASE scenario metrics — that's the canonical
  // case the deal stands or falls on. Conservative/aggressive are
  // sensitivity bands shown in the UI but don't drive the decision.
  const baseScenario = result.scenarios.BASE;
  const score = scoreDeal({
    cashOnCash: baseScenario.cashOnCash,
    dscr: baseScenario.dscr,
    targetCashOnCash: calcInput.targetCashOnCash,
    targetDscr: calcInput.targetDscr,
    revenueConfidence: deal.revenueConfidence,
    compQuality: deal.compQualityRating,
    marketStrength: deal.marketStrength,
    upgradeUpside: deal.upgradeUpside,
    regulatoryRisk: deal.regulatoryRisk,
    maintenanceComplexity: deal.maintenanceComplexity,
    financingRisk: deal.financingRisk,
  });

  await prisma.$transaction([
    prisma.sTRScenario.deleteMany({ where: { dealId } }),
    prisma.sTRScenario.createMany({
      data: (Object.keys(result.scenarios) as ScenarioType[]).map((type) => {
        const m = result.scenarios[type];
        return {
          dealId,
          scenarioType: type,
          grossRevenue: m.grossRevenue,
          operatingExpenses: m.operatingExpenses,
          noi: m.noi,
          monthlyMortgage: m.monthlyMortgage,
          annualDebtService: m.annualDebtService,
          annualCashFlow: m.annualCashFlow,
          monthlyCashFlow: m.monthlyCashFlow,
          cashOnCash: m.cashOnCash,
          capRate: m.capRate,
          dscr: m.dscr,
          breakEvenOccupancy: m.breakEvenOccupancy,
          totalCashInvested: m.totalCashInvested,
          maxOfferByCoc: m.maxOfferByCoc,
          maxOfferByDscr: m.maxOfferByDscr,
        };
      }),
    }),
    prisma.sTRDeal.update({
      where: { id: dealId },
      data: { score: score.score, decision: score.decision },
    }),
  ]);
}

/** Lightweight row for the deals list page. */
export type STRDealListRow = {
  id: string;
  dealName: string;
  market: string | null;
  city: string | null;
  state: string | null;
  status: string;
  askingPrice: number | null;
  purchasePrice: number;
  baseGrossRevenue: number | null;
  baseCashFlow: number | null;
  baseCashOnCash: number | null;
  baseDscr: number | null;
  score: number | null;
  decision: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function listDeals(): Promise<STRDealListRow[]> {
  const deals = await prisma.sTRDeal.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      scenarios: { where: { scenarioType: "BASE" }, take: 1 },
    },
  });
  return deals.map((d) => {
    const base = d.scenarios[0] ?? null;
    return {
      id: d.id,
      dealName: d.dealName,
      market: d.market,
      city: d.city,
      state: d.state,
      status: d.status,
      askingPrice: decOrNull(d.askingPrice),
      purchasePrice: dec(d.purchasePrice),
      baseGrossRevenue: base ? base.grossRevenue.toNumber() : decOrNull(d.baseRevenue),
      baseCashFlow: base ? base.annualCashFlow.toNumber() : null,
      baseCashOnCash: base ? base.cashOnCash.toNumber() : null,
      baseDscr: base ? base.dscr.toNumber() : null,
      score: d.score,
      decision: d.decision,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    };
  });
}

export async function getDealWithRelations(id: string) {
  return prisma.sTRDeal.findUnique({
    where: { id },
    include: {
      scenarios: true,
      comps: { orderBy: { createdAt: "desc" } },
      expenses: { orderBy: { createdAt: "asc" } },
      memos: { orderBy: { generatedAt: "desc" }, take: 5 },
    },
  });
}

export type DealWithRelations = NonNullable<
  Awaited<ReturnType<typeof getDealWithRelations>>
>;
