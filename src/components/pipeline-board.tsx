"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { StaleDot } from "@/components/stale-indicator";
import { RawPill } from "@/components/ui";
import {
  STAGE_LABEL,
  formatCurrency,
  gradeColor,
  type Lead,
  type Stage,
} from "@/lib/preview/fixtures";

/**
 * Column-level aging heat: the higher the fraction of leads past their SLA,
 * the warmer the column header color. Gives the board an at-a-glance "where's
 * the rot?" read without having to hover every card.
 */
const STALE_HOURS_PER_STAGE: Partial<Record<Stage, number>> = {
  NEW_LEAD: 4,
  CONTACTED: 72,
  QUALIFIED: 72,
  CONSULT_BOOKED: 168,
  CONSULT_COMPLETED: 72,
  PROPOSAL_DRAFTING: 72,
  PROPOSAL_SENT: 168,
  FOLLOW_UP_NEGOTIATION: 120,
};

function agingHeat(stage: Stage, leads: Lead[]): {
  ratio: number;
  headerClass: string;
} {
  const threshold = STALE_HOURS_PER_STAGE[stage];
  if (!threshold || leads.length === 0) {
    return { ratio: 0, headerClass: "" };
  }
  const now = Date.now();
  const staleCount = leads.filter((l) => {
    if (!l.lastStageChangeAt) return false;
    const hours = (now - new Date(l.lastStageChangeAt).getTime()) / 3_600_000;
    return hours >= threshold;
  }).length;
  const ratio = staleCount / leads.length;
  if (ratio >= 0.5) return { ratio, headerClass: "bg-rose-50 border-rose-200" };
  if (ratio >= 0.2) return { ratio, headerClass: "bg-amber-50 border-amber-200" };
  return { ratio, headerClass: "" };
}

const VISIBLE_STAGES: Stage[] = [
  "NEW_LEAD",
  "CONTACTED",
  "QUALIFIED",
  "CONSULT_BOOKED",
  "CONSULT_COMPLETED",
  "PROPOSAL_DRAFTING",
  "PROPOSAL_SENT",
  "FOLLOW_UP_NEGOTIATION",
  "WON",
  "LOST",
];

type Props = {
  board: Record<Stage, Lead[]>;
  canEdit: boolean; // requires db + auth
};

/**
 * Client-side optimistic drag-and-drop. We mirror the server's board shape in
 * React state, move cards optimistically on drop, and kick off a PATCH to
 * /api/leads/:id/stage. If the PATCH fails we snap the card back.
 */
export function PipelineBoard({ board, canEdit }: Props) {
  const router = useRouter();
  const [local, setLocal] = useState(board);
  const [dragging, setDragging] = useState<string | null>(null);
  const [hoverStage, setHoverStage] = useState<Stage | null>(null);
  const [flash, setFlash] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [, startTransition] = useTransition();

  function onDragStart(ev: React.DragEvent, leadId: string) {
    if (!canEdit) return;
    ev.dataTransfer.setData("text/lead-id", leadId);
    ev.dataTransfer.effectAllowed = "move";
    setDragging(leadId);
  }

  function onDragEnd() {
    setDragging(null);
    setHoverStage(null);
  }

  function onDragOver(ev: React.DragEvent, stage: Stage) {
    if (!canEdit) return;
    ev.preventDefault();
    ev.dataTransfer.dropEffect = "move";
    setHoverStage(stage);
  }

  async function onDrop(ev: React.DragEvent, toStage: Stage) {
    if (!canEdit) return;
    ev.preventDefault();
    const leadId = ev.dataTransfer.getData("text/lead-id");
    setHoverStage(null);
    setDragging(null);
    if (!leadId) return;

    // Find source
    let fromStage: Stage | null = null;
    let lead: Lead | null = null;
    for (const [stage, rows] of Object.entries(local) as Array<[Stage, Lead[]]>) {
      const match = rows.find((r) => r.id === leadId);
      if (match) {
        fromStage = stage;
        lead = match;
        break;
      }
    }
    if (!lead || !fromStage || fromStage === toStage) return;

    // Optimistic: move the card right now.
    const before = local;
    const next: Record<Stage, Lead[]> = {
      ...local,
      [fromStage]: (local[fromStage] ?? []).filter((r) => r.id !== leadId),
      [toStage]: [{ ...lead, stage: toStage }, ...(local[toStage] ?? [])],
    };
    setLocal(next);

    try {
      const res = await fetch(`/api/leads/${leadId}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: toStage }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Stage update failed (${res.status})`);
      }
      setFlash({ kind: "ok", text: `Moved ${lead.firstName} ${lead.lastName} → ${STAGE_LABEL[toStage]}` });
      startTransition(() => router.refresh());
    } catch (err) {
      setLocal(before);
      setFlash({ kind: "err", text: err instanceof Error ? err.message : "Move failed" });
    } finally {
      setTimeout(() => setFlash(null), 2500);
    }
  }

  return (
    <div className="relative">
      {!canEdit ? (
        <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Drag-to-move is disabled — database + auth are required. Set{" "}
          <code>DATABASE_URL</code> and Clerk keys to enable.
        </div>
      ) : null}

      <div className="-mx-6 overflow-x-auto px-6 pb-6">
        <div className="flex min-w-max gap-3">
          {VISIBLE_STAGES.map((stage) => {
            const inStage = local[stage] ?? [];
            const total = inStage.reduce((sum, l) => sum + (l.estimatedAnnualValue ?? 0), 0);
            const isHover = hoverStage === stage;
            const heat = agingHeat(stage, inStage);
            return (
              <div
                key={stage}
                onDragOver={(e) => onDragOver(e, stage)}
                onDragLeave={() => setHoverStage((h) => (h === stage ? null : h))}
                onDrop={(e) => onDrop(e, stage)}
                className={`w-72 shrink-0 rounded-xl border bg-white/70 transition ${
                  isHover
                    ? "border-brand-blue bg-brand-blue-tint/80 ring-2 ring-brand-blue/30"
                    : "border-brand-hairline"
                }`}
              >
                <div
                  className={`flex items-center justify-between border-b border-brand-hairline px-3 py-2.5 transition ${heat.headerClass}`}
                  title={
                    heat.ratio > 0
                      ? `${Math.round(heat.ratio * 100)}% of leads in this column are past SLA`
                      : undefined
                  }
                >
                  <div>
                    <div className="text-sm font-semibold text-brand-navy">{STAGE_LABEL[stage]}</div>
                    <div className="text-xs text-brand-muted">
                      {inStage.length} lead{inStage.length === 1 ? "" : "s"}
                      {total > 0 ? ` · ${formatCurrency(total)}` : ""}
                      {heat.ratio >= 0.2 ? (
                        <span
                          className={
                            heat.ratio >= 0.5 ? "ml-1 text-rose-700" : "ml-1 text-amber-700"
                          }
                        >
                          · {Math.round(heat.ratio * 100)}% stale
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="space-y-2 p-2">
                  {inStage.length === 0 ? (
                    <div className="rounded-md border border-dashed border-brand-hairline bg-white px-3 py-6 text-center text-xs text-brand-muted">
                      {isHover ? "Drop to move here" : "No leads in this stage"}
                    </div>
                  ) : (
                    inStage.map((l) => (
                      <div
                        key={l.id}
                        draggable={canEdit}
                        onDragStart={(e) => onDragStart(e, l.id)}
                        onDragEnd={onDragEnd}
                        className={`rounded-md border bg-white p-3 shadow-card transition ${
                          dragging === l.id
                            ? "opacity-40 scale-[0.98]"
                            : "border-brand-hairline hover:border-brand-blue-soft hover:shadow-card-hover"
                        } ${canEdit ? "cursor-grab active:cursor-grabbing" : ""}`}
                      >
                        <Link href={`/leads/${l.id}`} className="block">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <StaleDot stage={l.stage} lastStageChangeAt={l.lastStageChangeAt} />
                                <span className="truncate text-sm font-medium text-brand-navy">
                                  {l.firstName} {l.lastName}
                                </span>
                              </div>
                              <div className="truncate text-xs text-brand-muted">{l.niche}</div>
                            </div>
                            <RawPill className={gradeColor(l.grade)}>{l.grade}</RawPill>
                          </div>
                          <div className="mt-2 flex items-center justify-between text-xs text-brand-muted">
                            <span>{l.source}</span>
                            <span className="tabular-nums text-slate-700">
                              {l.estimatedAnnualValue ? formatCurrency(l.estimatedAnnualValue) : "—"}
                            </span>
                          </div>
                          {l.ownerName ? (
                            <div className="mt-1 text-xs text-brand-muted">Owner: {l.ownerName}</div>
                          ) : (
                            <div className="mt-1 text-xs text-amber-600">Unassigned</div>
                          )}
                        </Link>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {flash ? (
        <div
          className={`fixed bottom-6 right-6 z-50 rounded-md px-3 py-2 text-sm shadow-card-hover ${
            flash.kind === "ok"
              ? "bg-brand-navy text-white"
              : "bg-rose-600 text-white"
          }`}
        >
          {flash.text}
        </div>
      ) : null}
    </div>
  );
}
