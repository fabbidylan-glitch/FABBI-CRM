"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DecisionBadge } from "@/components/str/decision-badge";
import {
  formatMoney,
  formatPercent,
  type DecisionLabel,
} from "@/lib/features/str/format";

export type MemoRow = {
  id: string;
  scenarioType: string;
  propertySummary: string;
  revenueSummary: string;
  compSummary: string;
  keyStrengths: string[];
  keyRisks: string[];
  knownLimits: string[];
  baseCaseReturnPct: number | null;
  downsideReturnPct: number | null;
  recommendedOffer: number | null;
  recommendation: string;
  decision: string | null;
  score: number | null;
  generator: string;
  generatedAt: string; // ISO
};

/**
 * Memo tab. Displays the latest persisted memo, with controls to regenerate
 * and to copy as plain text for pasting into an investment-committee doc.
 *
 * Print-friendly: applies a `print:` Tailwind path so the print output
 * collapses chrome and shows the memo body cleanly.
 */
export function MemoPanel({
  dealId,
  dealName,
  memos,
}: {
  dealId: string;
  dealName: string;
  memos: MemoRow[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"idle" | "ok" | "err">("idle");
  const latest = memos[0] ?? null;

  async function handleRegenerate() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/str-deals/${dealId}/memo`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Generate failed (${res.status})`);
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generate failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleCopy() {
    if (!latest) return;
    try {
      await navigator.clipboard.writeText(memoToText(dealName, latest));
      setCopied("ok");
      setTimeout(() => setCopied("idle"), 2000);
    } catch {
      setCopied("err");
      setTimeout(() => setCopied("idle"), 2000);
    }
  }

  function handlePrint() {
    if (typeof window !== "undefined") window.print();
  }

  if (!latest) {
    return (
      <div className="rounded-2xl border border-brand-hairline/60 bg-white p-8 text-center shadow-card">
        <h3 className="text-base font-semibold text-brand-navy">
          No memo generated yet
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-brand-muted">
          The memo pulls from the deal's current inputs and produces a
          deterministic summary you can paste into committee notes.
        </p>
        {error ? (
          <div className="mx-auto mt-4 max-w-md rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        ) : null}
        <button
          type="button"
          onClick={handleRegenerate}
          disabled={busy}
          className="mt-6 rounded-md bg-brand-blue px-4 py-2 text-xs font-semibold text-white shadow-btn-primary transition hover:bg-brand-blue-dark disabled:opacity-60"
        >
          {busy ? "Generating…" : "Generate memo"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="text-xs text-brand-muted">
          Generated {new Date(latest.generatedAt).toLocaleString()} ·{" "}
          {latest.generator === "template" ? "Deterministic template" : latest.generator}
          {memos.length > 1 ? (
            <>
              {" · "}
              <span className="text-brand-navy">
                {memos.length} version{memos.length === 1 ? "" : "s"}
              </span>
            </>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-md border border-brand-hairline bg-white px-3 py-1.5 text-xs font-medium text-brand-navy transition hover:bg-brand-blue-tint"
          >
            {copied === "ok"
              ? "Copied!"
              : copied === "err"
                ? "Copy failed"
                : "Copy as text"}
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="rounded-md border border-brand-hairline bg-white px-3 py-1.5 text-xs font-medium text-brand-navy transition hover:bg-brand-blue-tint"
          >
            Print / PDF
          </button>
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={busy}
            className="rounded-md bg-brand-blue px-3 py-1.5 text-xs font-semibold text-white shadow-btn-primary transition hover:bg-brand-blue-dark disabled:opacity-60"
          >
            {busy ? "Generating…" : "Regenerate"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 print:hidden">
          {error}
        </div>
      ) : null}

      <article className="rounded-2xl border border-brand-hairline/60 bg-white px-8 py-7 shadow-card print:rounded-none print:border-0 print:shadow-none">
        {/* Header */}
        <header className="border-b border-brand-hairline pb-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-muted">
            Acquisition memo
          </div>
          <h2 className="mt-1 text-2xl font-semibold tracking-[-0.01em] text-brand-navy">
            {dealName}
          </h2>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <DecisionBadge decision={latest.decision as DecisionLabel} />
            {latest.score !== null ? (
              <span className="text-brand-muted">
                Score{" "}
                <span className="font-medium text-brand-navy">{latest.score}</span>/100
              </span>
            ) : null}
            <span className="text-brand-muted">
              Scenario{" "}
              <span className="font-medium text-brand-navy">
                {latest.scenarioType}
              </span>
            </span>
          </div>
        </header>

        <Section title="Property">
          <p>{latest.propertySummary}</p>
        </Section>

        <Section title="Revenue">
          <p>{latest.revenueSummary}</p>
        </Section>

        <Section title="Comps">
          <p>{latest.compSummary}</p>
        </Section>

        <Section title="Key strengths">
          <Bullets items={latest.keyStrengths} fallback="None identified." />
        </Section>

        <Section title="Key risks">
          <Bullets items={latest.keyRisks} fallback="None identified." />
        </Section>

        <Section title="Returns" tone="muted">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-3">
            <Field
              label="Base-case return"
              value={formatPercent(latest.baseCaseReturnPct, 1)}
            />
            <Field
              label="Downside return"
              value={formatPercent(latest.downsideReturnPct, 1)}
            />
            <Field
              label="Recommended offer"
              value={formatMoney(latest.recommendedOffer)}
            />
          </dl>
        </Section>

        <Section title="Recommendation">
          <p className="font-medium text-brand-navy">{latest.recommendation}</p>
        </Section>

        {latest.knownLimits.length > 0 ? (
          <Section
            title="Known limits / data confidence"
            tone="warn"
          >
            <Bullets items={latest.knownLimits} />
          </Section>
        ) : null}
      </article>
    </div>
  );
}

function Section({
  title,
  tone,
  children,
}: {
  title: string;
  tone?: "muted" | "warn";
  children: React.ReactNode;
}) {
  const wrap =
    tone === "warn"
      ? "mt-6 rounded-lg border border-amber-200/60 bg-amber-50/40 px-4 py-3"
      : tone === "muted"
        ? "mt-6 rounded-lg border border-brand-hairline/60 bg-slate-50/60 px-4 py-3"
        : "mt-6";
  const titleCls =
    tone === "warn" ? "text-amber-800" : "text-brand-muted";
  return (
    <section className={wrap}>
      <h3
        className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${titleCls}`}
      >
        {title}
      </h3>
      <div className="mt-2 text-sm leading-relaxed text-brand-navy">
        {children}
      </div>
    </section>
  );
}

function Bullets({ items, fallback }: { items: string[]; fallback?: string }) {
  if (items.length === 0) {
    return <p className="text-brand-muted">{fallback ?? "—"}</p>;
  }
  return (
    <ul className="list-disc space-y-1 pl-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-muted">
        {label}
      </dt>
      <dd className="mt-0.5 font-medium tabular-nums text-brand-navy">{value}</dd>
    </div>
  );
}

/** Plain-text export. Mirrors the visual layout so pastes into Notion / Slack
 * / a Google Doc come out readable. */
function memoToText(dealName: string, m: MemoRow): string {
  const lines: string[] = [];
  lines.push(`ACQUISITION MEMO — ${dealName}`);
  lines.push("=".repeat(60));
  lines.push("");
  lines.push(
    `Decision: ${m.decision ?? "—"}` +
      (m.score !== null ? `   Score: ${m.score}/100` : "") +
      `   Scenario: ${m.scenarioType}`
  );
  lines.push(`Generated: ${new Date(m.generatedAt).toLocaleString()}`);
  lines.push("");
  lines.push("PROPERTY");
  lines.push(m.propertySummary);
  lines.push("");
  lines.push("REVENUE");
  lines.push(m.revenueSummary);
  lines.push("");
  lines.push("COMPS");
  lines.push(m.compSummary);
  lines.push("");
  lines.push("KEY STRENGTHS");
  if (m.keyStrengths.length === 0) lines.push("  - none identified");
  else for (const s of m.keyStrengths) lines.push(`  - ${s}`);
  lines.push("");
  lines.push("KEY RISKS");
  if (m.keyRisks.length === 0) lines.push("  - none identified");
  else for (const s of m.keyRisks) lines.push(`  - ${s}`);
  lines.push("");
  lines.push("RETURNS");
  lines.push(
    `  Base-case return: ${formatPercent(m.baseCaseReturnPct, 1)}` +
      `   Downside: ${formatPercent(m.downsideReturnPct, 1)}` +
      `   Recommended offer: ${formatMoney(m.recommendedOffer)}`
  );
  lines.push("");
  lines.push("RECOMMENDATION");
  lines.push(m.recommendation);
  if (m.knownLimits.length > 0) {
    lines.push("");
    lines.push("KNOWN LIMITS / DATA CONFIDENCE");
    for (const s of m.knownLimits) lines.push(`  - ${s}`);
  }
  return lines.join("\n");
}
