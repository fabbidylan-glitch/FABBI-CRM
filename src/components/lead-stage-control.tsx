"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Stage =
  | "NEW_LEAD"
  | "CONTACTED"
  | "QUALIFIED"
  | "CONSULT_BOOKED"
  | "CONSULT_COMPLETED"
  | "PROPOSAL_DRAFTING"
  | "PROPOSAL_SENT"
  | "FOLLOW_UP_NEGOTIATION"
  | "WON"
  | "LOST"
  | "COLD_NURTURE";

const ALL_STAGES: { v: Stage; label: string }[] = [
  { v: "NEW_LEAD", label: "New Lead" },
  { v: "CONTACTED", label: "Contacted" },
  { v: "QUALIFIED", label: "Qualified" },
  { v: "CONSULT_BOOKED", label: "Consult Booked" },
  { v: "CONSULT_COMPLETED", label: "Consult Completed" },
  { v: "PROPOSAL_DRAFTING", label: "Proposal Drafting" },
  { v: "PROPOSAL_SENT", label: "Proposal Sent" },
  { v: "FOLLOW_UP_NEGOTIATION", label: "Follow-up / Negotiation" },
  { v: "WON", label: "Won" },
  { v: "LOST", label: "Lost" },
  { v: "COLD_NURTURE", label: "Cold Nurture" },
];

type Props = {
  leadId: string;
  currentStage: Stage;
  lostReasons: Array<{ id: string; code: string; label: string }>;
};

export function LeadStageControl({ leadId, currentStage, lostReasons }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Lost-reason modal state
  const [pendingLost, setPendingLost] = useState<{ stage: Stage } | null>(null);
  const [reasonCode, setReasonCode] = useState(lostReasons[0]?.code ?? "");
  const [reasonNote, setReasonNote] = useState("");

  async function send(stage: Stage, extras?: { lostReasonCode?: string; lostReasonNote?: string }) {
    setSubmitting(true);
    setErr(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage, ...extras }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error ?? "Stage change failed");
        return;
      }
      setOpen(false);
      setPendingLost(null);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  function pick(stage: Stage) {
    if (stage === currentStage) {
      setOpen(false);
      return;
    }
    if (stage === "LOST" && lostReasons.length > 0) {
      setPendingLost({ stage });
      return;
    }
    void send(stage);
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={submitting}
        className="rounded-md bg-brand-blue px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-blue-dark disabled:opacity-60"
      >
        Advance stage ▾
      </button>

      {open && !pendingLost ? (
        <div className="absolute right-0 z-20 mt-1 w-60 rounded-lg border border-brand-hairline bg-white p-1 shadow-card-hover">
          {ALL_STAGES.map((s) => (
            <button
              key={s.v}
              onClick={() => pick(s.v)}
              disabled={submitting || s.v === currentStage}
              className={`block w-full rounded px-2 py-1.5 text-left text-xs ${
                s.v === currentStage
                  ? "bg-brand-blue-tint text-brand-blue"
                  : "text-brand-navy hover:bg-brand-blue-tint"
              }`}
            >
              {s.label}
              {s.v === currentStage ? <span className="ml-2 text-[10px] text-brand-muted">current</span> : null}
            </button>
          ))}
        </div>
      ) : null}

      {pendingLost ? (
        <div className="absolute right-0 z-30 mt-1 w-80 rounded-lg border border-brand-hairline bg-white p-4 shadow-card-hover">
          <div className="text-sm font-semibold text-brand-navy">Mark as Lost</div>
          <p className="mt-1 text-xs text-brand-muted">
            Pick a reason — we normalize it for reporting.
          </p>
          <select
            value={reasonCode}
            onChange={(e) => setReasonCode(e.target.value)}
            className="mt-3 block w-full rounded-md border border-brand-hairline bg-white px-2 py-1.5 text-sm text-brand-navy focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
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
            placeholder="Optional detail (shown on timeline)…"
            className="mt-2 block w-full rounded-md border border-brand-hairline bg-white px-2 py-1.5 text-sm text-brand-navy placeholder:text-brand-muted focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
          />
          <div className="mt-3 flex justify-end gap-2">
            <button
              onClick={() => {
                setPendingLost(null);
                setReasonNote("");
              }}
              className="rounded-md border border-brand-hairline bg-white px-3 py-1.5 text-xs font-medium text-brand-navy hover:bg-brand-blue-tint"
            >
              Cancel
            </button>
            <button
              onClick={() =>
                send("LOST", { lostReasonCode: reasonCode, lostReasonNote: reasonNote || undefined })
              }
              disabled={submitting}
              className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
            >
              Mark Lost
            </button>
          </div>
        </div>
      ) : null}

      {err ? (
        <div className="absolute right-0 mt-1 rounded-md bg-rose-100 px-2 py-1 text-[11px] text-rose-800">
          {err}
        </div>
      ) : null}
    </div>
  );
}
