"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { computeDiscount } from "@/lib/features/proposals/discount";

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

export type ProposalDiscount = {
  label: string | null;
  amount: number | null;
  pct: number | null;
  appliesTo: "MONTHLY" | "ONETIME" | "BOTH" | null;
};

type Props = {
  proposalId: string;
  items: LineItem[];
  scopeSummary: string | null;
  discount: ProposalDiscount;
  signingUrl: string | null;
  /** Hide the paste-URL field if Anchor outbound push is live (it'll auto-fill). */
  anchorAutoPushEnabled: boolean;
  isEditable: boolean;
};

/**
 * Inline-editable scope + line items. Only active when proposal is still
 * DRAFT. Each change is a separate PATCH/POST/DELETE so we get per-field
 * optimistic feedback and totals stay in sync. After any mutation we
 * router.refresh() to pull the server-recomputed totals.
 */
export function EditableProposal({
  proposalId,
  items,
  scopeSummary,
  discount,
  signingUrl,
  anchorAutoPushEnabled,
  isEditable,
}: Props) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function patchProposal(body: Record<string, unknown>, busyKey: string) {
    setBusyId(busyKey);
    setErr(null);
    try {
      const res = await fetch(`/api/proposals/${proposalId}`, {
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
    await patchProposal({ scopeSummary: next }, "scope");
  }

  async function saveDiscount(next: ProposalDiscount) {
    await patchProposal(
      {
        discountLabel: next.label,
        discountAmount: next.amount,
        discountPct: next.pct,
        discountAppliesTo: next.appliesTo,
      },
      "discount"
    );
  }

  async function saveSigningUrl(next: string) {
    await patchProposal({ signingUrl: next }, "signingUrl");
  }

  const monthlyItems = items.filter((i) => i.monthlyAmount !== null && i.monthlyAmount >= 0);
  const onetimeItems = items.filter((i) => i.onetimeAmount !== null && i.onetimeAmount > 0);

  const monthlySubtotal = monthlyItems.reduce((s, i) => s + Number(i.monthlyAmount ?? 0), 0);
  const onetimeSubtotal = onetimeItems.reduce((s, i) => s + Number(i.onetimeAmount ?? 0), 0);

  const discountResult = computeDiscount(monthlySubtotal, onetimeSubtotal, {
    discountLabel: discount.label,
    discountAmount: discount.amount,
    discountPct: discount.pct,
    discountAppliesTo: discount.appliesTo,
  });
  const monthlyTotal = Math.max(0, monthlySubtotal - discountResult.monthly);
  const onetimeTotal = Math.max(0, onetimeSubtotal - discountResult.onetime);
  const hasDiscount = discountResult.totalDollars > 0;

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
              {discountResult.monthly > 0 ? (
                <>
                  <tr className="border-t border-brand-hairline">
                    <td className="pt-2 text-xs text-brand-muted">Subtotal</td>
                    <td className="pt-2 text-right text-sm tabular-nums text-brand-muted">
                      ${monthlySubtotal.toLocaleString()}/mo
                    </td>
                    <td />
                  </tr>
                  <tr>
                    <td className="py-1 text-xs text-emerald-700">
                      {discountResult.label || "Discount"}
                    </td>
                    <td className="py-1 text-right text-sm tabular-nums text-emerald-700">
                      −${discountResult.monthly.toLocaleString()}/mo
                    </td>
                    <td />
                  </tr>
                </>
              ) : null}
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
              {discountResult.onetime > 0 ? (
                <>
                  <tr className="border-t border-brand-hairline">
                    <td className="pt-2 text-xs text-brand-muted">Subtotal</td>
                    <td className="pt-2 text-right text-sm tabular-nums text-brand-muted">
                      ${onetimeSubtotal.toLocaleString()}
                    </td>
                    <td />
                  </tr>
                  <tr>
                    <td className="py-1 text-xs text-emerald-700">
                      {discountResult.label || "Discount"}
                    </td>
                    <td className="py-1 text-right text-sm tabular-nums text-emerald-700">
                      −${discountResult.onetime.toLocaleString()}
                    </td>
                    <td />
                  </tr>
                </>
              ) : null}
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

      {/* Discount editor */}
      <DiscountEditor
        discount={discount}
        hasDiscount={hasDiscount}
        isEditable={isEditable}
        busy={busyId === "discount"}
        onSave={saveDiscount}
      />

      {/* Anchor signing URL — only shown when auto-push isn't configured, so
          the rep can paste the URL from Anchor by hand before sending. */}
      {!anchorAutoPushEnabled ? (
        <SigningUrlEditor
          value={signingUrl ?? ""}
          isEditable={isEditable}
          busy={busyId === "signingUrl"}
          onSave={saveSigningUrl}
        />
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

function DiscountEditor({
  discount,
  hasDiscount,
  isEditable,
  busy,
  onSave,
}: {
  discount: ProposalDiscount;
  hasDiscount: boolean;
  isEditable: boolean;
  busy: boolean;
  onSave: (d: ProposalDiscount) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [mode, setMode] = useState<"percent" | "flat">(discount.pct ? "percent" : "flat");
  const [label, setLabel] = useState(discount.label ?? "");
  const [percent, setPercent] = useState<string>(discount.pct ? String(discount.pct) : "");
  const [amount, setAmount] = useState<string>(discount.amount ? String(discount.amount) : "");
  const [appliesTo, setAppliesTo] = useState<"MONTHLY" | "ONETIME" | "BOTH">(
    discount.appliesTo ?? "BOTH"
  );

  function save() {
    const pct = mode === "percent" ? (percent.trim() === "" ? null : Number(percent)) : null;
    const amt = mode === "flat" ? (amount.trim() === "" ? null : Number(amount)) : null;
    onSave({
      label: label.trim() || null,
      pct: pct && pct > 0 ? pct : null,
      amount: amt && amt > 0 ? amt : null,
      appliesTo,
    });
    setEditing(false);
  }

  function clear() {
    setLabel("");
    setPercent("");
    setAmount("");
    setAppliesTo("BOTH");
    onSave({ label: null, pct: null, amount: null, appliesTo: null });
    setEditing(false);
  }

  if (!hasDiscount && !editing) {
    return isEditable ? (
      <div className="border-t border-brand-hairline pt-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => setEditing(true)}
          className="rounded-md border border-brand-hairline bg-white px-3 py-1.5 text-xs font-medium text-brand-navy hover:border-brand-blue-soft hover:bg-brand-blue-tint disabled:opacity-60"
        >
          + Add discount
        </button>
      </div>
    ) : null;
  }

  if (hasDiscount && !editing) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border border-emerald-200/70 bg-emerald-50/50 px-3 py-2">
        <div className="text-xs text-emerald-800">
          <span className="font-semibold">
            {discount.label || (discount.pct ? `${discount.pct}% discount` : "Discount")}
          </span>
          <span className="ml-2 text-emerald-700">
            {discount.pct
              ? `${discount.pct}% off`
              : discount.amount
                ? `−$${Number(discount.amount).toLocaleString()}`
                : ""}
            {discount.appliesTo && discount.appliesTo !== "BOTH"
              ? ` · ${discount.appliesTo.toLowerCase()} only`
              : ""}
          </span>
        </div>
        {isEditable ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => setEditing(true)}
              className="rounded border border-brand-hairline bg-white px-2 py-1 text-[11px] font-medium text-brand-navy hover:bg-brand-blue-tint disabled:opacity-60"
            >
              Edit
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={clear}
              className="rounded border border-brand-hairline bg-white px-2 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-60"
            >
              Remove
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-md border border-brand-hairline bg-slate-50/40 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-muted">
        Discount
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="text-[11px] font-medium text-brand-muted">Label (shown to client)</span>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder='"New client discount"'
            className="mt-1 block w-full rounded-md border border-brand-hairline px-2 py-1.5 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
          />
        </label>
        <label className="block">
          <span className="text-[11px] font-medium text-brand-muted">Applies to</span>
          <select
            value={appliesTo}
            onChange={(e) => setAppliesTo(e.target.value as typeof appliesTo)}
            className="mt-1 block w-full rounded-md border border-brand-hairline bg-white px-2 py-1.5 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
          >
            <option value="BOTH">Monthly + One-time</option>
            <option value="MONTHLY">Monthly only</option>
            <option value="ONETIME">One-time only</option>
          </select>
        </label>
      </div>
      <div className="flex items-center gap-2">
        <div className="inline-flex rounded-md border border-brand-hairline bg-white p-0.5">
          <button
            type="button"
            onClick={() => setMode("percent")}
            className={`rounded px-2 py-1 text-[11px] font-medium transition ${
              mode === "percent" ? "bg-brand-navy text-white" : "text-brand-navy hover:bg-brand-blue-tint"
            }`}
          >
            %
          </button>
          <button
            type="button"
            onClick={() => setMode("flat")}
            className={`rounded px-2 py-1 text-[11px] font-medium transition ${
              mode === "flat" ? "bg-brand-navy text-white" : "text-brand-navy hover:bg-brand-blue-tint"
            }`}
          >
            $
          </button>
        </div>
        {mode === "percent" ? (
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
              className="w-20 rounded-md border border-brand-hairline px-2 py-1.5 text-sm tabular-nums focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
              placeholder="10"
            />
            <span className="text-sm text-brand-navy">%</span>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <span className="text-sm text-brand-navy">$</span>
            <input
              type="number"
              min={0}
              step={25}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-28 rounded-md border border-brand-hairline px-2 py-1.5 text-sm tabular-nums focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
              placeholder="500"
            />
          </div>
        )}
      </div>
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="rounded border border-brand-hairline bg-white px-2 py-1 text-[11px] font-medium text-brand-navy hover:bg-brand-blue-tint"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={save}
          className="rounded bg-brand-blue px-3 py-1 text-[11px] font-semibold text-white hover:bg-brand-blue-dark disabled:opacity-60"
        >
          {busy ? "Saving…" : "Apply discount"}
        </button>
      </div>
    </div>
  );
}

function SigningUrlEditor({
  value,
  isEditable,
  busy,
  onSave,
}: {
  value: string;
  isEditable: boolean;
  busy: boolean;
  onSave: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);

  if (value && !editing) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border border-brand-blue-soft/60 bg-brand-blue-tint/40 px-3 py-2">
        <div className="min-w-0 flex-1 text-xs">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-muted">
            Anchor signing URL
          </div>
          <a
            href={value}
            target="_blank"
            rel="noreferrer"
            className="mt-0.5 block truncate text-brand-blue hover:underline"
          >
            {value}
          </a>
        </div>
        {isEditable ? (
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setDraft(value);
                setEditing(true);
              }}
              className="rounded border border-brand-hairline bg-white px-2 py-1 text-[11px] font-medium text-brand-navy hover:bg-brand-blue-tint disabled:opacity-60"
            >
              Edit
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onSave("")}
              className="rounded border border-brand-hairline bg-white px-2 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-60"
            >
              Remove
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  if (!isEditable && !value) return null;

  return (
    <div className="space-y-2 rounded-md border border-amber-200/70 bg-amber-50/50 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-800">
        Anchor signing URL
      </div>
      <p className="text-[11px] text-brand-muted">
        Create the proposal in Anchor, copy the signing link, and paste it here. It&rsquo;ll be
        the &ldquo;Review &amp; sign&rdquo; button in the email we send the client.
      </p>
      <div className="flex items-center gap-2">
        <input
          type="url"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="https://app.sayanchor.com/engagements/..."
          className="block w-full rounded-md border border-brand-hairline bg-white px-3 py-1.5 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
        />
        <button
          type="button"
          disabled={busy || !draft.trim()}
          onClick={() => {
            onSave(draft.trim());
            setEditing(false);
          }}
          className="rounded-md bg-brand-blue px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-blue-dark disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        {editing ? (
          <button
            type="button"
            onClick={() => {
              setDraft(value);
              setEditing(false);
            }}
            className="rounded-md border border-brand-hairline bg-white px-3 py-1.5 text-xs font-medium text-brand-navy hover:bg-brand-blue-tint"
          >
            Cancel
          </button>
        ) : null}
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
