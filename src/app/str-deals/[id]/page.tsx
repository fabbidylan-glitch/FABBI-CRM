import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { CompSummary } from "@/components/str/comp-summary";
import { CompsPanel, type CompRow } from "@/components/str/comps-panel";
import { DecisionBadge } from "@/components/str/decision-badge";
import { DeleteDealButton } from "@/components/str/delete-deal-button";
import { ExpensesPanel, type ExpenseRow } from "@/components/str/expenses-panel";
import { MemoPanel, type MemoRow } from "@/components/str/memo-panel";
import { ScenarioToggle, type ScenarioKey } from "@/components/str/scenario-toggle";
import { ScoreBreakdown } from "@/components/str/score-breakdown";
import {
  UnderwritingForm,
  type UnderwritingInitial,
} from "@/components/str/underwriting-form";
import { Card, CardBody, CardHeader, Pill, Stat } from "@/components/ui";
import { config } from "@/lib/config";
import { getSTRAccess } from "@/lib/features/str/auth";
import {
  STATUS_LABEL,
  formatLocation,
  formatMoney,
  formatPercent,
  formatRatio,
  type DecisionLabel,
  type StatusLabel,
} from "@/lib/features/str/format";
import {
  dec,
  getDealWithRelations,
  toCalcInput,
} from "@/lib/features/str/queries";
import { computeUnderwriting } from "@/lib/str/calc";
import { scoreDeal, type ScoreComponent } from "@/lib/str/score";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "underwriting", label: "Underwriting" },
  { key: "comps", label: "Comps" },
  { key: "memo", label: "Memo" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const SCENARIO_DB: Record<ScenarioKey, "CONSERVATIVE" | "BASE" | "AGGRESSIVE"> = {
  conservative: "CONSERVATIVE",
  base: "BASE",
  aggressive: "AGGRESSIVE",
};

type SearchParams = { [k: string]: string | string[] | undefined };

function pick(sp: SearchParams, key: string): string | undefined {
  const v = sp[key];
  if (typeof v === "string" && v.length > 0) return v;
  return undefined;
}

export default async function STRDealDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  if (!config.dbEnabled || !config.authEnabled) redirect("/str-deals");
  const actor = await getSTRAccess();
  if (!actor) redirect("/str-deals");

  const { id } = await params;
  const sp = await searchParams;
  const tab: TabKey = (TABS.find((t) => t.key === pick(sp, "tab"))?.key ?? "overview") as TabKey;
  const scenario: ScenarioKey =
    (["conservative", "base", "aggressive"] as const).find(
      (s) => s === pick(sp, "scenario")
    ) ?? "base";

  const deal = await getDealWithRelations(id);
  if (!deal) return notFound();

  const dbScenarioType = SCENARIO_DB[scenario];
  const activeScenario = deal.scenarios.find((s) => s.scenarioType === dbScenarioType);

  // Recompute the score breakdown live so the UI can show component-level
  // contributions. Cached score on the deal row stays the source of truth
  // for the badge — this just gives us the per-component shape that the
  // STRDeal table doesn't store.
  const scoreBreakdown = computeScoreBreakdown(deal);

  const scenarioLink = (key: ScenarioKey) =>
    `/str-deals/${deal.id}?tab=${tab}&scenario=${key}`;
  const tabLink = (key: TabKey) =>
    `/str-deals/${deal.id}?tab=${key}&scenario=${scenario}`;

  return (
    <Shell title={deal.dealName}>
      <div className="mb-4 flex items-center gap-2 text-xs text-brand-muted">
        <Link
          href="/str-deals"
          className="inline-flex items-center gap-1 rounded-md border border-transparent px-1.5 py-0.5 transition hover:border-brand-hairline hover:bg-white hover:text-brand-navy"
        >
          <span aria-hidden>←</span> All STR deals
        </Link>
        <span aria-hidden className="text-brand-hairline">/</span>
        <span className="text-brand-navy/70">{deal.dealName}</span>
      </div>

      {/* Hero */}
      <Card className="mb-4 overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-brand-blue via-brand-blue-dark to-brand-navy" />
        <CardBody>
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-semibold tracking-[-0.01em] text-brand-navy">
                  {deal.dealName}
                </h2>
                <Pill tone="slate">
                  {STATUS_LABEL[deal.status as StatusLabel] ?? deal.status}
                </Pill>
                <DecisionBadge decision={deal.decision as DecisionLabel} />
              </div>
              <div className="mt-1 text-sm text-brand-muted">
                {formatLocation(deal.market, deal.city, deal.state)}
                {deal.propertyAddress ? (
                  <>
                    <span className="mx-2 text-brand-hairline">·</span>
                    {deal.propertyAddress}
                  </>
                ) : null}
              </div>
              {deal.listingUrl ? (
                <a
                  href={deal.listingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-xs text-brand-blue hover:text-brand-blue-dark"
                >
                  Open listing ↗
                </a>
              ) : null}
            </div>
            <div className="flex flex-col items-end gap-2">
              <ScenarioToggle active={scenario} />
              <DeleteDealButton dealId={deal.id} dealName={deal.dealName} />
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Summary cards */}
      <div className="mb-6 grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Stat
          label="Purchase price"
          value={formatMoney(dec(deal.purchasePrice))}
          hint={
            deal.askingPrice
              ? `Asking ${formatMoney(dec(deal.askingPrice))}`
              : undefined
          }
        />
        <Stat
          label="Gross revenue"
          value={
            activeScenario
              ? formatMoney(activeScenario.grossRevenue.toNumber())
              : "—"
          }
          hint={`${scenario} scenario`}
        />
        <Stat
          label="Annual cash flow"
          value={
            activeScenario
              ? formatMoney(activeScenario.annualCashFlow.toNumber())
              : "—"
          }
          trend={
            activeScenario
              ? formatMoney(activeScenario.monthlyCashFlow.toNumber()) + "/mo"
              : undefined
          }
          trendTone={
            activeScenario && activeScenario.annualCashFlow.toNumber() >= 0
              ? "positive"
              : "negative"
          }
        />
        <Stat
          label="Cash-on-cash"
          value={
            activeScenario
              ? formatPercent(activeScenario.cashOnCash.toNumber())
              : "—"
          }
          hint={`Target ${formatPercent(dec(deal.targetCashOnCash))}`}
        />
        <Stat
          label="DSCR"
          value={
            activeScenario ? formatRatio(activeScenario.dscr.toNumber()) : "—"
          }
          hint={`Target ${dec(deal.targetDscr).toFixed(2)}×`}
        />
        <Stat
          label="Score"
          value={deal.score === null ? "—" : String(deal.score)}
          hint={
            deal.decision
              ? deal.decision.replace(/_/g, " ").toLowerCase()
              : "Not scored"
          }
        />
      </div>

      {/* Tabs */}
      <div className="mb-4 flex flex-wrap items-center gap-1 border-b border-brand-hairline">
        {TABS.map((t) => {
          const isActive = t.key === tab;
          return (
            <Link
              key={t.key}
              href={tabLink(t.key)}
              className={`-mb-px rounded-t-md border border-b-0 px-4 py-2 text-xs font-medium transition ${
                isActive
                  ? "border-brand-hairline bg-white text-brand-navy"
                  : "border-transparent text-brand-muted hover:text-brand-navy"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {tab === "overview" ? (
        <OverviewTab
          deal={deal}
          activeScenario={activeScenario}
          scoreComponents={scoreBreakdown}
        />
      ) : null}
      {tab === "underwriting" ? (
        <UnderwritingTab
          dealId={deal.id}
          initial={toUnderwritingInitial(deal)}
          expenses={deal.expenses.map(expenseToRow)}
        />
      ) : null}
      {tab === "comps" ? (
        <div className="space-y-4">
          <CompSummary comps={deal.comps.map(compToRow)} />
          <CompsPanel dealId={deal.id} comps={deal.comps.map(compToRow)} />
        </div>
      ) : null}
      {tab === "memo" ? (
        <MemoPanel
          dealId={deal.id}
          dealName={deal.dealName}
          memos={deal.memos.map(memoToRow)}
        />
      ) : null}
    </Shell>
  );
}

function computeScoreBreakdown(deal: DealRel): ScoreComponent[] {
  const calcInput = toCalcInput(deal, deal.expenses);
  const calc = computeUnderwriting(calcInput);
  const result = scoreDeal({
    cashOnCash: calc.scenarios.BASE.cashOnCash,
    dscr: calc.scenarios.BASE.dscr,
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
  return result.components;
}

/* ── Tab: Overview ────────────────────────────────────────────────────────── */

type DealRel = NonNullable<Awaited<ReturnType<typeof getDealWithRelations>>>;
type ScenarioRow = DealRel["scenarios"][number];

function OverviewTab({
  deal,
  activeScenario,
  scoreComponents,
}: {
  deal: DealRel;
  activeScenario: ScenarioRow | undefined;
  scoreComponents: ScoreComponent[];
}) {
  const totalCash = activeScenario
    ? activeScenario.totalCashInvested.toNumber()
    : null;
  const opex = activeScenario
    ? activeScenario.operatingExpenses.toNumber()
    : null;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card>
          <CardHeader title="Property" />
          <CardBody>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm md:grid-cols-4">
              <Field label="Type" value={deal.propertyType ?? "—"} />
              <Field label="Beds" value={fmt(deal.beds)} />
              <Field label="Baths" value={fmt(deal.baths ? deal.baths.toNumber() : null)} />
              <Field label="Sleeps" value={fmt(deal.sleeps)} />
              <Field label="Sq ft" value={fmt(deal.squareFootage)} />
              <Field
                label="Lot size"
                value={deal.lotSize ? `${deal.lotSize.toNumber()} ac` : "—"}
              />
              <Field label="Year built" value={fmt(deal.yearBuilt)} />
              <Field label="Status" value={STATUS_LABEL[deal.status as StatusLabel] ?? deal.status} />
            </dl>
            {deal.notes ? (
              <p className="mt-4 rounded-lg border border-brand-blue-soft/40 bg-brand-blue-tint/60 px-3 py-2 text-sm text-brand-navy">
                {deal.notes}
              </p>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Acquisition" />
          <CardBody>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm md:grid-cols-4">
              <Field
                label="Purchase price"
                value={formatMoney(deal.purchasePrice.toNumber())}
              />
              <Field
                label="Down payment"
                value={`${formatPercent(
                  deal.downPaymentPct.toNumber(),
                  1
                )} (${formatMoney(
                  deal.purchasePrice.toNumber() * deal.downPaymentPct.toNumber()
                )})`}
              />
              <Field
                label="Interest rate"
                value={formatPercent(deal.interestRate.toNumber(), 2)}
              />
              <Field label="Term" value={`${deal.loanTermYears} yrs`} />
              <Field
                label="Closing costs"
                value={formatMoney(deal.closingCosts.toNumber())}
              />
              <Field
                label="Renovation"
                value={formatMoney(deal.renovationBudget.toNumber())}
              />
              <Field
                label="Furniture"
                value={formatMoney(deal.furnitureBudget.toNumber())}
              />
              <Field
                label="Reserves"
                value={formatMoney(deal.initialReserves.toNumber())}
              />
              <Field
                label="Total cash needed"
                value={formatMoney(totalCash)}
              />
              <Field
                label="Interest-only"
                value={deal.interestOnly ? "Yes" : "No"}
              />
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Active scenario"
            action={
              <span className="text-xs text-brand-muted">
                {activeScenario?.scenarioType ?? "—"}
              </span>
            }
          />
          <CardBody>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm md:grid-cols-4">
              <Field
                label="Gross revenue"
                value={formatMoney(activeScenario?.grossRevenue.toNumber() ?? null)}
              />
              <Field
                label="Operating expenses"
                value={formatMoney(opex)}
              />
              <Field
                label="NOI"
                value={formatMoney(activeScenario?.noi.toNumber() ?? null)}
              />
              <Field
                label="Annual debt service"
                value={formatMoney(
                  activeScenario?.annualDebtService.toNumber() ?? null
                )}
              />
              <Field
                label="Cap rate"
                value={formatPercent(activeScenario?.capRate.toNumber() ?? null)}
              />
              <Field
                label="DSCR"
                value={formatRatio(activeScenario?.dscr.toNumber() ?? null)}
              />
              <Field
                label="Cash-on-cash"
                value={formatPercent(activeScenario?.cashOnCash.toNumber() ?? null)}
              />
              <Field
                label="Break-even occupancy"
                value={formatPercent(
                  activeScenario?.breakEvenOccupancy.toNumber() ?? null
                )}
              />
              <Field
                label="Max offer (CoC)"
                value={formatMoney(
                  activeScenario?.maxOfferByCoc?.toNumber() ?? null
                )}
              />
              <Field
                label="Max offer (DSCR)"
                value={formatMoney(
                  activeScenario?.maxOfferByDscr?.toNumber() ?? null
                )}
              />
            </dl>
          </CardBody>
        </Card>
      </div>

      <div className="space-y-4">
        <ScoreBreakdown
          score={deal.score}
          decision={deal.decision as DecisionLabel}
          components={scoreComponents}
        />

        <Card>
          <CardHeader title="Targets" />
          <CardBody className="space-y-2 text-sm">
            <Row
              label="Cash-on-cash target"
              value={formatPercent(deal.targetCashOnCash.toNumber(), 1)}
            />
            <Row
              label="DSCR target"
              value={`${deal.targetDscr.toNumber().toFixed(2)}×`}
            />
            <Row
              label="Asking price"
              value={formatMoney(
                deal.askingPrice ? deal.askingPrice.toNumber() : null
              )}
            />
            <Row
              label="Target offer"
              value={formatMoney(
                deal.targetOfferPrice ? deal.targetOfferPrice.toNumber() : null
              )}
            />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

/* ── Tab: Underwriting ────────────────────────────────────────────────────── */

function toUnderwritingInitial(deal: DealRel): UnderwritingInitial {
  const decOr = (v: { toNumber(): number } | null, fb = 0) =>
    v === null ? fb : v.toNumber();
  const decOrNull = (v: { toNumber(): number } | null) =>
    v === null ? null : v.toNumber();
  return {
    status: deal.status,
    askingPrice: decOrNull(deal.askingPrice),
    targetOfferPrice: decOrNull(deal.targetOfferPrice),
    beds: deal.beds,
    baths: decOrNull(deal.baths),
    sleeps: deal.sleeps,
    squareFootage: deal.squareFootage,
    yearBuilt: deal.yearBuilt,

    purchasePrice: decOr(deal.purchasePrice),
    downPaymentPct: decOr(deal.downPaymentPct, 0.20),
    interestRate: decOr(deal.interestRate, 0.07),
    loanTermYears: deal.loanTermYears,
    interestOnly: deal.interestOnly,
    closingCosts: decOr(deal.closingCosts),
    renovationBudget: decOr(deal.renovationBudget),
    furnitureBudget: decOr(deal.furnitureBudget),
    initialReserves: decOr(deal.initialReserves),

    conservativeRevenue: decOrNull(deal.conservativeRevenue),
    baseRevenue: decOrNull(deal.baseRevenue),
    aggressiveRevenue: decOrNull(deal.aggressiveRevenue),
    adr: decOrNull(deal.adr),
    occupancyPct: decOrNull(deal.occupancyPct),
    cleaningFeesIncome: decOrNull(deal.cleaningFeesIncome),
    otherIncome: decOrNull(deal.otherIncome),

    propertyTaxes: decOrNull(deal.propertyTaxes),
    insurance: decOrNull(deal.insurance),
    utilities: decOrNull(deal.utilities),
    internet: decOrNull(deal.internet),
    repairsMaintenance: decOrNull(deal.repairsMaintenance),
    supplies: decOrNull(deal.supplies),
    cleaningExpense: decOrNull(deal.cleaningExpense),
    platformFeesPct: decOrNull(deal.platformFeesPct),
    propertyMgmtPct: decOrNull(deal.propertyMgmtPct),
    exteriorServices: decOrNull(deal.exteriorServices),
    hoa: decOrNull(deal.hoa),
    accounting: decOrNull(deal.accounting),
    miscExpense: decOrNull(deal.miscExpense),

    revenueConfidence: deal.revenueConfidence,
    compQualityRating: deal.compQualityRating,
    marketStrength: deal.marketStrength,
    upgradeUpside: deal.upgradeUpside,
    regulatoryRisk: deal.regulatoryRisk,
    maintenanceComplexity: deal.maintenanceComplexity,
    financingRisk: deal.financingRisk,

    targetCashOnCash: decOr(deal.targetCashOnCash, 0.10),
    targetDscr: decOr(deal.targetDscr, 1.25),
  };
}

function UnderwritingTab({
  dealId,
  initial,
  expenses,
}: {
  dealId: string;
  initial: UnderwritingInitial;
  expenses: ExpenseRow[];
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Underwriting inputs"
          action={
            <span className="text-xs text-brand-muted">
              Saving recomputes all 3 scenarios + score.
            </span>
          }
        />
        <CardBody>
          <UnderwritingForm dealId={dealId} initial={initial} />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Custom expense lines" />
        <CardBody>
          <ExpensesPanel dealId={dealId} expenses={expenses} />
        </CardBody>
      </Card>
    </div>
  );
}

function expenseToRow(e: DealRel["expenses"][number]): ExpenseRow {
  return {
    id: e.id,
    category: e.category,
    label: e.label,
    amount: e.amount.toNumber(),
    frequency: e.frequency,
    notes: e.notes,
  };
}

function memoToRow(m: DealRel["memos"][number]): MemoRow {
  return {
    id: m.id,
    scenarioType: m.scenarioType,
    propertySummary: m.propertySummary,
    revenueSummary: m.revenueSummary,
    compSummary: m.compSummary,
    keyStrengths: m.keyStrengths,
    keyRisks: m.keyRisks,
    knownLimits: m.knownLimits,
    baseCaseReturnPct: m.baseCaseReturnPct ? m.baseCaseReturnPct.toNumber() : null,
    downsideReturnPct: m.downsideReturnPct ? m.downsideReturnPct.toNumber() : null,
    recommendedOffer: m.recommendedOffer ? m.recommendedOffer.toNumber() : null,
    recommendation: m.recommendation,
    decision: m.decision,
    score: m.score,
    generator: m.generator,
    generatedAt: m.generatedAt.toISOString(),
  };
}

function compToRow(c: DealRel["comps"][number]): CompRow {
  return {
    id: c.id,
    name: c.name,
    listingUrl: c.listingUrl,
    distanceMiles: c.distanceMiles ? c.distanceMiles.toNumber() : null,
    beds: c.beds,
    baths: c.baths ? c.baths.toNumber() : null,
    sleeps: c.sleeps,
    adr: c.adr ? c.adr.toNumber() : null,
    occupancyPct: c.occupancyPct ? c.occupancyPct.toNumber() : null,
    annualRevenue: c.annualRevenue ? c.annualRevenue.toNumber() : null,
    reviewCount: c.reviewCount,
    rating: c.rating ? c.rating.toNumber() : null,
    hasHotTub: c.hasHotTub,
    hasSauna: c.hasSauna,
    hasPool: c.hasPool,
    hasGameRoom: c.hasGameRoom,
    hasFirepit: c.hasFirepit,
    hasViews: c.hasViews,
    hasWaterfront: c.hasWaterfront,
    hasSkiAccess: c.hasSkiAccess,
    notes: c.notes,
    qualityScore: c.qualityScore,
    source: c.source,
  };
}

/* ── Bits ────────────────────────────────────────────────────────────────── */

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-brand-muted">{label}</dt>
      <dd className="mt-0.5 text-brand-navy">{value}</dd>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-brand-muted">{label}</span>
      <span className="tabular-nums font-medium text-brand-navy">{value}</span>
    </div>
  );
}

function fmt(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return String(v);
}
