import { Card, CardBody, CardHeader } from "@/components/ui";
import type { FunnelStage } from "@/lib/features/dashboard/timeseries";

type Props = {
  stages: FunnelStage[];
  days: number;
};

/**
 * Horizontal conversion funnel — each row is a stage, bar width is
 * proportional to the top-of-funnel count. Drop-off between stages is shown
 * between rows so the eye reads "X leads → lost Y% → Z qualified" naturally.
 *
 * Rendered server-side; pure HTML/CSS. No tooltip layer, no animation — we
 * want the dashboard to load instantly on Neon cold-start.
 */
export function PipelineFunnel({ stages, days }: Props) {
  const top = stages[0]?.count ?? 0;
  const hasData = stages.some((s) => s.count > 0);

  return (
    <Card>
      <CardHeader
        title="Pipeline funnel"
        action={<span className="text-[11px] text-brand-muted">Last {days} days</span>}
      />
      <CardBody>
        {!hasData ? (
          <div className="py-4 text-center text-xs text-brand-muted">
            No leads have entered the pipeline in the last {days} days yet.
          </div>
        ) : (
          <div className="space-y-3">
            {stages.map((s, i) => {
              const pct = top > 0 ? Math.max(3, Math.round((s.count / top) * 100)) : 0;
              return (
                <div key={s.key}>
                  {i > 0 && s.dropOffPct !== null ? (
                    <div className="mb-1 flex items-center gap-2 pl-1 text-[10px] text-brand-muted">
                      <span aria-hidden className="inline-block h-3 w-px bg-brand-hairline" />
                      <span>
                        <span className={s.dropOffPct > 60 ? "text-rose-600" : s.dropOffPct > 30 ? "text-amber-700" : "text-emerald-700"}>
                          {s.dropOffPct}% drop-off
                        </span>
                      </span>
                    </div>
                  ) : null}
                  <div className="flex items-center gap-3">
                    <div className="w-32 shrink-0 text-xs font-medium text-brand-navy">{s.label}</div>
                    <div className="relative h-6 flex-1 overflow-hidden rounded-md bg-slate-50 ring-1 ring-inset ring-brand-hairline/50">
                      <div
                        className={`h-full rounded-md ${i === 0 ? "bg-gradient-to-r from-brand-blue to-brand-blue-dark" : i === stages.length - 1 ? "bg-gradient-to-r from-emerald-500 to-emerald-600" : "bg-gradient-to-r from-brand-blue/80 to-brand-blue-dark/80"}`}
                        style={{ width: `${pct}%` }}
                      />
                      <div className="absolute inset-y-0 left-2 flex items-center text-[11px] font-semibold tabular-nums text-white">
                        {s.count > 0 ? s.count : ""}
                      </div>
                    </div>
                    <div className="w-14 shrink-0 text-right text-xs tabular-nums text-brand-navy">
                      {top > 0 ? `${Math.round((s.count / top) * 100)}%` : "—"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
