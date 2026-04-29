import { Card, CardBody, CardHeader, Pill } from "@/components/ui";
import {
  formatMoney,
  formatPercent,
  formatRatio,
} from "@/lib/features/str/format";
import type { CompRow } from "@/components/str/comps-panel";

/**
 * Aggregate stats card for the Comps tab. Pure derivation from the raw rows
 * — kept here rather than in the panel so the math is reusable (the memo
 * generator and any future reports can call into the same helpers).
 */
export function CompSummary({ comps }: { comps: CompRow[] }) {
  const stats = aggregate(comps);
  if (stats.count === 0) return null;

  return (
    <Card>
      <CardHeader
        title="Comp summary"
        action={
          <Pill tone={stats.allManual ? "amber" : "slate"}>
            {stats.allManual ? "All manual" : "Mixed sources"}
          </Pill>
        }
      />
      <CardBody>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          <Cell label="Comps" value={String(stats.count)} />
          <Cell label="Avg ADR" value={formatMoney(stats.avgAdr, { decimals: 2 })} />
          <Cell
            label="Avg occupancy"
            value={formatPercent(stats.avgOccupancy, 0)}
          />
          <Cell
            label="Avg revenue"
            value={formatMoney(stats.avgRevenue)}
          />
          <Cell
            label="Avg quality"
            value={
              stats.avgQuality === null
                ? "—"
                : `${stats.avgQuality.toFixed(1)}/10`
            }
          />
        </div>
        {stats.topPerformer ? (
          <div className="mt-4 flex items-center gap-3 rounded-lg border border-emerald-200/60 bg-emerald-50/60 px-3 py-2 text-sm">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
              Top performer
            </span>
            <span className="font-medium text-brand-navy">
              {stats.topPerformer.name}
            </span>
            <span className="text-brand-muted">
              {formatMoney(stats.topPerformer.annualRevenue)}
              {stats.topPerformer.adr !== null
                ? ` · ${formatMoney(stats.topPerformer.adr, { decimals: 2 })} ADR`
                : ""}
              {stats.topPerformer.occupancyPct !== null
                ? ` · ${formatPercent(stats.topPerformer.occupancyPct, 0)} occ`
                : ""}
            </span>
          </div>
        ) : null}
        {stats.lowestPerformer && stats.topPerformer && stats.count > 1 ? (
          <div className="mt-2 flex items-center gap-3 text-xs text-brand-muted">
            <span className="font-medium">Spread:</span>
            <span>
              {formatMoney(stats.lowestPerformer.annualRevenue)} →{" "}
              {formatMoney(stats.topPerformer.annualRevenue)}
            </span>
            {stats.revenueSpreadRatio !== null ? (
              <span>({formatRatio(stats.revenueSpreadRatio, 1)})</span>
            ) : null}
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-brand-hairline/60 bg-white px-3 py-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-muted">
        {label}
      </div>
      <div className="mt-1 text-base font-semibold tabular-nums text-brand-navy">
        {value}
      </div>
    </div>
  );
}

type CompStats = {
  count: number;
  avgAdr: number | null;
  avgOccupancy: number | null;
  avgRevenue: number | null;
  avgQuality: number | null;
  topPerformer: CompRow | null;
  lowestPerformer: CompRow | null;
  revenueSpreadRatio: number | null;
  allManual: boolean;
};

function aggregate(comps: CompRow[]): CompStats {
  if (comps.length === 0) {
    return {
      count: 0,
      avgAdr: null,
      avgOccupancy: null,
      avgRevenue: null,
      avgQuality: null,
      topPerformer: null,
      lowestPerformer: null,
      revenueSpreadRatio: null,
      allManual: true,
    };
  }
  const avgAdr = avg(comps.map((c) => c.adr));
  const avgOccupancy = avg(comps.map((c) => c.occupancyPct));
  const avgRevenue = avg(comps.map((c) => c.annualRevenue));
  const avgQuality = avg(comps.map((c) => c.qualityScore));

  const withRev = comps.filter(
    (c): c is CompRow & { annualRevenue: number } =>
      c.annualRevenue !== null && Number.isFinite(c.annualRevenue)
  );
  const top = withRev.reduce<CompRow | null>(
    (best, c) =>
      best === null || (best.annualRevenue ?? 0) < c.annualRevenue ? c : best,
    null
  );
  const low = withRev.reduce<CompRow | null>(
    (worst, c) =>
      worst === null ||
      (worst.annualRevenue !== null && c.annualRevenue < worst.annualRevenue)
        ? c
        : worst,
    null
  );
  const spread =
    top && low && top.annualRevenue && low.annualRevenue
      ? top.annualRevenue / low.annualRevenue
      : null;

  return {
    count: comps.length,
    avgAdr,
    avgOccupancy,
    avgRevenue,
    avgQuality,
    topPerformer: top,
    lowestPerformer: low,
    revenueSpreadRatio: spread,
    allManual: comps.every((c) => c.source === "MANUAL"),
  };
}

function avg(nums: Array<number | null>): number | null {
  const xs = nums.filter((n): n is number => n !== null && Number.isFinite(n));
  if (xs.length === 0) return null;
  return xs.reduce((s, n) => s + n, 0) / xs.length;
}
