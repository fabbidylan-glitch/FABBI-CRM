"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card, CardBody, Pill, RawPill } from "@/components/ui";
import {
  ONBOARDING_STAGE_ORDER,
  REQUIRED_BEFORE_COMPLETE,
  STAGE_LABEL,
  nextStage,
  stageIndex,
} from "@/lib/onboarding/templates";
import type { ChecklistItemKind, ChecklistItemStatus, OnboardingStage } from "@prisma/client";

type Item = {
  id: string;
  kind: ChecklistItemKind;
  label: string;
  description: string | null;
  status: ChecklistItemStatus;
  note: string | null;
};

type Props = {
  onboarding: {
    id: string;
    leadId: string;
    leadName: string;
    companyName: string | null;
    templateKey: string | null;
    stage: OnboardingStage;
    blockerNote: string | null;
    blockedAt: string | null;
    completedAt: string | null;
    scopeSummary: string | null;
    monthlyFee: number | null;
    catchupFee: number | null;
    taxFee: number | null;
    assignedUserId: string | null;
    assignedUserName: string | null;
    items: Item[];
  };
  users: Array<{ id: string; name: string }>;
  canEdit: boolean;
};

const KIND_LABEL: Record<ChecklistItemKind, string> = {
  DOCUMENT: "Document",
  ACCESS: "Software access",
  QUESTION: "Question",
  SETUP: "Setup",
};

export function OnboardingDetail({ onboarding, users, canEdit }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function patch(path: string, body: Record<string, unknown>) {
    setErr(null);
    try {
      const res = await fetch(`/api/onboarding/${onboarding.id}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data?.error ?? "Request failed");
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setErr("Network error");
      return false;
    }
  }

  async function advanceStage() {
    const next = nextStage(onboarding.stage);
    if (!next) return;
    setLoading("advance");
    await patch("/stage", { stage: next });
    setLoading(null);
  }

  async function toggleItem(itemId: string, status: ChecklistItemStatus) {
    setLoading(`item:${itemId}`);
    await patch(`/items/${itemId}`, { status });
    setLoading(null);
  }

  async function updateBlocker(note: string | null) {
    setLoading("blocker");
    await patch("/blocker", { note });
    setLoading(null);
  }

  async function changeAssignee(userId: string | null) {
    setLoading("assign");
    await patch("/assign", { assignedUserId: userId });
    setLoading(null);
  }

  async function markComplete() {
    setLoading("complete");
    await patch("/complete", {});
    setLoading(null);
  }

  const groupedItems: Record<ChecklistItemKind, Item[]> = {
    DOCUMENT: [],
    ACCESS: [],
    QUESTION: [],
    SETUP: [],
  };
  for (const it of onboarding.items) groupedItems[it.kind].push(it);

  const doneItems = onboarding.items.filter((i) => i.status === "COMPLETE" || i.status === "NOT_APPLICABLE").length;
  const blockedItems = onboarding.items.filter((i) => i.status === "BLOCKED").length;
  const requiredReady = REQUIRED_BEFORE_COMPLETE.every((req) =>
    stageIndex(onboarding.stage) >= stageIndex(req)
  );
  const canComplete = requiredReady && blockedItems === 0 && !onboarding.completedAt;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        {/* Header */}
        <Card className="overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-brand-blue via-brand-blue-dark to-brand-navy" />
          <CardBody>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-muted">
                  Client onboarding
                </div>
                <h2 className="mt-1 text-2xl font-semibold tracking-[-0.01em] text-brand-navy">
                  {onboarding.leadName}
                  {onboarding.companyName ? ` · ${onboarding.companyName}` : ""}
                </h2>
                {onboarding.scopeSummary ? (
                  <p className="mt-2 max-w-2xl text-sm text-brand-muted">{onboarding.scopeSummary}</p>
                ) : null}
                {onboarding.templateKey ? (
                  <div className="mt-2">
                    <RawPill className="bg-brand-blue-tint text-brand-blue ring-brand-blue-soft/60">
                      {onboarding.templateKey.replaceAll("_", " ")}
                    </RawPill>
                  </div>
                ) : null}
              </div>
              <div className="text-right text-xs text-brand-muted">
                <div className="text-[10px] font-semibold uppercase tracking-wider">Monthly</div>
                <div className="mt-0.5 text-xl font-semibold tabular-nums text-brand-navy">
                  {onboarding.monthlyFee ? `$${onboarding.monthlyFee.toLocaleString()}` : "—"}
                </div>
                {onboarding.catchupFee || onboarding.taxFee ? (
                  <div className="mt-1 space-y-0.5 text-[11px]">
                    {onboarding.catchupFee ? (
                      <div>
                        Catch-up{" "}
                        <span className="tabular-nums text-brand-navy">
                          ${onboarding.catchupFee.toLocaleString()}
                        </span>
                      </div>
                    ) : null}
                    {onboarding.taxFee ? (
                      <div>
                        Tax{" "}
                        <span className="tabular-nums text-brand-navy">
                          ${onboarding.taxFee.toLocaleString()}
                        </span>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Stage ladder */}
        <Card>
          <CardBody>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-brand-navy">Stage</h3>
              <Pill tone={onboarding.completedAt ? "emerald" : onboarding.blockedAt ? "rose" : "brand"}>
                {onboarding.completedAt
                  ? "Complete"
                  : onboarding.blockedAt
                    ? "Blocked"
                    : STAGE_LABEL[onboarding.stage]}
              </Pill>
            </div>
            <StageLadder stage={onboarding.stage} completed={!!onboarding.completedAt} />
            {!onboarding.completedAt ? (
              <div className="mt-4 flex items-center justify-between gap-3 border-t border-brand-hairline pt-3">
                <div className="text-[11px] text-brand-muted">
                  {nextStage(onboarding.stage)
                    ? `Next: ${STAGE_LABEL[nextStage(onboarding.stage)!]}`
                    : "Final stage — mark complete when checklist is done."}
                </div>
                <div className="flex items-center gap-2">
                  {nextStage(onboarding.stage) ? (
                    <button
                      type="button"
                      disabled={!canEdit || loading !== null}
                      onClick={advanceStage}
                      className="rounded-md bg-brand-blue px-3 py-1.5 text-xs font-semibold text-white shadow-btn-primary transition hover:bg-brand-blue-dark disabled:opacity-60"
                    >
                      {loading === "advance" ? "Advancing…" : "Advance stage"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={!canEdit || !canComplete || loading !== null}
                    onClick={markComplete}
                    title={
                      !canComplete
                        ? `Need ${REQUIRED_BEFORE_COMPLETE.map((s) => STAGE_LABEL[s]).join(", ")} and no blocked items to complete.`
                        : undefined
                    }
                    className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-btn-primary transition hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {loading === "complete" ? "Completing…" : "Mark complete"}
                  </button>
                </div>
              </div>
            ) : null}
          </CardBody>
        </Card>

        {/* Checklist */}
        <Card>
          <CardBody>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-brand-navy">Checklist</h3>
              <span className="text-xs tabular-nums text-brand-muted">
                {doneItems} of {onboarding.items.length} done
                {blockedItems > 0 ? ` · ${blockedItems} blocked` : ""}
              </span>
            </div>
            {(Object.keys(groupedItems) as ChecklistItemKind[]).map((k) => {
              const items = groupedItems[k];
              if (items.length === 0) return null;
              return (
                <div key={k} className="mb-4 last:mb-0">
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-muted">
                    {KIND_LABEL[k]}
                  </div>
                  <ul className="divide-y divide-brand-hairline/60 rounded-lg border border-brand-hairline/60">
                    {items.map((it) => (
                      <ChecklistRow
                        key={it.id}
                        item={it}
                        canEdit={canEdit}
                        loading={loading === `item:${it.id}`}
                        onToggle={(status) => toggleItem(it.id, status)}
                      />
                    ))}
                  </ul>
                </div>
              );
            })}
          </CardBody>
        </Card>

        {err ? (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
            {err}
          </div>
        ) : null}
      </div>

      <div className="space-y-4">
        <Card>
          <CardBody>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-muted">
              Owner
            </div>
            <select
              value={onboarding.assignedUserId ?? ""}
              disabled={!canEdit || loading !== null}
              onChange={(e) => changeAssignee(e.target.value || null)}
              className="mt-2 block w-full rounded-md border border-brand-hairline bg-white px-3 py-2 text-sm text-brand-navy focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20 disabled:opacity-60"
            >
              <option value="">Unassigned</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </CardBody>
        </Card>

        <BlockerCard
          note={onboarding.blockerNote}
          blockedAt={onboarding.blockedAt}
          canEdit={canEdit}
          loading={loading === "blocker"}
          onSave={updateBlocker}
        />

        <Card>
          <CardBody>
            <h3 className="text-sm font-semibold text-brand-navy">Related</h3>
            <ul className="mt-2 space-y-1 text-xs">
              <li>
                <a
                  href={`/leads/${onboarding.leadId}`}
                  className="text-brand-blue hover:underline"
                >
                  View lead →
                </a>
              </li>
            </ul>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function ChecklistRow({
  item,
  canEdit,
  loading,
  onToggle,
}: {
  item: Item;
  canEdit: boolean;
  loading: boolean;
  onToggle: (status: ChecklistItemStatus) => void;
}) {
  const nextStatus: ChecklistItemStatus =
    item.status === "COMPLETE" || item.status === "NOT_APPLICABLE" ? "PENDING" : "COMPLETE";
  return (
    <li className="flex items-start gap-3 px-3 py-2.5">
      <button
        type="button"
        disabled={!canEdit || loading}
        onClick={() => onToggle(nextStatus)}
        aria-pressed={item.status === "COMPLETE"}
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
          item.status === "COMPLETE"
            ? "border-emerald-500 bg-emerald-500 text-white"
            : item.status === "BLOCKED"
              ? "border-rose-400 bg-rose-50"
              : item.status === "NOT_APPLICABLE"
                ? "border-slate-300 bg-slate-50"
                : "border-brand-hairline bg-white hover:border-brand-blue"
        } disabled:opacity-60`}
      >
        {item.status === "COMPLETE" ? (
          <span aria-hidden className="text-[10px] leading-none">✓</span>
        ) : null}
      </button>
      <div className="min-w-0 flex-1">
        <div className={`text-sm ${item.status === "COMPLETE" ? "text-brand-muted line-through" : "text-brand-navy"}`}>
          {item.label}
        </div>
        {item.description ? (
          <div className="mt-0.5 text-[11px] text-brand-muted">{item.description}</div>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {item.status !== "BLOCKED" ? (
          <button
            type="button"
            disabled={!canEdit || loading}
            onClick={() => onToggle("BLOCKED")}
            className="text-[10px] font-medium text-rose-600 hover:underline disabled:opacity-60"
          >
            Block
          </button>
        ) : (
          <button
            type="button"
            disabled={!canEdit || loading}
            onClick={() => onToggle("PENDING")}
            className="text-[10px] font-medium text-brand-blue hover:underline disabled:opacity-60"
          >
            Unblock
          </button>
        )}
        {item.status !== "NOT_APPLICABLE" && item.status !== "COMPLETE" ? (
          <button
            type="button"
            disabled={!canEdit || loading}
            onClick={() => onToggle("NOT_APPLICABLE")}
            className="ml-2 text-[10px] font-medium text-brand-muted hover:text-brand-navy hover:underline disabled:opacity-60"
          >
            N/A
          </button>
        ) : null}
      </div>
    </li>
  );
}

function StageLadder({ stage, completed }: { stage: OnboardingStage; completed: boolean }) {
  const currentIdx = completed ? ONBOARDING_STAGE_ORDER.length - 1 : stageIndex(stage);
  return (
    <ol className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
      {ONBOARDING_STAGE_ORDER.map((s, i) => {
        const isDone = i < currentIdx || completed;
        const isCurrent = !completed && i === currentIdx;
        return (
          <li
            key={s}
            className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs ${
              isDone
                ? "border-emerald-200/70 bg-emerald-50 text-emerald-800"
                : isCurrent
                  ? "border-brand-blue-soft bg-brand-blue-tint font-semibold text-brand-navy"
                  : "border-brand-hairline bg-white text-brand-muted"
            }`}
          >
            <span
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
                isDone
                  ? "bg-emerald-600 text-white"
                  : isCurrent
                    ? "bg-brand-blue text-white"
                    : "bg-brand-hairline text-brand-muted"
              }`}
            >
              {isDone ? "✓" : i + 1}
            </span>
            <span className="truncate">{STAGE_LABEL[s]}</span>
          </li>
        );
      })}
    </ol>
  );
}

function BlockerCard({
  note,
  blockedAt,
  canEdit,
  loading,
  onSave,
}: {
  note: string | null;
  blockedAt: string | null;
  canEdit: boolean;
  loading: boolean;
  onSave: (note: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note ?? "");

  if (!blockedAt && !editing) {
    return (
      <Card>
        <CardBody>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-muted">
                Blocker
              </div>
              <div className="mt-1 text-sm text-brand-muted">None</div>
            </div>
            <button
              type="button"
              disabled={!canEdit}
              onClick={() => setEditing(true)}
              className="rounded-md border border-brand-hairline bg-white px-2 py-1 text-[11px] font-medium text-rose-600 hover:border-rose-200 hover:bg-rose-50 disabled:opacity-60"
            >
              Flag
            </button>
          </div>
        </CardBody>
      </Card>
    );
  }

  if (blockedAt && !editing) {
    return (
      <Card>
        <CardBody>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-700">
            Blocker flagged
          </div>
          <p className="mt-1 text-sm text-brand-navy">{note}</p>
          <div className="mt-1 text-[11px] text-brand-muted">
            Since {new Date(blockedAt).toLocaleDateString()}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={!canEdit || loading}
              onClick={() => {
                setDraft(note ?? "");
                setEditing(true);
              }}
              className="rounded-md border border-brand-hairline bg-white px-2 py-1 text-[11px] font-medium text-brand-navy hover:bg-brand-blue-tint disabled:opacity-60"
            >
              Edit
            </button>
            <button
              type="button"
              disabled={!canEdit || loading}
              onClick={() => onSave(null)}
              className="rounded-md border border-brand-hairline bg-white px-2 py-1 text-[11px] font-medium text-brand-navy hover:bg-brand-blue-tint disabled:opacity-60"
            >
              {loading ? "Clearing…" : "Clear blocker"}
            </button>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody>
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-700">
          {blockedAt ? "Edit blocker" : "Flag blocker"}
        </div>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          placeholder="What's stopping this onboarding?"
          className="mt-2 block w-full rounded-md border border-brand-hairline bg-white px-2 py-1.5 text-xs focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-400/20"
        />
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setDraft(note ?? "");
            }}
            className="flex-1 rounded-md border border-brand-hairline bg-white px-2 py-1 text-[11px] font-medium text-brand-navy hover:bg-brand-blue-tint"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading || draft.trim().length === 0}
            onClick={() => {
              onSave(draft.trim());
              setEditing(false);
            }}
            className="flex-1 rounded-md bg-rose-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
          >
            {loading ? "Saving…" : "Save"}
          </button>
        </div>
      </CardBody>
    </Card>
  );
}
