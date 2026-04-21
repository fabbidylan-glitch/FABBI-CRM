import type { ReactNode } from "react";
import { Sparkline } from "@/components/sparkline";

export function Card({
  children,
  className = "",
  interactive = false,
}: {
  children: ReactNode;
  className?: string;
  /** If true, the card will lift on hover. Reserve for clickable cards. */
  interactive?: boolean;
}) {
  const hover = interactive
    ? "transition duration-200 hover:-translate-y-0.5 hover:shadow-card-hover cursor-pointer"
    : "";
  return (
    <div
      className={`rounded-2xl border border-brand-hairline/60 bg-white shadow-card ${hover} ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-brand-hairline/70 px-5 py-3">
      <h3 className="text-[13px] font-semibold tracking-tight text-brand-navy">{title}</h3>
      {action}
    </div>
  );
}

export function CardBody({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`px-5 py-4 ${className}`}>{children}</div>;
}

export function Stat({
  label,
  value,
  hint,
  tooltip,
  trend,
  trendTone = "neutral",
  sparkline,
  sparklineColor,
}: {
  label: string;
  value: string;
  hint?: string;
  tooltip?: string;
  /** Optional trend chip — e.g. "+12%", "-4" — shown in the top-right corner. */
  trend?: string;
  trendTone?: "positive" | "negative" | "neutral";
  /** 7–30 numeric datapoints to render as a micro-trend under the number. */
  sparkline?: readonly number[];
  /** Defaults to brand blue. Pass a tone-appropriate hex to match the card. */
  sparklineColor?: string;
}) {
  const trendCls =
    trendTone === "positive"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
      : trendTone === "negative"
        ? "bg-rose-50 text-rose-700 ring-rose-100"
        : "bg-slate-50 text-slate-600 ring-slate-100";
  return (
    <Card className="transition duration-200 hover:-translate-y-0.5 hover:shadow-card-hover">
      <div className="px-5 py-5" title={tooltip}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-muted">
            <span>{label}</span>
            {tooltip ? (
              <span aria-hidden className="text-brand-muted/60" title={tooltip}>
                &#9432;
              </span>
            ) : null}
          </div>
          {trend ? (
            <span
              className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ring-1 ring-inset ${trendCls}`}
            >
              {trend}
            </span>
          ) : null}
        </div>
        <div className="mt-3 flex items-end justify-between gap-3">
          <div className="text-[2.125rem] font-semibold leading-none tracking-[-0.02em] text-brand-navy tabular-nums">
            {value}
          </div>
          {sparkline && sparkline.length > 1 ? (
            <Sparkline
              data={sparkline}
              color={sparklineColor ?? "#005bf7"}
              width={76}
              height={26}
              className="shrink-0"
            />
          ) : null}
        </div>
        {hint ? <div className="mt-2 text-xs text-brand-muted">{hint}</div> : null}
      </div>
    </Card>
  );
}

export function Pill({
  children,
  tone = "slate",
  className = "",
}: {
  children: ReactNode;
  tone?: "slate" | "emerald" | "sky" | "amber" | "rose" | "indigo" | "violet" | "brand" | "navy";
  className?: string;
}) {
  // Softer bg (50) + mid text (700) + translucent ring — feels less "Tailwind default".
  const tones: Record<string, string> = {
    slate: "bg-slate-50 text-slate-700 ring-slate-200/80",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200/80",
    sky: "bg-sky-50 text-sky-700 ring-sky-200/80",
    amber: "bg-amber-50 text-amber-800 ring-amber-200/80",
    rose: "bg-rose-50 text-rose-700 ring-rose-200/80",
    indigo: "bg-indigo-50 text-indigo-700 ring-indigo-200/80",
    violet: "bg-violet-50 text-violet-700 ring-violet-200/80",
    brand: "bg-brand-blue-tint text-brand-blue ring-brand-blue-soft/60",
    navy: "bg-brand-navy text-white ring-brand-navy",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function RawPill({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${className}`}
    >
      {children}
    </span>
  );
}

export function PrimaryButton({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      className={`rounded-md bg-brand-blue px-3 py-1.5 text-xs font-semibold text-white shadow-btn-primary transition hover:bg-brand-blue-dark active:translate-y-px ${className}`}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      className={`rounded-md border border-brand-hairline bg-white px-3 py-1.5 text-xs font-medium text-brand-navy transition hover:border-brand-blue-soft hover:bg-brand-blue-tint hover:text-brand-navy ${className}`}
    >
      {children}
    </button>
  );
}
