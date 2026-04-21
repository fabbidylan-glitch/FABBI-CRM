import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-brand-hairline/70 bg-white shadow-card transition hover:shadow-card-hover ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-brand-hairline px-5 py-3">
      <h3 className="text-sm font-semibold text-brand-navy">{title}</h3>
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
}: {
  label: string;
  value: string;
  hint?: string;
  /** Shown on hover — explains exactly how this number is computed. */
  tooltip?: string;
}) {
  return (
    <Card className="hover:-translate-y-0.5" >
      <div className="px-5 py-5" title={tooltip}>
        <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-muted">
          <span>{label}</span>
          {tooltip ? (
            <span
              aria-hidden
              className="text-brand-muted/60"
              title={tooltip}
            >
              &#9432;
            </span>
          ) : null}
        </div>
        <div className="mt-3 text-3xl font-semibold tracking-tight text-brand-navy tabular-nums">
          {value}
        </div>
        {hint ? <div className="mt-1 text-xs text-brand-muted">{hint}</div> : null}
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
  const tones: Record<string, string> = {
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
    emerald: "bg-emerald-100 text-emerald-800 ring-emerald-200",
    sky: "bg-sky-100 text-sky-800 ring-sky-200",
    amber: "bg-amber-100 text-amber-800 ring-amber-200",
    rose: "bg-rose-100 text-rose-800 ring-rose-200",
    indigo: "bg-indigo-100 text-indigo-800 ring-indigo-200",
    violet: "bg-violet-100 text-violet-800 ring-violet-200",
    brand: "bg-brand-blue-tint text-brand-blue ring-brand-blue-soft",
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
      className={`rounded-md bg-brand-blue px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-blue-dark ${className}`}
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
      className={`rounded-md border border-brand-hairline bg-white px-3 py-1.5 text-xs font-medium text-brand-navy transition hover:bg-brand-blue-tint ${className}`}
    >
      {children}
    </button>
  );
}
