"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type LineItem = {
  id: string;
  kind:
    | "MONTHLY_BOOKKEEPING"
    | "MONTHLY_TAX"
    | "MONTHLY_ADVISORY"
    | "MONTHLY_ADDON"
    | "ONETIME_CLEANUP"
    | "ONETIME_TAX_RETURN"
    | "ONETIME_SETUP"
    | "ONETIME_OTHER";
  description: string;
  monthlyAmount: number | null;
  onetimeAmount: number | null;
  quantity: number;
};

type Props = {
  proposalId: string;
  items: LineItem[];
  scopeSummary: string | null;
  isEditable: boolean;
};

/**
 * Inline-editable scope + line items. Only active when proposal is still
 * DRAFT. Each change is a separate PATCH/POST/DELETE so we get per-field
 * optimistic feedback and totals stay in sync. After any mutation we
 * router.refresh() to pull the server-recomputed totals.
 */
export function EditableProposal({ proposalId, items, scopeSummary, isEditable }: Props) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function patchItem(itemId: string, body: Record<string, unknown>) {
    setBusyId(`patch:${itemId}`);
    setErr(null);
    try {
      const res = await fetch(`/api/proposals/${proposalId}/line-items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setErr(data?.error ?? "Failed to save");
      else router.refresh();
    } catch {
      setErr("Network error");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteItem(itemId: string) {
    if (!confirm("Remove this line item?")) return;
    setBusyId(`del:${itemId}`);
    setErr(null);
    try {
      const res = await fetch(`/api/proposals/${proposalId}/line-items/${itemId}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setErr(data?.error ?? "Failed to delete");
      else router.refresh();
    } catch {
      setErr("Network error");
    } finally {
      setBusyId(null);
    }
  }

  async function addItem(monthly: boolean) {
    setBusyId("add");
    setErr(null);
    try {
      const res = await fetch(`/api/proposals/${proposalId}/line-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: monthly ? "MONTHLY_ADDON" : "ONETIME_OTHER",
          description: monthly ? "New monthly line" : "New one-time line",
          monthlyAmount: monthly ? 0 : null,
          onetimeAmount: monthly ? null : 0,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setErr(data?.error ?? "Failed to add");
      else router.refresh();
    } catch {
      setErr("Network error");
    } finally {
      setBusyId(null);
    }
  }

  async function saveScope(next: string) {
    setBusyId("scope");
    setErr(null);
    try {
      const res = await fetch(`/api/proposals/${proposalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scopeSummary: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setErr(data?.error ?? "Failed to save");
      else router.refresh();
    } catch {
      setErr("Network error");
    } finally {
      setBusyId(null);
    }
  }

  const monthlyItems = items.filter((i) => i.monthlyAmount !== null && i.monthlyAmount >= 0);
  const onetimeItems = items.filter((i) => i.onetimeAmount !== null && i.onetimeAmount > 0);

  const monthlyTotal = monthlyItems.reduce((s, i) => s + Number(i.monthlyAmount ?? 0), 0);
  const onetimeTotal = onetimeItems.reduce((s, i) => s + Number(i.onetimeAmount ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Scope summary */}
      <section>
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-muted">
          Scope summary
        </div>
        <EditableText
          value={scopeSummary ?? ""}
          placeholder="Describe the engagement in one line…"
          disabled={!isEditable || busyId !== null}
          onSave={saveScope}
        />
      </section>

      {/* Monthly */}
      {monthlyItems.length > 0 ? (
        <section>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-muted">
            Monthly
          </div>
          <table className="w-full text-sm">
            <tbody>
              {monthlyItems.map((li) => (
                <EditableRow
                  key={li.id}
                  item={li}
                  amountField="monthlyAmount"
                  suffix="/mo"
                  isEditable={isEditable}
                  busy={busyId?.startsWith("patch:" + li.id) || busyId?.startsWith("del:" + li.id) || false}
                  onPatch={(body) => patchItem(li.id, body)}
                  onDelete={() => deleteItem(li.id)}
                />
              ))}
              <tr className="border-t-2 border-brand-navy">
                <td className="pt-2 text-sm font-semibold text-brand-navy">Monthly total</td>
                <td className="pt-2 text-right text-base font-semibold tabular-nums text-brand-navy">
                  ${monthlyTotal.toLocaleString()}/mo
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        </section>
      ) : null}

      {/* One-time */}
      {onetimeItems.length > 0 ? (
        <section>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-muted">
            One-time
          </div>
          <table className="w-full text-sm">
            <tbody>
              {onetimeItems.map((li) => (
                <EditableRow
                  key={li.id}
                  item={li}
                  amountField="onetimeAmount"
                  suffix=""
                  isEditable={isEditable}
                  busy={busyId?.startsWith("patch:" + li.id) || busyId?.startsWith("del:" + li.id) || false}
                  onPatch={(body) => patchItem(li.id, body)}
                  onDelete={() => deleteItem(li.id)}
                />
              ))}
              <tr className="border-t-2 border-brand-navy">
                <td className="pt-2 text-sm font-semibold text-brand-navy">One-time total</td>
                <td className="pt-2 text-right text-base font-semibold tabular-nums text-brand-navy">
                  ${onetimeTotal.toLocaleString()}
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        </section>
      ) : null}

      {isEditable ? (
        <div className="flex items-center gap-2 border-t border-brand-hairline pt-3">
          <button
            type="button"
            disabled={busyId !== null}
            onClick={() => addItem(true)}
            className="rounded-md border border-brand-hairline bg-white px-3 py-1.5 text-xs font-medium text-brand-navy hover:border-brand-blue-soft hover:bg-brand-blue-tint disabled:opacity-60"
          >
            + Add monthly line
          </button>
          <button
            type="button"
            disabled={busyId !== null}
            onClick={() => addItem(false)}
            className="rounded-md border border-brand-hairline bg-white px-3 py-1.5 text-xs font-medium text-brand-navy hover:border-brand-blue-soft hover:bg-brand-blue-tint disabled:opacity-60"
          >
            + Add one-time line
          </button>
        </div>
      ) : null}

      {err ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {err}
        </div>
      ) : null}
    </div>
  );
}

function EditableText({
  value,
  placeholder,
  disabled,
  onSave,
}: {
  value: string;
  placeholder?: string;
  disabled: boolean;
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (!editing) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setEditing(true)}
        className="w-full rounded-md border border-transparent px-2 py-1 text-left text-sm text-brand-navy transition hover:border-brand-hairline hover:bg-white disabled:cursor-default disabled:hover:border-transparent disabled:hover:bg-transparent"
      >
        {value || <span className="text-brand-muted">{placeholder}</span>}
      </button>
    );
  }
  return (
    <div className="space-y-2">
      <textarea
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={2}
        className="block w-full rounded-md border border-brand-hairline px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
      />
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setDraft(value);
            setEditing(false);
          }}
          className="rounded-md border border-brand-hairline bg-white px-2 py-1 text-[11px] font-medium text-brand-navy hover:bg-brand-blue-tint"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => {
            onSave(draft);
            setEditing(false);
          }}
          className="rounded-md bg-brand-blue px-2 py-1 text-[11px] font-semibold text-white hover:bg-brand-blue-dark"
        >
          Save
        </button>
      </div>
    </div>
  );
}

function EditableRow({
  item,
  amountField,
  suffix,
  isEditable,
  busy,
  onPatch,
  onDelete,
}: {
  item: LineItem;
  amountField: "monthlyAmount" | "onetimeAmount";
  suffix: string;
  isEditable: boolean;
  busy: boolean;
  onPatch: (body: Record<string, unknown>) => void;
  onDelete: () => void;
}) {
  const [descEditing, setDescEditing] = useState(false);
  const [draftDesc, setDraftDesc] = useState(item.description);
  const [amtEditing, setAmtEditing] = useState(false);
  const [draftAmt, setDraftAmt] = useState(String(item[amountField] ?? 0));

  return (
    <tr className="border-b border-brand-hairline/50 last:border-none">
      <td className="py-2 pr-3">
        {descEditing ? (
          <input
            autoFocus
            value={draftDesc}
            onChange={(e) => setDraftDesc(e.target.value)}
            onBlur={() => {
              setDescEditing(false);
              if (draftDesc !== item.description) onPatch({ description: draftDesc });
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") {
                setDraftDesc(item.description);
                setDescEditing(false);
              }
            }}
            className="block w-full rounded-md border border-brand-blue-soft bg-white px-2 py-1 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
          />
        ) : (
          <button
            type="button"
            disabled={!isEditable || busy}
            onClick={() => setDescEditing(true)}
            className="block w-full rounded px-2 py-1 text-left text-sm text-brand-navy transition hover:bg-brand-blue-tint/60 disabled:cursor-default disabled:hover:bg-transparent"
          >
            {item.description}
          </button>
        )}
      </td>
      <td className="w-36 py-2 pr-2 text-right tabular-nums">
        {amtEditing ? (
          <input
            autoFocus
            type="number"
            min={0}
            step={5}
            value={draftAmt}
            onChange={(e) => setDraftAmt(e.target.value)}
            onBlur={() => {
              setAmtEditing(false);
              const next = Number(draftAmt);
              if (Number.isFinite(next) && next !== Number(item[amountField] ?? 0)) {
                onPatch({ [amountField]: next });
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") {
                setDraftAmt(String(item[amountField] ?? 0));
                setAmtEditing(false);
              }
            }}
            className="block w-full rounded-md border border-brand-blue-soft bg-white px-2 py-1 text-right text-sm tabular-nums focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
          />
        ) : (
          <button
            type="button"
            disabled={!isEditable || busy}
            onClick={() => setAmtEditing(true)}
            className="block w-full rounded px-2 py-1 text-right text-brand-navy transition hover:bg-brand-blue-tint/60 disabled:cursor-default disabled:hover:bg-transparent"
          >
            ${Number(item[amountField] ?? 0).toLocaleString()}
            {suffix}
          </button>
        )}
      </td>
      <td className="w-10 py-2 text-right">
        {isEditable ? (
          <button
            type="button"
            disabled={busy}
            onClick={onDelete}
            title="Remove"
            className="rounded p-1 text-brand-muted transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-60"
          >
            ✕
          </button>
        ) : null}
      </td>
    </tr>
  );
}
