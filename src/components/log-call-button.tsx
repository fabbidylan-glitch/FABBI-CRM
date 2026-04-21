"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Props = {
  leadId: string;
  phoneE164?: string | null;
};

const OUTCOMES = [
  { value: "CONNECTED", label: "Connected" },
  { value: "VOICEMAIL", label: "Left voicemail" },
  { value: "NO_ANSWER", label: "No answer" },
  { value: "NOT_INTERESTED", label: "Not interested" },
  { value: "BAD_NUMBER", label: "Bad number" },
] as const;

/**
 * One-click call logger. Opens a tiny popover with outcome + notes; posts to
 * /api/leads/[id]/log-call which creates the Communication row, bumps
 * lastContactedAt, and closes any open CALL task so the rep doesn't have to
 * double-touch the UI.
 */
export function LogCallButton({ leadId, phoneE164 }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState<(typeof OUTCOMES)[number]["value"]>("CONNECTED");
  const [duration, setDuration] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (open && popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  async function submit() {
    setSubmitting(true);
    setErr(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/log-call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outcome,
          durationMinutes: duration.trim() === "" ? undefined : Number(duration),
          notes: notes.trim() || undefined,
          completeOpenCallTask: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data?.error ?? "Failed to log call");
        return;
      }
      setOpen(false);
      setOutcome("CONNECTED");
      setDuration("");
      setNotes("");
      router.refresh();
    } catch {
      setErr("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div ref={popoverRef} className="relative inline-block">
      <div className="flex items-center gap-2">
        {phoneE164 ? (
          <a
            href={`tel:${phoneE164}`}
            className="rounded-md bg-brand-blue px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-blue-dark"
          >
            Call now
          </a>
        ) : null}
        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-md border border-brand-hairline bg-white px-3 py-1.5 text-xs font-medium text-brand-navy hover:bg-brand-blue-tint"
        >
          Log call
        </button>
      </div>

      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-80 rounded-lg border border-brand-hairline bg-white p-4 shadow-card-hover">
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-brand-muted">
                Outcome
              </label>
              <select
                value={outcome}
                onChange={(e) => setOutcome(e.target.value as typeof outcome)}
                className={inputCls}
              >
                {OUTCOMES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-brand-muted">
                Duration (min)
              </label>
              <input
                type="number"
                min={0}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="e.g. 8"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-brand-muted">
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Quick summary of what they said"
                className={inputCls}
              />
            </div>
            {err ? (
              <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs text-rose-800">
                {err}
              </div>
            ) : null}
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-brand-hairline bg-white px-3 py-1.5 text-xs font-medium text-brand-navy hover:bg-brand-blue-tint"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={submitting}
                className="rounded-md bg-brand-blue px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-blue-dark disabled:opacity-60"
              >
                {submitting ? "Logging…" : "Log call"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const inputCls =
  "mt-1 block w-full rounded-md border border-brand-hairline bg-white px-3 py-1.5 text-sm text-brand-navy placeholder:text-brand-muted focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20";
