"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { STAGE_LABEL, stageColor, type Stage } from "@/lib/preview/fixtures";

const ALL_STAGES: Stage[] = [
  "NEW_LEAD",
  "CONTACTED",
  "QUALIFIED",
  "CONSULT_BOOKED",
  "CONSULT_COMPLETED",
  "PROPOSAL_DRAFTING",
  "PROPOSAL_SENT",
  "FOLLOW_UP_NEGOTIATION",
  "WON",
  "LOST",
  "COLD_NURTURE",
];

type Props = {
  leadId: string;
  currentStage: Stage;
  lostReasons: Array<{ code: string; label: string }>;
  disabled?: boolean;
};

/**
 * Inline stage editor. Renders as a pill matching the row's stage color;
 * clicking opens a compact dropdown. Picking LOST asks for a normalized
 * reason before firing the PATCH. Optimistic: shows the chosen stage on
 * the pill while the request is in flight, rolls back on error.
 */
export function LeadStagePill({ leadId, currentStage, lostReasons, disabled }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>(currentStage);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [askLost, setAskLost] = useState(false);
  const [reasonCode, setReasonCode] = useState(lostReasons[0]?.code ?? "");
  const [reasonNote, setReasonNote] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocClick(ev: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(ev.target as Node)) {
        setOpen(false);
        setAskLost(false);
      }
    }
    if (open || askLost) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open, askLost]);

  useEffect(() => setStage(currentStage), [currentStage]);

  async function commit(target: Stage, extras?: { lostReasonCode?: string; lostReasonNote?: string }) {
    setSubmitting(true);
    setErr(null);
    const before = stage;
    setStage(target); // optimistic
    try {
      const res = await fetch(`/api/leads/${leadId}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: target, ...extras }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStage(before);
        setErr(data.error ?? "Stage change failed");
        return;
      }
      setOpen(false);
      setAskLost(false);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  function pick(next: Stage, ev: React.MouseEvent) {
    ev.stopPropagation();
    ev.preventDefault();
    if (next === stage) {
      setOpen(false);
      return;
    }
    if (next === "LOST" && lostReasons.length > 0) {
      setAskLost(true);
      setOpen(false);
      return;
    }
    void commit(next);
  }

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          if (disabled) return;
          setOpen((v) => !v);
          setAskLost(false);
        }}
        disabled={disabled || submitting}
        title={disabled ? "Sign in to change stage" : "Change stage"}
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset transition ${stageColor(stage)} ${
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:brightness-95"
        }`}
      >
        <span>{STAGE_LABEL[stage]}</span>
        <span className="text-[9px] opacity-60">▾</span>
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-30 mt-1 w-56 rounded-lg border border-brand-hairline bg-white p-1 shadow-card-hover">
          {ALL_STAGES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={(e) => pick(s, e)}
              disabled={submitting || s === stage}
              className={`block w-full rounded px-2 py-1.5 text-left text-xs ${
                s === stage
                  ? "bg-brand-blue-tint text-brand-blue"
                  : "text-brand-navy hover:bg-brand-blue-tint"
              }`}
            >
              {STAGE_LABEL[s]}
              {s === stage ? <span className="ml-2 text-[10px] text-brand-muted">current</span> : null}
            </button>
          ))}
        </div>
      ) : null}

      {askLost ? (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute left-0 top-full z-40 mt-1 w-72 rounded-lg border border-brand-hairline bg-white p-3 shadow-card-hover"
        >
          <div className="text-xs font-semibold text-brand-navy">Mark as Lost</div>
          <select
            value={reasonCode}
            onChange={(e) => setReasonCode(e.target.value)}
            className="mt-2 block w-full rounded-md border border-brand-hairline bg-white px-2 py-1 text-xs text-brand-navy focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
          >
            {lostReasons.map((r) => (
              <option key={r.code} value={r.code}>
                {r.label}
              </option>
            ))}
          </select>
          <textarea
            value={reasonNote}
            onChange={(e) => setReasonNote(e.target.value)}
            rows={2}
            placeholder="Optional detail…"
            className="mt-2 block w-full rounded-md border border-brand-hairline bg-white px-2 py-1 text-xs text-brand-navy placeholder:text-brand-muted focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setAskLost(false);
              }}
              className="rounded-md border border-brand-hairline bg-white px-2 py-1 text-xs font-medium text-brand-navy hover:bg-brand-blue-tint"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void commit("LOST", {
                  lostReasonCode: reasonCode,
                  lostReasonNote: reasonNote || undefined,
                });
              }}
              disabled={submitting}
              className="rounded-md bg-rose-600 px-2 py-1 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
            >
              Mark Lost
            </button>
          </div>
        </div>
      ) : null}

      {err ? (
        <div className="absolute left-0 top-full mt-1 rounded-md bg-rose-100 px-2 py-0.5 text-[10px] text-rose-800">
          {err}
        </div>
      ) : null}
    </div>
  );
}
