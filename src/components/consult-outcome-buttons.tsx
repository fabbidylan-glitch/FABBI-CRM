"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui";

type Props = {
  leadId: string;
  canEdit: boolean;
};

/**
 * Shown on the lead detail page when the lead is at CONSULT_BOOKED. Two
 * actions:
 *   • Showed up → advances stage, bumps the show-rate KPI
 *   • No show   → enrolls in the rebooking sequence (instant email + SMS,
 *                 day-1 follow-up email, day-3 call task, day-6 final email)
 */
export function ConsultOutcomeButtons({ leadId, canEdit }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState<"SHOWED_UP" | "NO_SHOW" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  async function fire(outcome: "SHOWED_UP" | "NO_SHOW") {
    setSubmitting(outcome);
    setErr(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/consult-outcome`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error ?? "Something went wrong");
        return;
      }
      setFlash(
        outcome === "SHOWED_UP"
          ? "Marked as showed up. Stage advanced to Consult Completed."
          : "Marked as no-show. Rebooking sequence started."
      );
      router.refresh();
      setTimeout(() => setFlash(null), 4000);
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <Card>
      <CardHeader
        title="After the consult"
        action={<span className="text-xs text-brand-muted">Updates show rate</span>}
      />
      <CardBody className="space-y-3">
        <p className="text-xs text-brand-muted">
          Click one once the meeting time has passed. <strong>Showed up</strong> moves the lead
          forward. <strong>No show</strong> kicks off an automated rebooking sequence (instant
          email, SMS at +5 min, day-1 follow-up, day-3 call task, final email at day-6).
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => fire("SHOWED_UP")}
            disabled={!canEdit || submitting !== null}
            className="flex-1 rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting === "SHOWED_UP" ? "Saving…" : "✓ Showed up"}
          </button>
          <button
            onClick={() => fire("NO_SHOW")}
            disabled={!canEdit || submitting !== null}
            className="flex-1 rounded-md border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700 shadow-sm transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting === "NO_SHOW" ? "Saving…" : "✗ No show"}
          </button>
        </div>
        {err ? <div className="text-xs text-rose-700">{err}</div> : null}
        {flash ? (
          <div className="rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            {flash}
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
