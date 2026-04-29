import { Card, CardBody, CardHeader } from "@/components/ui";
import { DecisionBadge } from "@/components/str/decision-badge";
import type { DecisionLabel } from "@/lib/features/str/format";
import type { ScoreComponent } from "@/lib/str/score";

/**
 * Per-component score breakdown. Each row shows the component label, the
 * current detail (e.g. "12.5% vs target 10.0%"), the weight that component
 * carries in the final score, and a horizontal bar showing the *weighted*
 * contribution (raw × weight) on a 0–weight scale.
 *
 * The width math: each component can contribute at most `weight × 100` points.
 * We render a bar that's `(weighted / weight) × 100%` wide of the component's
 * row — full width = component fully delivered, 50% = half-delivered, etc.
 */
export function ScoreBreakdown({
  score,
  decision,
  components,
}: {
  score: number | null;
  decision: DecisionLabel;
  components: ScoreComponent[];
}) {
  return (
    <Card>
      <CardHeader
        title="Score breakdown"
        action={
          <span className="text-[11px] uppercase tracking-wide text-brand-muted">
            Weighted ÷ 100
          </span>
        }
      />
      <CardBody className="space-y-4">
        <div className="flex items-end justify-between">
          <div className="text-4xl font-semibold tabular-nums text-brand-navy">
            {score ?? "—"}
          </div>
          <DecisionBadge decision={decision} />
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-brand-blue-tint">
          <div
            className="h-full rounded-full bg-brand-blue"
            style={{ width: `${Math.min(100, score ?? 0)}%` }}
          />
        </div>

        <ul className="space-y-2.5 pt-2">
          {components.map((c) => {
            const filled = c.weight === 0 ? 0 : (c.weighted / c.weight) * 100;
            const points = (c.weighted * 100).toFixed(1);
            const max = (c.weight * 100).toFixed(0);
            return (
              <li key={c.label}>
                <div className="flex items-baseline justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <div className="font-medium text-brand-navy">{c.label}</div>
                    <div className="text-[11px] text-brand-muted">{c.detail}</div>
                  </div>
                  <div className="shrink-0 text-right tabular-nums">
                    <div className="font-medium text-brand-navy">
                      {points}
                      <span className="text-brand-muted"> / {max}</span>
                    </div>
                    <div className="text-[10px] uppercase tracking-wide text-brand-muted">
                      Weight {(c.weight * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full transition-all ${barColor(filled)}`}
                    style={{ width: `${Math.min(100, Math.max(0, filled))}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </CardBody>
    </Card>
  );
}

function barColor(pct: number): string {
  if (pct >= 80) return "bg-emerald-500";
  if (pct >= 60) return "bg-sky-500";
  if (pct >= 40) return "bg-amber-500";
  return "bg-rose-500";
}
