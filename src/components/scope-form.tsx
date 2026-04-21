"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { calculatePricing } from "@/lib/pricing/calculate";
import {
  SCOPING_DEFAULTS,
  SCOPING_QUESTIONS,
  type ScopingInput,
  type QuestionSection,
} from "@/lib/pricing/scoping";

type Props = {
  leadId: string;
  canSubmit: boolean;
  defaultIndustry?: string;
};

const SECTION_ORDER: QuestionSection[] = [
  "Business shape",
  "Books + accounts",
  "Operational modules",
  "One-time work",
  "Advisory",
  "Notes",
];

export function ScopeForm({ leadId, canSubmit, defaultIndustry }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<ScopingInput>(() => ({
    ...SCOPING_DEFAULTS,
    industry: defaultIndustry ?? SCOPING_DEFAULTS.industry,
  }));
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Live calc — this is the whole value prop of the pricing engine. Reps
  // watch the number move as they answer questions, so they stay calibrated.
  const pricing = useMemo(() => calculatePricing(form), [form]);

  function set<K extends keyof ScopingInput>(k: K, v: ScopingInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit() {
    setSubmitting(true);
    setErr(null);
    try {
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, scoping: form }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data?.error ?? "Failed to save quote");
        return;
      }
      router.push(`/leads/${leadId}/proposal/${data.proposalId}`);
    } catch {
      setErr("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        {SECTION_ORDER.map((section) => {
          const questions = SCOPING_QUESTIONS.filter((q) => q.section === section);
          if (questions.length === 0) return null;
          return (
            <section key={section}>
              <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-muted">
                {section}
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {questions.map((q) => (
                  <Field
                    key={q.key}
                    question={q}
                    value={form[q.key]}
                    onChange={(v) => set(q.key, v as never)}
                  />
                ))}
              </div>
            </section>
          );
        })}

        {err ? (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
            {err}
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-2 border-t border-brand-hairline pt-4">
          <button
            type="button"
            onClick={() => setForm({ ...SCOPING_DEFAULTS, industry: defaultIndustry ?? SCOPING_DEFAULTS.industry })}
            className="rounded-md border border-brand-hairline bg-white px-3 py-1.5 text-xs font-medium text-brand-navy hover:bg-brand-blue-tint"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit || submitting}
            title={canSubmit ? undefined : "Database + auth required"}
            className="rounded-md bg-brand-blue px-4 py-1.5 text-xs font-semibold text-white shadow-btn-primary transition hover:bg-brand-blue-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Saving…" : "Save + generate proposal"}
          </button>
        </div>
      </div>

      <LivePriceRail pricing={pricing} />
    </div>
  );
}

function LivePriceRail({ pricing }: { pricing: ReturnType<typeof calculatePricing> }) {
  return (
    <aside className="lg:sticky lg:top-24 lg:self-start">
      <div className="overflow-hidden rounded-2xl border border-brand-hairline/70 bg-white shadow-card">
        <div className="border-b border-brand-hairline/70 bg-gradient-to-br from-brand-navy to-brand-blue-dark px-5 py-4 text-white">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-blue-soft/80">
            Recommended monthly
          </div>
          <div className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">
            ${pricing.monthlyRecommended.toLocaleString()}
          </div>
          <div className="mt-2 flex items-center gap-3 text-[11px] text-white/70">
            <span>
              Floor <span className="tabular-nums">${pricing.monthlyFloor.toLocaleString()}</span>
            </span>
            <span>
              Stretch <span className="tabular-nums">${pricing.monthlyStretch.toLocaleString()}</span>
            </span>
          </div>
        </div>

        <div className="px-5 py-4 text-xs">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-semibold text-brand-navy">Complexity</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${complexityTone(pricing.complexityLevel)}`}
            >
              {pricing.complexityLevel.replaceAll("_", " ")}
            </span>
          </div>

          {pricing.onetimeTotal > 0 ? (
            <div className="mb-3 rounded-lg bg-slate-50 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-muted">
                One-time
              </div>
              <div className="mt-1 text-lg font-semibold tabular-nums text-brand-navy">
                ${pricing.onetimeTotal.toLocaleString()}
              </div>
              <div className="mt-1 space-y-0.5 text-[11px] text-brand-muted">
                {pricing.catchupQuote > 0 ? (
                  <div>
                    Catch-up{" "}
                    <span className="tabular-nums">${pricing.catchupQuote.toLocaleString()}</span>
                  </div>
                ) : null}
                {pricing.taxQuote > 0 ? (
                  <div>
                    Tax prep{" "}
                    <span className="tabular-nums">${pricing.taxQuote.toLocaleString()}</span>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-brand-muted">
              Build log
            </div>
            <ul className="space-y-0.5 text-[11px] text-brand-navy">
              {pricing.buildLog.map((row, i) => (
                <li key={i} className="flex items-center justify-between">
                  <span className="truncate text-brand-muted">{row.label}</span>
                  <span className="tabular-nums">
                    {row.amount >= 0 ? "+" : ""}${Math.round(row.amount).toLocaleString()}
                  </span>
                </li>
              ))}
              {pricing.advisoryMonthly > 0 ? (
                <li className="flex items-center justify-between border-t border-brand-hairline/70 pt-1 text-brand-navy">
                  <span>Advisory (separate)</span>
                  <span className="tabular-nums">+${pricing.advisoryMonthly.toLocaleString()}</span>
                </li>
              ) : null}
            </ul>
          </div>
        </div>
      </div>
    </aside>
  );
}

function complexityTone(level: string): string {
  switch (level) {
    case "SIMPLE":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200/80";
    case "STANDARD":
      return "bg-slate-50 text-slate-700 ring-slate-200/80";
    case "COMPLEX":
      return "bg-amber-50 text-amber-800 ring-amber-200/80";
    case "VERY_COMPLEX":
      return "bg-rose-50 text-rose-700 ring-rose-200/80";
    default:
      return "bg-slate-50 text-slate-700 ring-slate-200/80";
  }
}

function Field({
  question,
  value,
  onChange,
}: {
  question: (typeof SCOPING_QUESTIONS)[number];
  value: ScopingInput[keyof ScopingInput];
  onChange: (v: unknown) => void;
}) {
  const inputCls =
    "mt-1 block w-full rounded-md border border-brand-hairline bg-white px-3 py-2 text-sm text-brand-navy focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20";

  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-muted">
        {question.label}
      </span>
      {question.type === "select" && question.options ? (
        <select value={value as string} onChange={(e) => onChange(e.target.value)} className={inputCls}>
          {question.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : question.type === "number" ? (
        <input
          type="number"
          value={value as number}
          min={0}
          onChange={(e) => onChange(Number(e.target.value || 0))}
          className={inputCls}
        />
      ) : question.type === "boolean" ? (
        <div className="mt-1 flex items-center gap-2">
          <button
            type="button"
            onClick={() => onChange(!value)}
            className={`inline-flex h-5 w-9 items-center rounded-full transition ${
              value ? "bg-brand-blue" : "bg-slate-200"
            }`}
            aria-pressed={value as boolean}
          >
            <span
              className={`h-4 w-4 rounded-full bg-white shadow transition ${
                value ? "translate-x-[18px]" : "translate-x-0.5"
              }`}
            />
          </button>
          <span className="text-xs text-brand-navy">{(value as boolean) ? "Yes" : "No"}</span>
        </div>
      ) : (
        <textarea
          value={(value as string | undefined) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          className={inputCls}
        />
      )}
      {question.hint ? <span className="mt-1 block text-[11px] text-brand-muted">{question.hint}</span> : null}
    </label>
  );
}
