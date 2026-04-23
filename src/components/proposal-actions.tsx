"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SendToClientModal } from "@/components/send-to-client-modal";

type QuickPasteField = { label: string; value: string; preview?: string };

type Props = {
  proposalId: string;
  leadId: string;
  status: string;
  canEdit: boolean;
  sentAt: string | null;
  acceptedAt: string | null;
  declinedAt: string | null;
  declineReason: string | null;
  signingUrl: string | null;
  clientName: string;
  clientEmail: string | null;
  /** Pre-formatted scope text copied to clipboard when "Open Anchor" is clicked. */
  scopeText: string;
  anchorUrl: string;
  /** Fields the rep may want to copy one-at-a-time into Anchor's form. */
  quickPasteFields: QuickPasteField[];
  /** Structured lost-reason codes — rep picks one before declining. */
  lostReasons: Array<{ code: string; label: string }>;
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
  signingUrl,
  clientName,
  clientEmail,
  scopeText,
  anchorUrl,
  quickPasteFields,
  lostReasons,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  async function action(kind: "accept" | "decline", body?: Record<string, unknown>) {
    setLoading(kind);
    setErr(null);
    try {
      const res = await fetch(`/api/proposals/${proposalId}/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : JSON.stringify({}),
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
        <>
          <button
            type="button"
            disabled={!canEdit}
            onClick={() => setModalOpen(true)}
            className="w-full rounded-md bg-gradient-to-br from-brand-blue to-brand-blue-dark px-3 py-2.5 text-sm font-semibold text-white shadow-btn-primary transition hover:from-brand-blue-dark hover:to-brand-navy disabled:cursor-not-allowed disabled:opacity-60"
          >
            Send to client →
          </button>
          <p className="text-[11px] text-brand-muted">
            Opens Anchor for signing, then emails the client a FABBI-branded proposal with
            the signing link.
          </p>
        </>
      ) : null}

      {(status === "SENT" || status === "VIEWED") ? (
        <>
          {signingUrl ? (
            <SigningUrlChip url={signingUrl} />
          ) : null}
          <button
            type="button"
            disabled={!canEdit || loading !== null}
            onClick={() => action("accept")}
            className="w-full rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-btn-primary transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading === "accept" ? "Accepting…" : "Mark accepted"}
          </button>
          <DeclineBlock
            disabled={!canEdit || loading !== null}
            onDecline={(lostReasonCode, r) =>
              action("decline", { lostReasonCode, reason: r })
            }
            loading={loading === "decline"}
            lostReasons={lostReasons}
          />
        </>
      ) : null}

      {isTerminal ? (
        <>
          {signingUrl ? <SigningUrlChip url={signingUrl} /> : null}
          <div className="rounded-md bg-slate-50 px-3 py-2 text-xs text-brand-muted">
            {status === "ACCEPTED" ? (
              <>
                Accepted {acceptedAt ? new Date(acceptedAt).toLocaleDateString() : ""}.
                Onboarding record created — continue in the lead record.
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
        </>
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

      {status === "DRAFT" ? (
        <div className="border-t border-brand-hairline pt-3">
          <a
            href={`/leads/${leadId}/scope`}
            className="block text-center text-[11px] text-brand-blue hover:underline"
          >
            Re-scope (creates new quote)
          </a>
        </div>
      ) : null}

      <SendToClientModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        proposalId={proposalId}
        clientName={clientName}
        scopeText={scopeText}
        anchorUrl={anchorUrl}
        initialSigningUrl={signingUrl ?? ""}
        quickPasteFields={quickPasteFields}
        clientEmail={clientEmail}
      />
    </div>
  );
}

function SigningUrlChip({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-md border border-brand-blue-soft/60 bg-brand-blue-tint/40 px-2.5 py-1.5">
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-muted">
          Signing link
        </div>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="mt-0.5 block truncate text-[11px] text-brand-blue hover:underline"
        >
          {url}
        </a>
      </div>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            // no-op
          }
        }}
        className="shrink-0 rounded border border-brand-hairline bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-brand-navy hover:bg-brand-blue-tint"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function DeclineBlock({
  disabled,
  loading,
  onDecline,
  lostReasons,
}: {
  disabled: boolean;
  loading: boolean;
  onDecline: (lostReasonCode: string, reason: string) => void;
  lostReasons: Array<{ code: string; label: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [lostReasonCode, setLostReasonCode] = useState("");
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
      <select
        value={lostReasonCode}
        onChange={(e) => setLostReasonCode(e.target.value)}
        className="block w-full rounded-md border border-brand-hairline px-2 py-1 text-xs focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
      >
        <option value="">Pick a lost reason…</option>
        {lostReasons.map((r) => (
          <option key={r.code} value={r.code}>
            {r.label}
          </option>
        ))}
      </select>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        placeholder="Optional: context that sharpens future pricing"
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
          disabled={loading || lostReasonCode === ""}
          onClick={() => onDecline(lostReasonCode, reason.trim())}
          className="flex-1 rounded-md bg-rose-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
        >
          {loading ? "Declining…" : "Confirm decline"}
        </button>
      </div>
    </div>
  );
}
