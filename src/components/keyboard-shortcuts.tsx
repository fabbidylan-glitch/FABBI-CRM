"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Shortcut = { keys: string; label: string; category: string };

const SHORTCUTS: Shortcut[] = [
  { keys: "g d", label: "Go to Dashboard", category: "Navigation" },
  { keys: "g l", label: "Go to Leads", category: "Navigation" },
  { keys: "g c", label: "Go to Contacts", category: "Navigation" },
  { keys: "g p", label: "Go to Pipeline", category: "Navigation" },
  { keys: "g i", label: "Open Intake form", category: "Navigation" },
  { keys: "/", label: "Focus search (when present)", category: "Actions" },
  { keys: "n", label: "New lead (intake form)", category: "Actions" },
  { keys: "?", label: "Show this help", category: "Help" },
  { keys: "Esc", label: "Close this help / blur input", category: "Help" },
];

/**
 * Global keyboard shortcut handler.
 *
 * We track `g` as a leader key (Gmail / Linear style) so users can chain
 * things like `g l` for "go to Leads". Text inputs, textareas, contenteditable,
 * and selects are ignored so keystrokes don't get hijacked while typing.
 */
export function KeyboardShortcuts() {
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);
  const [leader, setLeader] = useState<"g" | null>(null);

  const inEditable = useCallback((t: EventTarget | null): boolean => {
    const el = t as HTMLElement | null;
    if (!el) return false;
    const tag = el.tagName?.toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return true;
    if (el.isContentEditable) return true;
    return false;
  }, []);

  useEffect(() => {
    function onKey(ev: KeyboardEvent) {
      // Escape always works — closes help, blurs inputs.
      if (ev.key === "Escape") {
        if (helpOpen) {
          ev.preventDefault();
          setHelpOpen(false);
          return;
        }
        const t = ev.target as HTMLElement | null;
        if (t && inEditable(t)) t.blur();
        setLeader(null);
        return;
      }

      // Cmd/Ctrl-modified combos are left to the browser and app.
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;

      // If the user is typing somewhere, don't steal keys (except Esc above).
      if (inEditable(ev.target)) return;

      // Help
      if (ev.key === "?") {
        ev.preventDefault();
        setHelpOpen(true);
        return;
      }

      // Leader handling (g + <letter>)
      if (leader === "g") {
        const map: Record<string, string> = {
          d: "/",
          l: "/leads",
          c: "/contacts",
          p: "/pipeline",
          i: "/intake",
        };
        const dest = map[ev.key.toLowerCase()];
        if (dest) {
          ev.preventDefault();
          router.push(dest);
        }
        setLeader(null);
        return;
      }
      if (ev.key === "g") {
        ev.preventDefault();
        setLeader("g");
        // Auto-clear the leader if the user doesn't press a second key soon.
        setTimeout(() => setLeader((l) => (l === "g" ? null : l)), 1500);
        return;
      }

      // Single-press shortcuts
      if (ev.key === "/") {
        const search = document.querySelector<HTMLInputElement>('input[type="search"]');
        if (search) {
          ev.preventDefault();
          search.focus();
          search.select();
        }
        return;
      }
      if (ev.key === "n") {
        ev.preventDefault();
        router.push("/intake");
        return;
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, helpOpen, leader, inEditable]);

  return (
    <>
      {/* Leader-key hint so you know you're mid-chord */}
      {leader === "g" ? (
        <div className="fixed bottom-6 right-6 z-50 rounded-md bg-brand-navy px-3 py-1.5 text-xs font-medium text-white shadow-card-hover">
          <span className="rounded bg-white/10 px-1 py-0.5 font-mono">g</span> …then d / l / c / p / i
        </div>
      ) : null}

      {helpOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
          onClick={() => setHelpOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-xl border border-brand-hairline bg-white shadow-card-hover"
          >
            <div className="flex items-center justify-between border-b border-brand-hairline px-5 py-3">
              <h2 className="text-sm font-semibold text-brand-navy">Keyboard shortcuts</h2>
              <button
                onClick={() => setHelpOpen(false)}
                className="rounded-md px-2 py-1 text-xs text-brand-muted hover:bg-brand-blue-tint"
              >
                Esc
              </button>
            </div>
            <div className="px-5 py-4">
              {["Navigation", "Actions", "Help"].map((cat) => (
                <div key={cat} className="mb-3 last:mb-0">
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-brand-muted">
                    {cat}
                  </div>
                  <ul className="space-y-1.5">
                    {SHORTCUTS.filter((s) => s.category === cat).map((s) => (
                      <li key={s.keys} className="flex items-center justify-between text-sm">
                        <span className="text-brand-navy">{s.label}</span>
                        <span className="flex gap-1">
                          {s.keys.split(" ").map((k, i) => (
                            <kbd
                              key={i}
                              className="rounded border border-brand-hairline bg-brand-blue-tint px-1.5 py-0.5 font-mono text-[11px] text-brand-blue"
                            >
                              {k}
                            </kbd>
                          ))}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
