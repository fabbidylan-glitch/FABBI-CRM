"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type QuickPasteField = { label: string; value: string; preview?: string };

type Props = {
  open: boolean;
  onClose: () => void;
  proposalId: string;
  clientName: string;
  /** Text copied to clipboard when the user clicks "Open Anchor". */
  scopeText: string;
  /** URL to open when the user clicks "Open Anchor". */
  anchorUrl: string;
  /** Initial value for the signing URL input — usually empty for a fresh proposal. */
  initialSigningUrl: string;
  /** Fields a rep may need to paste into Anchor one at a time. Hidden by default. */
  quickPasteFields: QuickPasteField[];
  /** Client's email — shown in the "what happens next" block so the rep knows
   *  exactly where the branded email is going. */
  clientEmail: string | null;
};

/**
 * The single place a rep sends a proposal. Collapses what used to be four
 * separate cards (Create-in-Anchor, Quick paste, Paste URL, Mark as sent)
 * into one vertical flow:
 *   1. Click "Open Anchor" to create the proposal there
 *   2. Paste the Anchor signing URL into the input
 *   3. Click "Send to client" — CRM saves URL, marks SENT, fires branded email
 */
type EmailPreview = {
  to: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
};

export function SendToClientModal({
  open,
  onClose,
  proposalId,
  clientName,
  scopeText,
  anchorUrl,
  initialSigningUrl,
  quickPasteFields,
  clientEmail,
}: Props) {
  const router = useRouter();
  const [url, setUrl] = useState(initialSigningUrl);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copiedScope, setCopiedScope] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showQuickPaste, setShowQuickPaste] = useState(false);
  // Two-step flow: the rep first sees the "compose" view (steps 1-3), clicks
  // Preview email → we fetch the rendered email → show preview view with Send
  // now + Back buttons. preview === null means compose view; non-null means
  // preview view.
  const [preview, setPreview] = useState<EmailPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    if (open) {
      setUrl(initialSigningUrl);
      setErr(null);
      setCopiedScope(false);
      setShowQuickPaste(false);
      setPreview(null);
    }
  }, [open, initialSigningUrl]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && open && !sending) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, sending, onClose]);

  if (!open) return null;

  async function openAnchor() {
    try {
      await navigator.clipboard.writeText(scopeText);
      setCopiedScope(true);
      setTimeout(() => setCopiedScope(false), 2500);
    } catch {
      // Clipboard can fail in strict contexts — still open Anchor.
    }
    window.open(anchorUrl, "_blank", "noopener,noreferrer");
  }

  async function copyField(label: string, value: string) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(label);
      setTimeout(
        () => setCopiedField((c) => (c === label ? null : c)),
        2000
      );
    } catch {
      // no-op
    }
  }

  async function loadPreview() {
    setLoadingPreview(true);
    setErr(null);
    try {
      const res = await fetch(`/api/proposals/${proposalId}/preview-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signingUrl: url.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data?.error ?? "Failed to load email preview");
        return;
      }
      setPreview(data.email as EmailPreview);
    } catch {
      setErr("Network error loading preview");
    } finally {
      setLoadingPreview(false);
    }
  }

  async function onSend() {
    setSending(true);
    setErr(null);
    try {
      const trimmed = url.trim();
      // Save URL if it changed (empty string clears). PATCH first so the send
      // endpoint picks up the new URL when it fires the branded email.
      if (trimmed !== initialSigningUrl) {
        const patch = await fetch(`/api/proposals/${proposalId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ signingUrl: trimmed }),
        });
        if (!patch.ok) {
          const data = await patch.json().catch(() => ({}));
          throw new Error(data?.error ?? "Failed to save signing URL");
        }
      }
      // Always skip the Make webhook push — in this flow the rep is creating
      // the Anchor proposal by hand. Pushing would create a duplicate.
      const res = await fetch(`/api/proposals/${proposalId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skipAnchor: true }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Failed to send proposal");
      }
      onClose();
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error");
    } finally {
      setSending(false);
    }
  }

  const hasUrl = url.trim().length > 0;
  const isPreviewMode = preview !== null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
      onClick={() => (sending ? undefined : onClose())}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${isPreviewMode ? "max-w-2xl" : "max-w-xl"} overflow-hidden rounded-2xl border border-brand-hairline bg-white shadow-card-hover`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-brand-hairline px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-brand-navy">
              {isPreviewMode
                ? `Review email before sending`
                : `Send proposal to ${clientName || "client"}`}
            </h2>
            <p className="mt-0.5 text-[11px] text-brand-muted">
              {isPreviewMode
                ? `This is exactly what ${clientEmail ?? "the client"} will receive.`
                : `Create the proposal in Anchor, paste the signing URL below, and preview.`}
            </p>
          </div>
          <button
            type="button"
            disabled={sending}
            onClick={onClose}
            className="rounded-md px-2 py-1 text-xs text-brand-muted hover:bg-brand-blue-tint hover:text-brand-navy disabled:opacity-60"
          >
            Esc
          </button>
        </div>

        {isPreviewMode ? (
          <div className="px-5 py-5">
            <dl className="mb-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
              <dt className="font-semibold text-brand-muted">To</dt>
              <dd className="text-brand-navy">{preview.to}</dd>
              <dt className="font-semibold text-brand-muted">Subject</dt>
              <dd className="text-brand-navy">{preview.subject}</dd>
            </dl>
            <div className="overflow-hidden rounded-lg border border-brand-hairline">
              <iframe
                title="Proposal email preview"
                srcDoc={preview.bodyHtml}
                className="h-[520px] w-full bg-white"
                sandbox=""
              />
            </div>
            {err ? (
              <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                {err}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-5 px-5 py-5">
          {/* Step 1 */}
          <div>
            <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-brand-muted">
              <StepNumber n={1} />
              Create in Anchor
            </div>
            <button
              type="button"
              onClick={openAnchor}
              className="w-full rounded-md bg-gradient-to-br from-brand-blue to-brand-blue-dark px-3 py-2.5 text-sm font-semibold text-white shadow-btn-primary transition hover:from-brand-blue-dark hover:to-brand-navy"
            >
              Open Anchor →
            </button>
            <p className="mt-1.5 text-[11px] text-brand-muted">
              {copiedScope ? (
                <span className="text-emerald-700">
                  ✓ Scope copied — paste it into Anchor&rsquo;s proposal description field.
                </span>
              ) : (
                <>Copies the full scope to your clipboard and opens Anchor in a new tab.</>
              )}
            </p>
            <button
              type="button"
              onClick={() => setShowQuickPaste((v) => !v)}
              className="mt-2 text-[11px] font-medium text-brand-blue hover:underline"
            >
              {showQuickPaste ? "Hide" : "Need"} individual fields (name, email, amount…) →
            </button>
            {showQuickPaste ? (
              <ul className="mt-2 grid grid-cols-2 gap-1.5">
                {quickPasteFields.map((f) => {
                  const isCopied = copiedField === f.label;
                  const display = f.preview ?? (f.value || "—");
                  const truncated =
                    display.length > 30 ? display.slice(0, 27) + "…" : display;
                  return (
                    <li key={f.label}>
                      <button
                        type="button"
                        disabled={!f.value}
                        onClick={() => copyField(f.label, f.value)}
                        className={`flex w-full items-center gap-2 rounded border px-2 py-1.5 text-left text-[11px] transition ${
                          isCopied
                            ? "border-emerald-300 bg-emerald-50"
                            : f.value
                              ? "border-brand-hairline bg-white hover:border-brand-blue-soft hover:bg-brand-blue-tint/50"
                              : "border-brand-hairline/60 bg-slate-50/60 opacity-60"
                        }`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-[9px] font-semibold uppercase tracking-wider text-brand-muted">
                            {f.label}
                          </span>
                          <span
                            className={`block truncate font-medium ${
                              f.value ? "text-brand-navy" : "text-brand-muted"
                            }`}
                          >
                            {truncated}
                          </span>
                        </span>
                        <span
                          className={`shrink-0 text-[9px] font-semibold uppercase tracking-wider ${
                            isCopied ? "text-emerald-700" : "text-brand-muted"
                          }`}
                        >
                          {isCopied ? "✓" : f.value ? "Copy" : ""}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>

          {/* Step 2 */}
          <div>
            <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-brand-muted">
              <StepNumber n={2} />
              Paste the Anchor signing URL
            </div>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://app.sayanchor.com/engagements/..."
              className="block w-full rounded-md border border-brand-hairline bg-white px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
            />
            <p className="mt-1 text-[11px] text-brand-muted">
              After Anchor creates the proposal, it gives you a client-signing link —
              paste that here.
            </p>
          </div>

          {/* Step 3 — what happens next */}
          <div className="rounded-md border border-brand-hairline bg-slate-50/60 px-3 py-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-muted">
              When you click Send to client
            </div>
            <ul className="mt-1 space-y-0.5 text-[11px] text-brand-navy">
              <li>
                {hasUrl ? "✓" : "•"} Branded FABBI email goes to{" "}
                <span className="font-semibold">
                  {clientEmail ?? "(no email on file)"}
                </span>{" "}
                {hasUrl ? "with the signing link" : "(no link — paste URL above to include)"}
              </li>
              <li>✓ Proposal marked SENT</li>
              <li>✓ Follow-up tasks auto-created</li>
            </ul>
          </div>

          {err ? (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              {err}
            </div>
          ) : null}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-brand-hairline px-5 py-3">
          {isPreviewMode ? (
            <>
              <button
                type="button"
                disabled={sending}
                onClick={() => setPreview(null)}
                className="rounded-md border border-brand-hairline bg-white px-3 py-1.5 text-xs font-medium text-brand-navy hover:bg-brand-blue-tint disabled:opacity-60"
              >
                ← Back to edit
              </button>
              <button
                type="button"
                disabled={sending}
                onClick={onSend}
                className="rounded-md bg-brand-blue px-4 py-1.5 text-xs font-semibold text-white shadow-btn-primary transition hover:bg-brand-blue-dark disabled:opacity-60"
              >
                {sending ? "Sending…" : "Send now"}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={sending || loadingPreview}
                onClick={onClose}
                className="rounded-md border border-brand-hairline bg-white px-3 py-1.5 text-xs font-medium text-brand-navy hover:bg-brand-blue-tint disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={sending || loadingPreview || !hasUrl}
                onClick={loadPreview}
                title={
                  !hasUrl
                    ? "Paste the Anchor signing URL to preview"
                    : undefined
                }
                className="rounded-md bg-brand-blue px-4 py-1.5 text-xs font-semibold text-white shadow-btn-primary transition hover:bg-brand-blue-dark disabled:opacity-60"
              >
                {loadingPreview ? "Loading…" : "Preview email →"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StepNumber({ n }: { n: number }) {
  return (
    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand-navy text-[9px] font-bold text-white">
      {n}
    </span>
  );
}
