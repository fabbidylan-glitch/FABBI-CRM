"use client";

import { useState } from "react";

type Field = {
  /** Label shown in the chip. Keep it short — this matches Anchor's field names. */
  label: string;
  /** Value to copy when clicked. Empty strings render a disabled chip. */
  value: string;
  /** Optional short preview; defaults to the value truncated. */
  preview?: string;
};

type Props = {
  fields: Field[];
};

/**
 * Grid of copyable "chips" matching Anchor's new-proposal form fields. Rep
 * clicks a chip → value lands on the clipboard → rep clicks into Anchor's
 * field → paste. Compresses the ~30 seconds of retype per proposal down to
 * ~10 seconds of click-click-paste.
 */
export function QuickPasteFields({ fields }: Props) {
  const [copied, setCopied] = useState<string | null>(null);
  const [copiedAt, setCopiedAt] = useState<number>(0);

  async function copy(label: string, value: string) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setCopiedAt(Date.now());
      setTimeout(() => {
        setCopied((c) => (c === label && Date.now() - copiedAt >= 1800 ? null : c));
      }, 2000);
    } catch {
      // Clipboard can fail in some contexts; fall back to no indicator.
    }
  }

  return (
    <div className="space-y-2">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-muted">
        Quick paste
      </div>
      <p className="text-[11px] text-brand-muted">
        Click any field to copy it, then paste into Anchor&rsquo;s form.
      </p>
      <ul className="grid grid-cols-1 gap-1.5">
        {fields.map((f) => {
          const isCopied = copied === f.label;
          const display = f.preview ?? (f.value || "—");
          const truncated = display.length > 42 ? display.slice(0, 39) + "…" : display;
          return (
            <li key={f.label}>
              <button
                type="button"
                disabled={!f.value}
                onClick={() => copy(f.label, f.value)}
                className={`flex w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs transition ${
                  isCopied
                    ? "border-emerald-300 bg-emerald-50"
                    : f.value
                      ? "border-brand-hairline bg-white hover:border-brand-blue-soft hover:bg-brand-blue-tint/50"
                      : "border-brand-hairline/60 bg-slate-50/60 opacity-60"
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-brand-muted">
                    {f.label}
                  </span>
                  <span
                    className={`mt-0.5 block truncate font-medium ${
                      f.value ? "text-brand-navy" : "text-brand-muted"
                    }`}
                  >
                    {truncated}
                  </span>
                </span>
                <span
                  className={`shrink-0 text-[10px] font-semibold uppercase tracking-wider ${
                    isCopied ? "text-emerald-700" : "text-brand-muted"
                  }`}
                >
                  {isCopied ? "Copied ✓" : f.value ? "Copy" : ""}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
