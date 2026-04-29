"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";

export type ExpenseRow = {
  id: string;
  category: string;
  label: string;
  amount: number;
  frequency: string;
  notes: string | null;
};

const CATEGORY_OPTIONS = [
  "PROPERTY_TAXES",
  "INSURANCE",
  "UTILITIES",
  "INTERNET",
  "REPAIRS_MAINTENANCE",
  "SUPPLIES",
  "CLEANING",
  "PLATFORM_FEES",
  "PROPERTY_MANAGEMENT",
  "EXTERIOR_SERVICES",
  "HOA",
  "ACCOUNTING",
  "MISC",
  "CUSTOM",
] as const;

const FREQUENCY_OPTIONS = ["MONTHLY", "ANNUAL", "PER_BOOKING", "ONE_TIME"] as const;

const usd0 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

/**
 * Custom expense lines. The standard 13 expense fields live on STRDeal —
 * this panel is for ad-hoc lines (pest control, permit fees, etc.) that
 * don't deserve their own column. Adding/removing rows triggers a recompute
 * so the underwriting numbers stay in sync.
 */
export function ExpensesPanel({
  dealId,
  expenses,
}: {
  dealId: string;
  expenses: ExpenseRow[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function handleAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const payload = {
      category: fd.get("category"),
      label: String(fd.get("label") ?? "").trim(),
      amount: Number(fd.get("amount") ?? 0),
      frequency: fd.get("frequency"),
      notes: emptyToNull(fd.get("notes")),
    };
    if (!payload.label) {
      setError("Label is required.");
      setBusy(false);
      return;
    }

    try {
      const res = await fetch(`/api/str-deals/${dealId}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Save failed (${res.status})`);
      } else {
        e.currentTarget.reset();
        setShowForm(false);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(expenseId: string, label: string) {
    if (!confirm(`Remove "${label}"?`)) return;
    const res = await fetch(`/api/str-deals/${dealId}/expenses/${expenseId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      alert(body.error ?? "Delete failed");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-brand-muted">
          Custom expense lines beyond the 13 standard fields. Annualized into
          operating expenses on every recompute.
        </p>
        <button
          type="button"
          onClick={() => {
            setShowForm((s) => !s);
            setError(null);
          }}
          className="rounded-md border border-brand-hairline bg-white px-3 py-1.5 text-xs font-medium text-brand-navy transition hover:bg-brand-blue-tint"
        >
          {showForm ? "Cancel" : "+ Add expense line"}
        </button>
      </div>

      {showForm ? (
        <form
          onSubmit={handleAdd}
          className="space-y-4 rounded-2xl border border-brand-hairline/60 bg-white p-5 shadow-card"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Category">
              <select name="category" defaultValue="CUSTOM" className={INPUT_CLS}>
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Frequency">
              <select name="frequency" defaultValue="MONTHLY" className={INPUT_CLS}>
                {FREQUENCY_OPTIONS.map((f) => (
                  <option key={f} value={f}>
                    {f.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Label" required>
              <input
                name="label"
                required
                placeholder="e.g. Pest control"
                className={INPUT_CLS}
              />
            </Field>
            <Field label="Amount">
              <input
                name="amount"
                type="number"
                inputMode="decimal"
                step="10"
                defaultValue="0"
                className={INPUT_CLS}
              />
            </Field>
          </div>
          <Field label="Notes (optional)">
            <textarea name="notes" rows={2} className={INPUT_CLS} />
          </Field>

          {error ? (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-2 border-t border-brand-hairline pt-3">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-md border border-brand-hairline bg-white px-3 py-1.5 text-xs font-medium text-brand-navy hover:bg-brand-blue-tint"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-brand-blue px-3 py-1.5 text-xs font-semibold text-white shadow-btn-primary transition hover:bg-brand-blue-dark disabled:opacity-60"
            >
              {busy ? "Saving…" : "Add"}
            </button>
          </div>
        </form>
      ) : null}

      {expenses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-brand-hairline bg-white px-5 py-6 text-center text-xs text-brand-muted">
          No custom expense lines.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-brand-hairline/60 bg-white shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/60 text-[11px] uppercase tracking-wide text-brand-muted">
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold">Label</th>
                <th className="px-4 py-2.5 text-left font-semibold">Category</th>
                <th className="px-4 py-2.5 text-left font-semibold">Frequency</th>
                <th className="px-4 py-2.5 text-right font-semibold">Amount</th>
                <th className="px-4 py-2.5 text-right font-semibold">Annualized</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-hairline/70">
              {expenses.map((e) => (
                <tr key={e.id} className="hover:bg-brand-blue-tint/30">
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-brand-navy">{e.label}</div>
                    {e.notes ? (
                      <div className="text-[11px] text-brand-muted">{e.notes}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-brand-muted">
                    {e.category.replace(/_/g, " ")}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-brand-muted">
                    {e.frequency.replace(/_/g, " ")}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {usd0.format(e.amount)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-brand-muted">
                    {usd0.format(annualize(e.amount, e.frequency))}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => handleDelete(e.id, e.label)}
                      className="text-xs font-medium text-rose-600 hover:text-rose-800"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function annualize(amount: number, frequency: string): number {
  switch (frequency) {
    case "MONTHLY":
      return amount * 12;
    case "ANNUAL":
      return amount;
    case "PER_BOOKING":
      // Server uses 100 bookings/year as default; mirror that here.
      return amount * 100;
    case "ONE_TIME":
      return 0;
    default:
      return amount;
  }
}

const INPUT_CLS =
  "mt-1.5 w-full rounded-md border border-brand-hairline bg-white px-3 py-2 text-sm text-brand-navy shadow-sm placeholder:text-brand-muted/60 focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block text-xs font-medium text-brand-muted">
      <span className="block uppercase tracking-wide">
        {label}
        {required ? <span className="text-rose-600"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

function emptyToNull(v: FormDataEntryValue | null): string | null {
  if (v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}
