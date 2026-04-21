"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type SearchResult = {
  id: string;
  name: string;
  email: string;
  company: string;
  stage: string;
  grade: "A" | "B" | "C" | "D";
};

type ActionItem = {
  kind: "action";
  id: string;
  label: string;
  hint?: string;
  run: () => void;
};
type LeadItem = {
  kind: "lead";
  id: string;
  name: string;
  subtitle: string;
  grade: string;
};
type Item = ActionItem | LeadItem;

/**
 * Cmd/Ctrl+K command palette. Two modes:
 *   - Empty query → show quick navigation actions (Go to Leads, Pipeline, etc)
 *   - Typed query → fuzzy-match against leads via /api/search
 * Arrow keys navigate, Enter activates, Esc closes.
 */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  // Global hotkey: ⌘K / Ctrl+K to toggle.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Focus the input on open.
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // Debounced search.
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length === 0) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: ctrl.signal,
        });
        if (res.ok) {
          const data = (await res.json()) as { results: SearchResult[] };
          setResults(data.results ?? []);
          setSelectedIdx(0);
        }
      } catch {
        /* aborted — ignore */
      } finally {
        setLoading(false);
      }
    }, 150);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [query, open]);

  const actions: ActionItem[] = useMemo(
    () => [
      {
        kind: "action",
        id: "go-dashboard",
        label: "Go to Dashboard",
        hint: "g d",
        run: () => router.push("/"),
      },
      {
        kind: "action",
        id: "go-leads",
        label: "Go to Leads",
        hint: "g l",
        run: () => router.push("/leads"),
      },
      {
        kind: "action",
        id: "go-contacts",
        label: "Go to Contacts",
        hint: "g c",
        run: () => router.push("/contacts"),
      },
      {
        kind: "action",
        id: "go-pipeline",
        label: "Go to Pipeline",
        hint: "g p",
        run: () => router.push("/pipeline"),
      },
      {
        kind: "action",
        id: "new-lead",
        label: "Add a new lead",
        hint: "n",
        run: () => router.push("/intake"),
      },
      {
        kind: "action",
        id: "import",
        label: "Import contacts (CSV)",
        run: () => router.push("/contacts/import"),
      },
    ],
    [router]
  );

  const items: Item[] =
    query.trim().length === 0
      ? actions
      : results.map<LeadItem>((r) => ({
          kind: "lead",
          id: r.id,
          name: r.name,
          subtitle:
            [r.email, r.company, r.stage.replace(/_/g, " ").toLowerCase()]
              .filter(Boolean)
              .join(" · ") || "—",
          grade: r.grade,
        }));

  const activate = useCallback(
    (item: Item) => {
      if (item.kind === "action") item.run();
      else router.push(`/leads/${item.id}`);
      setOpen(false);
    },
    [router]
  );

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = items[selectedIdx];
      if (pick) activate(pick);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/30 p-4 pt-24 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-brand-hairline bg-white shadow-card-hover"
      >
        <div className="flex items-center gap-2 border-b border-brand-hairline px-4 py-3">
          <span aria-hidden className="text-brand-muted">⌘</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Type a name, email, or command…"
            className="flex-1 bg-transparent text-sm text-brand-navy placeholder:text-brand-muted focus:outline-none"
          />
          {loading ? (
            <span className="text-[10px] text-brand-muted">searching…</span>
          ) : (
            <span className="text-[10px] text-brand-muted">Esc to close</span>
          )}
        </div>
        <ul ref={listRef} className="max-h-96 overflow-y-auto py-1">
          {items.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-brand-muted">
              {query.trim().length === 0 ? "Type to search leads" : "No matches"}
            </li>
          ) : (
            items.map((item, idx) => (
              <li
                key={`${item.kind}:${item.id}`}
                onMouseEnter={() => setSelectedIdx(idx)}
                onClick={() => activate(item)}
                className={`flex cursor-pointer items-center justify-between gap-3 px-4 py-2 ${
                  idx === selectedIdx ? "bg-brand-blue-tint" : ""
                }`}
              >
                {item.kind === "action" ? (
                  <>
                    <div className="text-sm font-medium text-brand-navy">{item.label}</div>
                    {item.hint ? (
                      <kbd className="rounded border border-brand-hairline bg-white px-1.5 py-0.5 font-mono text-[10px] text-brand-muted">
                        {item.hint}
                      </kbd>
                    ) : null}
                  </>
                ) : (
                  <>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-brand-navy">
                        {item.name}
                      </div>
                      <div className="truncate text-[11px] text-brand-muted">
                        {item.subtitle}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                        item.grade === "A"
                          ? "bg-brand-blue text-white"
                          : item.grade === "B"
                            ? "bg-brand-blue-tint text-brand-blue"
                            : item.grade === "C"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {item.grade}
                    </span>
                  </>
                )}
              </li>
            ))
          )}
        </ul>
        <div className="border-t border-brand-hairline bg-brand-blue-tint/30 px-4 py-1.5 text-[10px] text-brand-muted">
          ↑ ↓ navigate · Enter open · ⌘/Ctrl + K to toggle
        </div>
      </div>
    </div>
  );
}
