"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Stage } from "@/lib/preview/fixtures";

const STAGES: Array<{ v: Stage; label: string }> = [
  { v: "NEW_LEAD", label: "New Lead" },
  { v: "CONTACTED", label: "Contacted" },
  { v: "QUALIFIED", label: "Qualified" },
  { v: "CONSULT_BOOKED", label: "Consult Booked" },
  { v: "CONSULT_COMPLETED", label: "Consult Completed" },
  { v: "PROPOSAL_DRAFTING", label: "Proposal Drafting" },
  { v: "PROPOSAL_SENT", label: "Proposal Sent" },
  { v: "FOLLOW_UP_NEGOTIATION", label: "Follow-up" },
  { v: "WON", label: "Won" },
  { v: "LOST", label: "Lost" },
  { v: "COLD_NURTURE", label: "Cold Nurture" },
];

type Props = {
  selectedIds: string[];
  onClear: () => void;
  users: Array<{ id: string; name: string }>;
  canEdit: boolean;
  /** Rows currently visible, for "Export selected" */
  allVisibleRows?: Array<Record<string, unknown>>;
};

export function BulkActionBar({ selectedIds, onClear, users, canEdit, allVisibleRows }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  if (selectedIds.length === 0) return null;

  async function run(body: unknown) {
    setBusy(true);
    try {
      const res = await fetch("/api/leads/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setToast({ kind: "err", text: data.error ?? "Bulk action failed" });
        return;
      }
      setToast({ kind: "ok", text: `Updated ${data.updated} lead${data.updated === 1 ? "" : "s"}` });
      onClear();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function exportCsv() {
    if (!allVisibleRows) return;
    const selected = allVisibleRows.filter(
      (r) => typeof r.id === "string" && selectedIds.includes(r.id)
    );
    if (selected.length === 0) return;
    const keys = Object.keys(selected[0] ?? {});
    const header = keys.join(",");
    const rows = selected.map((r) =>
      keys.map((k) => csvCell((r as Record<string, unknown>)[k])).join(",")
    );
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="sticky bottom-4 z-40 mx-auto flex w-fit max-w-full flex-wrap items-center gap-2 rounded-xl border border-brand-hairline bg-brand-navy px-3 py-2 text-white shadow-card-hover">
      <span className="px-2 text-xs font-medium">
        {selectedIds.length} selected
      </span>

      {canEdit ? (
        <>
          <select
            disabled={busy}
            defaultValue=""
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              const ownerUserId = v === "_unassigned_" ? null : v;
              void run({ action: "assignOwner", leadIds: selectedIds, ownerUserId });
              e.target.value = "";
            }}
            className="rounded-md bg-white/10 px-2 py-1 text-xs font-medium text-white focus:outline-none focus:ring-2 focus:ring-brand-blue/40"
          >
            <option value="" disabled>
              Assign owner…
            </option>
            <option value="_unassigned_">Unassigned</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>

          <select
            disabled={busy}
            defaultValue=""
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              void run({ action: "changeStage", leadIds: selectedIds, stage: v });
              e.target.value = "";
            }}
            className="rounded-md bg-white/10 px-2 py-1 text-xs font-medium text-white focus:outline-none focus:ring-2 focus:ring-brand-blue/40"
          >
            <option value="" disabled>
              Move to stage…
            </option>
            {STAGES.map((s) => (
              <option key={s.v} value={s.v}>
                {s.label}
              </option>
            ))}
          </select>

          <button
            disabled={busy}
            onClick={() => {
              if (confirm(`Archive ${selectedIds.length} lead(s)?`))
                void run({ action: "archive", leadIds: selectedIds });
            }}
            className="rounded-md bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
          >
            Archive
          </button>
        </>
      ) : null}

      {allVisibleRows ? (
        <button
          onClick={exportCsv}
          className="rounded-md bg-white/10 px-2.5 py-1 text-xs font-medium text-white hover:bg-white/20"
        >
          Export CSV
        </button>
      ) : null}

      <button
        onClick={onClear}
        className="rounded-md bg-white/10 px-2.5 py-1 text-xs font-medium text-white hover:bg-white/20"
      >
        Clear
      </button>

      {toast ? (
        <span
          className={`rounded-md px-2 py-1 text-[11px] ${
            toast.kind === "ok" ? "bg-emerald-500" : "bg-rose-500"
          } text-white`}
        >
          {toast.text}
        </span>
      ) : null}
    </div>
  );
}

function csvCell(v: unknown): string {
  if (v == null) return "";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
