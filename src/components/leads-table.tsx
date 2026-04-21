"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BulkActionBar } from "@/components/bulk-action-bar";
import { LeadStagePill } from "@/components/lead-stage-pill";
import { SortableTh } from "@/components/sortable-th";
import { StaleBadge } from "@/components/stale-indicator";
import { RawPill } from "@/components/ui";
import type { LeadsSortKey } from "@/lib/features/leads/queries";
import {
  formatCurrency,
  formatRelative,
  gradeColor,
  type Lead,
} from "@/lib/preview/fixtures";

type Props = {
  leads: Lead[];
  users: Array<{ id: string; name: string; email: string }>;
  lostReasons: Array<{ code: string; label: string }>;
  currentSort?: LeadsSortKey;
  currentDir?: "asc" | "desc";
  paramsSnapshot: Record<string, string | undefined>;
  canEdit: boolean;
};

export function LeadsTable({
  leads,
  users,
  lostReasons,
  currentSort,
  currentDir,
  paramsSnapshot,
  canEdit,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const allOnPage = useMemo(() => new Set(leads.map((l) => l.id)), [leads]);
  const allSelected = selected.size > 0 && leads.every((l) => selected.has(l.id));
  const someSelected = selected.size > 0 && !allSelected;

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(allOnPage));
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1200px] text-sm">
          <thead>
            <tr className="border-y border-brand-hairline/70 bg-slate-50/40 text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-muted">
              <th className="px-5 py-2.5">
                <input
                  type="checkbox"
                  aria-label="Select all on page"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={toggleAll}
                  className="h-4 w-4 rounded border-brand-hairline text-brand-blue focus:ring-brand-blue"
                />
              </th>
              <SortableTh
                column="name"
                align="left"
                className="py-2.5"
                currentSort={currentSort}
                currentDir={currentDir}
                params={paramsSnapshot}
              >
                Name
              </SortableTh>
              <SortableTh column="niche" className="py-2.5" currentSort={currentSort} currentDir={currentDir} params={paramsSnapshot}>
                Niche
              </SortableTh>
              <SortableTh column="service" className="py-2.5" currentSort={currentSort} currentDir={currentDir} params={paramsSnapshot}>
                Service
              </SortableTh>
              <SortableTh column="source" className="py-2.5" currentSort={currentSort} currentDir={currentDir} params={paramsSnapshot}>
                Source
              </SortableTh>
              <SortableTh column="owner" className="py-2.5" currentSort={currentSort} currentDir={currentDir} params={paramsSnapshot}>
                Owner
              </SortableTh>
              <SortableTh column="score" align="right" className="py-2.5" currentSort={currentSort} currentDir={currentDir} params={paramsSnapshot}>
                Score
              </SortableTh>
              <SortableTh column="stage" className="py-2.5" currentSort={currentSort} currentDir={currentDir} params={paramsSnapshot}>
                Stage
              </SortableTh>
              <SortableTh column="nextAction" className="py-2.5" currentSort={currentSort} currentDir={currentDir} params={paramsSnapshot}>
                Next action
              </SortableTh>
              <SortableTh column="arr" align="right" className="py-2.5" currentSort={currentSort} currentDir={currentDir} params={paramsSnapshot}>
                Est. ARR
              </SortableTh>
              <SortableTh column="created" align="right" className="px-5 py-2.5" currentSort={currentSort} currentDir={currentDir} params={paramsSnapshot}>
                Created
              </SortableTh>
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-5 py-8 text-center text-sm text-brand-muted">
                  No leads match these filters.
                </td>
              </tr>
            ) : (
              leads.map((l) => {
                const isSelected = selected.has(l.id);
                return (
                  <tr
                    key={l.id}
                    className={`group border-b border-brand-hairline/50 transition-colors last:border-none ${
                      isSelected ? "bg-brand-blue-tint/60" : "hover:bg-slate-50/70"
                    }`}
                  >
                    <td className="px-5 py-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleOne(l.id)}
                        aria-label={`Select ${l.firstName} ${l.lastName}`}
                        className="h-4 w-4 rounded border-brand-hairline text-brand-blue focus:ring-brand-blue"
                      />
                    </td>
                    <td className="py-3">
                      <Link href={`/leads/${l.id}`} className="block">
                        <div className="font-semibold tracking-tight text-brand-navy group-hover:text-brand-blue">
                          {l.firstName} {l.lastName}
                        </div>
                        <div className="mt-0.5 text-xs text-brand-muted">{l.email}</div>
                      </Link>
                    </td>
                    <td className="py-3 text-slate-700">{l.niche}</td>
                    <td className="py-3 text-slate-700">{l.serviceInterest}</td>
                    <td className="py-3 text-slate-700">{l.source}</td>
                    <td className="py-3 text-slate-700">
                      {l.ownerName ?? <span className="text-amber-600">Unassigned</span>}
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="tabular-nums text-slate-700">{l.score}</span>
                        <RawPill className={gradeColor(l.grade)}>{l.grade}</RawPill>
                      </div>
                    </td>
                    <td className="py-3">
                      <div className="flex flex-col items-start gap-1">
                        <LeadStagePill
                          leadId={l.id}
                          currentStage={l.stage}
                          lostReasons={lostReasons}
                          disabled={!canEdit}
                        />
                        <StaleBadge stage={l.stage} lastStageChangeAt={l.lastStageChangeAt} />
                      </div>
                    </td>
                    <td className="py-3">
                      <NextActionCell
                        title={l.nextActionTitle}
                        dueAt={l.nextActionAt}
                        priority={l.nextActionPriority}
                      />
                    </td>
                    <td className="py-3 text-right tabular-nums text-slate-700">
                      {l.estimatedAnnualValue ? formatCurrency(l.estimatedAnnualValue) : "—"}
                    </td>
                    <td className="px-5 py-3 text-right text-xs text-brand-muted">
                      {formatRelative(l.createdAt)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <BulkActionBar
        selectedIds={Array.from(selected)}
        onClear={() => setSelected(new Set())}
        users={users}
        canEdit={canEdit}
        allVisibleRows={leads as unknown as Array<Record<string, unknown>>}
      />
    </>
  );
}

function NextActionCell({
  title,
  dueAt,
  priority,
}: {
  title?: string;
  dueAt?: string;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
}) {
  if (!title || !dueAt) return <span className="text-xs text-brand-muted">—</span>;
  const due = new Date(dueAt).getTime();
  const now = Date.now();
  const overdue = due < now;
  const soon = !overdue && due - now < 24 * 3600 * 1000;
  const tone = overdue
    ? "bg-rose-100 text-rose-800 ring-rose-200"
    : soon
      ? "bg-amber-100 text-amber-800 ring-amber-200"
      : "bg-brand-blue-tint text-brand-blue ring-brand-blue-soft";
  const dot = overdue ? "bg-rose-500" : soon ? "bg-amber-500" : "bg-brand-blue";
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        <span className="max-w-[220px] truncate text-xs text-brand-navy">{title}</span>
        {priority === "URGENT" || priority === "HIGH" ? (
          <span className="text-[10px] font-semibold text-rose-600">
            {priority === "URGENT" ? "!!" : "!"}
          </span>
        ) : null}
      </div>
      <span
        className={`inline-flex w-fit items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset ${tone}`}
      >
        {overdue ? "overdue · " : ""}
        {formatRelative(dueAt)}
      </span>
    </div>
  );
}
