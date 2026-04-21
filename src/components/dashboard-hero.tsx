import { Sparkline } from "@/components/sparkline";
import { formatCurrency } from "@/lib/preview/fixtures";

type Props = {
  monthToDateArr: number;
  arrSeries: readonly number[];
  previousMonthArr: number;
  leadsThisMonth: number;
  wonThisMonth: number;
  pipelineValue: number;
};

/**
 * The dashboard's single headline number — "what's happening in the business
 * right now?". New ARR MTD, with a month-over-month delta and a 30-day
 * cumulative curve. Designed to be the first thing the eye lands on.
 */
export function DashboardHero({
  monthToDateArr,
  arrSeries,
  previousMonthArr,
  leadsThisMonth,
  wonThisMonth,
  pipelineValue,
}: Props) {
  const delta = computeDelta(monthToDateArr, previousMonthArr);

  // Build a cumulative curve from daily ARR — a rising line reads more like
  // "progress" than a spiky day-to-day bar. Drop zero-padding at the front
  // so the curve fills the space.
  const cumulative: number[] = [];
  let running = 0;
  for (const v of arrSeries) {
    running += v;
    cumulative.push(running);
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-brand-hairline/50 bg-gradient-to-br from-brand-navy via-[#0b2251] to-brand-blue-dark text-white shadow-card">
      {/* Soft radial highlight — just enough to lift the plate */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-brand-blue/30 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-10 bottom-0 h-40 w-64 rounded-full bg-[#0b2251]/0 blur-3xl"
      />
      <div className="relative grid grid-cols-1 gap-6 px-6 py-6 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-blue-soft/80">
            New ARR · this month
            {delta ? (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ring-1 ring-inset ${
                  delta.tone === "positive"
                    ? "bg-emerald-400/10 text-emerald-200 ring-emerald-400/30"
                    : delta.tone === "negative"
                      ? "bg-rose-400/10 text-rose-200 ring-rose-400/30"
                      : "bg-white/10 text-white/80 ring-white/20"
                }`}
              >
                {delta.label} vs last mo
              </span>
            ) : null}
          </div>
          <div className="mt-2 flex items-baseline gap-3 tabular-nums">
            <span className="text-5xl font-semibold tracking-[-0.02em] md:text-6xl">
              {formatCurrency(monthToDateArr)}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-white/70">
            <Stat label="Leads this month" value={leadsThisMonth} />
            <Stat label="Won this month" value={wonThisMonth} />
            <Stat label="Pipeline value" value={formatCurrency(pipelineValue)} />
          </div>
        </div>

        <div className="min-w-0">
          <Sparkline
            data={cumulative.length > 1 ? cumulative : [0, 0]}
            color="#8fb6ff"
            width={280}
            height={72}
            className="w-full"
          />
          <div className="mt-1 text-[10px] uppercase tracking-wider text-white/50">
            Cumulative · last 30 days
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-white/45">{label}</div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums text-white">{value}</div>
    </div>
  );
}

function computeDelta(
  current: number,
  previous: number
): { label: string; tone: "positive" | "negative" | "neutral" } | undefined {
  if (current === 0 && previous === 0) return undefined;
  if (previous === 0) return { label: "New", tone: "positive" };
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return { label: "0%", tone: "neutral" };
  const sign = pct > 0 ? "+" : "";
  return { label: `${sign}${pct}%`, tone: pct > 0 ? "positive" : "negative" };
}
