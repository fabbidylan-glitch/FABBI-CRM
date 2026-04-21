"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  proposalId: string;
  leadId: string;
  status: string;
  canEdit: boolean;
  sentAt: string | null;
  acceptedAt: string | null;
  declinedAt: string | null;
  declineReason: string | null;
};

export function ProposalActions({
  proposalId,
  leadId,
  status,
  canEdit,
  sentAt,
  acceptedAt,
  declinedAt,
  declineReason,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function action(kind: "send" | "accept" | "decline", reason?: string) {
    setLoading(kind);
    setErr(null);
    try {
      const res = await fetch(`/api/proposals/${proposalId}/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: reason ? JSON.stringify({ reason }) : JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data?.error ?? `Failed to ${kind} proposal`);
        return;
      }
      router.refresh();
    } catch {
      setErr("Network error");
    } finally {
      setLoading(null);
    }
  }

  const isTerminal = status === "ACCEPTED" || status === "DECLINED" || status === "WITHDRAWN";

  return (
    <div className="space-y-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-muted">
        Actions
      </div>

      {status === "DRAFT" ? (
        <button
          type="button"
          disabled={!canEdit || loading !== null}
          onClick={() => action("send")}
          className="w-full rounded-md bg-brand-blue px-3 py-2 text-xs font-semibold text-white shadow-btn-primary transition hover:bg-brand-blue-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading === "send" ? "Sending…" : "Mark as sent"}
        </button>
      ) : null}

      {(status === "SENT" || status === "VIEWED") ? (
        <>
          <button
            type="button"
            disabled={!canEdit || loading !== null}
            onClick={() => action("accept")}
            className="w-full rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-btn-primary transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading === "accept" ? "Accepting…" : "Mark accepted"}
          </button>
          <DeclineBlock disabled={!canEdit || loading !== null} onDecline={(r) => action("decline", r)} loading={loading === "decline"} />
        </>
      ) : null}

      {isTerminal ? (
        <div className="rounded-md bg-slate-50 px-3 py-2 text-xs text-brand-muted">
          {status === "ACCEPTED" ? (
            <>
              Accepted {acceptedAt ? new Date(acceptedAt).toLocaleDateString() : ""}. Onboarding record created — continue in the lead record.
            </>
          ) : status === "DECLINED" ? (
            <>
              Declined {declinedAt ? new Date(declinedAt).toLocaleDateString() : ""}
              {declineReason ? `: ${declineReason}` : "."}
            </>
          ) : (
            <>Withdrawn.</>
          )}
        </div>
      ) : null}

      {sentAt ? (
        <div className="text-[11px] text-brand-muted">
          Sent {new Date(sentAt).toLocaleString()}
        </div>
      ) : null}

      {err ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {err}
        </div>
      ) : null}

      <div className="border-t border-brand-hairline pt-3">
        <a
          href={`/leads/${leadId}/scope`}
          className="block text-center text-[11px] text-brand-blue hover:underline"
        >
          Re-scope (creates new quote)
        </a>
      </div>
    </div>
  );
}

function DeclineBlock({
  disabled,
  loading,
  onDecline,
}: {
  disabled: boolean;
  loading: boolean;
  onDecline: (reason: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  if (!open) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="w-full rounded-md border border-brand-hairline bg-white px-3 py-2 text-xs font-medium text-brand-navy transition hover:border-rose-200 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Mark declined…
      </button>
    );
  }
  return (
    <div className="space-y-2 rounded-md border border-brand-hairline bg-white p-2">
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        placeholder="Why? (internal — helps sharpen pricing)"
        className="block w-full rounded-md border border-brand-hairline px-2 py-1 text-xs focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex-1 rounded-md border border-brand-hairline bg-white px-2 py-1 text-[11px] font-medium text-brand-navy hover:bg-brand-blue-tint"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={loading || reason.trim() === ""}
          onClick={() => onDecline(reason.trim())}
          className="flex-1 rounded-md bg-rose-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
        >
          {loading ? "Declining…" : "Confirm decline"}
        </button>
      </div>
    </div>
  );
}
