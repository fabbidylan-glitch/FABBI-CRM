"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

/**
 * Minimal "create a deal" form. Captures only the bare essentials so a user
 * can start a deal in one screen — everything else (acquisition costs,
 * revenue, expenses) is edited on the detail page.
 *
 * Submits to POST /api/str-deals and routes to the new deal's detail page.
 */
export function NewDealForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    const fd = new FormData(e.currentTarget);
    const payload = {
      dealName: String(fd.get("dealName") ?? "").trim(),
      propertyAddress: emptyToNull(fd.get("propertyAddress")),
      listingUrl: emptyToNull(fd.get("listingUrl")),
      city: emptyToNull(fd.get("city")),
      state: emptyToNull(fd.get("state")),
      market: emptyToNull(fd.get("market")),
      askingPrice: emptyToNull(fd.get("askingPrice")),
      purchasePrice: numericOrZero(fd.get("purchasePrice")),
    };

    if (!payload.dealName) {
      setError("Deal name is required.");
      setBusy(false);
      return;
    }

    try {
      const res = await fetch("/api/str-deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Save failed (${res.status})`);
        setBusy(false);
        return;
      }
      const body = (await res.json()) as { id: string };
      router.push(`/str-deals/${body.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Field
        label="Deal name"
        name="dealName"
        required
        placeholder="e.g. Smoky Mountain Cabin"
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label="Property address"
          name="propertyAddress"
          placeholder="123 Mountain Rd"
        />
        <Field
          label="Zillow / MLS URL"
          name="listingUrl"
          type="url"
          placeholder="https://..."
        />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="City" name="city" />
        <Field label="State" name="state" placeholder="TN" />
        <Field label="Market" name="market" placeholder="Gatlinburg" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label="Asking price"
          name="askingPrice"
          type="number"
          step="1000"
          min="0"
          placeholder="Optional"
        />
        <Field
          label="Purchase price (assumed)"
          name="purchasePrice"
          type="number"
          step="1000"
          min="0"
          required
          defaultValue="0"
        />
      </div>

      {error ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-2 border-t border-brand-hairline pt-4">
        <a
          href="/str-deals"
          className="rounded-md border border-brand-hairline bg-white px-3 py-1.5 text-xs font-medium text-brand-navy transition hover:bg-brand-blue-tint"
        >
          Cancel
        </a>
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-brand-blue px-3 py-1.5 text-xs font-semibold text-white shadow-btn-primary transition hover:bg-brand-blue-dark disabled:opacity-60"
        >
          {busy ? "Saving…" : "Create deal"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  required,
  type = "text",
  placeholder,
  step,
  min,
  defaultValue,
}: {
  label: string;
  name: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
  step?: string;
  min?: string;
  defaultValue?: string;
}) {
  return (
    <label className="block text-xs font-medium text-brand-muted">
      <span className="block uppercase tracking-wide">
        {label}
        {required ? <span className="text-rose-600"> *</span> : null}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        step={step}
        min={min}
        defaultValue={defaultValue}
        className="mt-1.5 w-full rounded-md border border-brand-hairline bg-white px-3 py-2 text-sm text-brand-navy shadow-sm placeholder:text-brand-muted/60 focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
      />
    </label>
  );
}

function emptyToNull(v: FormDataEntryValue | null): string | null {
  if (v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function numericOrZero(v: FormDataEntryValue | null): number {
  if (v === null) return 0;
  const n = Number(String(v).trim());
  return Number.isFinite(n) ? n : 0;
}
