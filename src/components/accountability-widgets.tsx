"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Card, CardBody, CardHeader, Pill } from "@/components/ui";
import type {
  OverdueTask,
  StuckLead,
} from "@/lib/features/dashboard/accountability";
import {
  STAGE_LABEL,
  formatCurrency,
  formatRelative,
  type Stage,
} from "@/lib/preview/fixtures";

type Severity = "recent" | "aging" | "critical";

function severityOf(hoursOverdue: number): Severity {
  if (hoursOverdue >= 72) return "critical";
  if (hoursOverdue >= 6) return "aging";
  return "recent";
}

const SEVERITY_COLOR: Record<Severity, "amber" | "rose" | "slate"> = {
  recent: "amber",
  aging: "amber",
  critical: "rose",
};

export function OverdueTasksCard({
  tasks,
  unassignedCount,
  users,
}: {
  tasks: OverdueTask[];
  unassignedCount: number;
  users: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<Severity | "all">("all");

  const bucketed = useMemo(() => {
    const out: Record<Severity, OverdueTask[]> = { recent: [], aging: [], critical: [] };
    for (const t of tasks) out[severityOf(t.hoursOverdue)].push(t);
    return out;
  }, [tasks]);

  const filtered =
    severityFilter === "all"
      ? tasks
      : tasks.filter((t) => severityOf(t.hoursOverdue) === severityFilter);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    if (filtered.length > 0 && filtered.every((t) => selected.has(t.id))) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((t) => t.id)));
    }
  }

  async function run(body: unknown, label: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/tasks/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setFlash(`Error: ${d.error ?? "failed"}`);
        return;
      }
      setFlash(label);
      setSelected(new Set());
      router.refresh();
    } finally {
      setBusy(false);
      setTimeout(() => setFlash(null), 3000);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Overdue + unassigned"
        action={
          <div className="flex items-center gap-1.5 text-[11px]">
            <button
              onClick={() => setSeverityFilter("all")}
              className={`rounded-full px-2 py-0.5 ${
                severityFilter === "all"
                  ? "bg-brand-navy text-white"
                  : "text-brand-muted hover:text-brand-navy"
              }`}
            >
              All {tasks.length}
            </button>
            {bucketed.critical.length > 0 ? (
              <button
                onClick={() => setSeverityFilter("critical")}
                className={`rounded-full px-2 py-0.5 ${
                  severityFilter === "critical"
                    ? "bg-rose-600 text-white"
                    : "bg-rose-100 text-rose-800"
                }`}
              >
                {bucketed.critical.length} critical
              </button>
            ) : null}
            {bucketed.aging.length > 0 ? (
              <button
                onClick={() => setSeverityFilter("aging")}
                className={`rounded-full px-2 py-0.5 ${
                  severityFilter === "aging"
                    ? "bg-amber-600 text-white"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {bucketed.aging.length} aging
              </button>
            ) : null}
            <Pill tone={unassignedCount > 0 ? "amber" : "slate"}>
              {unassignedCount} unassigned leads
            </Pill>
          </div>
        }
      />
      <CardBody className="px-0 py-0">
        {filtered.length === 0 ? (
          <div className="px-5 py-6 text-sm text-brand-muted">
            {tasks.length === 0
              ? unassignedCount === 0
                ? "No overdue tasks and no unassigned leads. Excellent."
                : "No overdue tasks — but assign owners to unassigned leads on the Leads page."
              : "No tasks match this severity filter."}
          </div>
        ) : (
          <>
            {selected.size > 0 ? (
              <div className="flex flex-wrap items-center gap-2 border-b border-brand-hairline bg-brand-blue-tint/40 px-5 py-2">
                <span className="text-xs font-medium text-brand-navy">
                  {selected.size} selected
                </span>
                <button
                  onClick={() =>
                    run(
                      { action: "complete", taskIds: Array.from(selected) },
                      `Completed ${selected.size}`
                    )
                  }
                  disabled={busy}
                  className="rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  Mark complete
                </button>
                <button
                  onClick={() =>
                    run(
                      { action: "snooze", taskIds: Array.from(selected), hours: 24 },
                      `Snoozed 1 business day`
                    )
                  }
                  disabled={busy}
                  className="rounded-md border border-brand-hairline bg-white px-2.5 py-1 text-[11px] font-medium text-brand-navy hover:bg-white/80"
                >
                  Snooze 24h
                </button>
                <select
                  disabled={busy}
                  defaultValue=""
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!v) return;
                    const ownerUserId = v === "_unassigned_" ? null : v;
                    void run(
                      {
                        action: "reassign",
                        taskIds: Array.from(selected),
                        assignedUserId: ownerUserId,
                      },
                      "Reassigned"
                    );
                    e.target.value = "";
                  }}
                  className="rounded-md border border-brand-hairline bg-white px-2 py-1 text-[11px] font-medium text-brand-navy"
                >
                  <option value="" disabled>
                    Reassign to…
                  </option>
                  <option value="_unassigned_">Unassigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setSelected(new Set())}
                  className="ml-auto rounded-md px-2 py-1 text-[11px] text-brand-muted hover:text-brand-navy"
                >
                  Clear
                </button>
              </div>
            ) : null}
            <ul className="divide-y divide-brand-hairline">
              <li className="flex items-center gap-2 px-5 py-1.5">
                <input
                  type="checkbox"
                  checked={
                    filtered.length > 0 && filtered.every((t) => selected.has(t.id))
                  }
                  onChange={toggleAll}
                  aria-label="Select all visible"
                  className="h-3.5 w-3.5 rounded border-brand-hairline text-brand-blue focus:ring-brand-blue"
                />
                <span className="text-[11px] uppercase tracking-wider text-brand-muted">
                  Select all ({filtered.length})
                </span>
              </li>
              {filtered.slice(0, 20).map((t) => {
                const sev = severityOf(t.hoursOverdue);
                return (
                  <li key={t.id} className="flex items-center gap-3 px-5 py-2.5">
                    <input
                      type="checkbox"
                      checked={selected.has(t.id)}
                      onChange={() => toggle(t.id)}
                      aria-label={`Select task ${t.title}`}
                      className="h-3.5 w-3.5 rounded border-brand-hairline text-brand-blue focus:ring-brand-blue"
                    />
                    <Link
                      href={`/leads/${t.leadId}`}
                      className="flex min-w-0 flex-1 items-start justify-between gap-3 rounded-md -mx-2 px-2 py-1 hover:bg-brand-blue-tint"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-brand-navy">
                          {t.title}
                        </div>
                        <div className="truncate text-xs text-brand-muted">
                          {t.leadName} · {t.assignee}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <Pill tone={SEVERITY_COLOR[sev]}>
                          {t.hoursOverdue >= 48
                            ? `${Math.round(t.hoursOverdue / 24)}d overdue`
                            : `${t.hoursOverdue}h overdue`}
                        </Pill>
                        <div className="mt-0.5 text-[11px] text-brand-muted">
                          was due {formatRelative(t.dueAt)}
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
        {flash ? (
          <div className="border-t border-brand-hairline bg-emerald-50 px-5 py-2 text-xs text-emerald-800">
            {flash}
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

export function StuckLeadsCard({ leads }: { leads: StuckLead[] }) {
  return (
    <Card>
      <CardHeader
        title="Stuck deals"
        action={
          <Pill tone={leads.length > 0 ? "amber" : "emerald"}>
            {leads.length} stale
          </Pill>
        }
      />
      <CardBody className="px-0 py-0">
        {leads.length === 0 ? (
          <div className="px-5 py-6 text-sm text-brand-muted">
            No stale deals — nothing has sat past its SLA. Keep it that way.
          </div>
        ) : (
          <ul className="divide-y divide-brand-hairline">
            {leads.map((l) => (
              <li key={l.id} className="px-5 py-2.5">
                <Link
                  href={`/leads/${l.id}`}
                  className="flex items-start justify-between gap-3 rounded-md -mx-2 px-2 py-1 hover:bg-brand-blue-tint"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-brand-navy">
                      {l.name}
                    </div>
                    <div className="truncate text-xs text-brand-muted">
                      {STAGE_LABEL[l.stage as Stage] ?? l.stage} ·{" "}
                      {l.ownerName ?? <span className="text-amber-600">Unassigned</span>}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <Pill tone={l.hoursInStage >= 168 ? "rose" : "amber"}>
                      {l.hoursInStage >= 48
                        ? `${Math.round(l.hoursInStage / 24)}d in stage`
                        : `${l.hoursInStage}h in stage`}
                    </Pill>
                    {l.estimatedAnnualValue ? (
                      <div className="mt-0.5 text-[11px] text-brand-muted tabular-nums">
                        {formatCurrency(l.estimatedAnnualValue)}
                      </div>
                    ) : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
