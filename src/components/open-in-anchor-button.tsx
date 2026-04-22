"use client";

import { useState } from "react";

type Props = {
  scopeText: string;
  anchorUrl: string;
  disabled?: boolean;
};

/**
 * One-click "create this proposal in Anchor" flow:
 *   1. Copies a pre-formatted scope block to the clipboard so the rep can
 *      paste it into Anchor's proposal description / notes field in one go
 *   2. Opens Anchor's new-proposal page in a new tab
 *
 * This is the Option-2 integration path: the CRM owns the scope + pricing
 * calc; Anchor owns the actual proposal document + signing + billing. No
 * API bridge required, no duplicate data entry.
 */
export function OpenInAnchorButton({ scopeText, anchorUrl, disabled }: Props) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  async function onClick() {
    if (disabled) return;
    try {
      await navigator.clipboard.writeText(scopeText);
      setStatus("copied");
      // Open Anchor in a new tab so the rep can paste immediately.
      window.open(anchorUrl, "_blank", "noopener,noreferrer");
    } catch {
      // clipboard.writeText can fail in strict contexts; we still open the tab
      // and show a fallback state.
      window.open(anchorUrl, "_blank", "noopener,noreferrer");
      setStatus("failed");
    }
    // Reset the indicator after a few seconds so it's clear the action is
    // ready to be triggered again.
    setTimeout(() => setStatus("idle"), 4000);
  }

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="w-full rounded-md bg-gradient-to-br from-brand-blue to-brand-blue-dark px-3 py-2.5 text-sm font-semibold text-white shadow-btn-primary transition hover:from-brand-blue-dark hover:to-brand-navy disabled:cursor-not-allowed disabled:opacity-60"
      >
        Create in Anchor →
      </button>
      <p className="text-[11px] text-brand-muted">
        {status === "copied" ? (
          <span className="text-emerald-700">
            ✓ Scope copied — paste it into Anchor&rsquo;s proposal description field.
          </span>
        ) : status === "failed" ? (
          <span className="text-amber-700">
            Anchor opened in a new tab, but clipboard copy failed. Copy the scope card above
            manually.
          </span>
        ) : (
          <>
            Copies the scope to your clipboard and opens Anchor&rsquo;s new-proposal page in a
            new tab.
          </>
        )}
      </p>
    </div>
  );
}
