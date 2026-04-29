"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";

export type CompRow = {
  id: string;
  name: string;
  listingUrl: string | null;
  distanceMiles: number | null;
  beds: number | null;
  baths: number | null;
  sleeps: number | null;
  adr: number | null;
  occupancyPct: number | null;
  annualRevenue: number | null;
  reviewCount: number | null;
  rating: number | null;
  hasHotTub: boolean;
  hasSauna: boolean;
  hasPool: boolean;
  hasGameRoom: boolean;
  hasFirepit: boolean;
  hasViews: boolean;
  hasWaterfront: boolean;
  hasSkiAccess: boolean;
  notes: string | null;
  qualityScore: number | null;
  source: string;
};

const AMENITY_KEYS = [
  ["hasHotTub", "Hot tub"],
  ["hasSauna", "Sauna"],
  ["hasPool", "Pool"],
  ["hasGameRoom", "Game room"],
  ["hasFirepit", "Firepit"],
  ["hasViews", "Views"],
  ["hasWaterfront", "Waterfront"],
  ["hasSkiAccess", "Ski access"],
] as const;

export function CompsPanel({
  dealId,
  comps,
}: {
  dealId: string;
  comps: CompRow[];
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
    const payload: Record<string, unknown> = {
      name: String(fd.get("name") ?? "").trim(),
      listingUrl: emptyToNull(fd.get("listingUrl")),
      distanceMiles: numOrNull(fd.get("distanceMiles")),
      beds: intOrNull(fd.get("beds")),
      baths: numOrNull(fd.get("baths")),
      sleeps: intOrNull(fd.get("sleeps")),
      adr: numOrNull(fd.get("adr")),
      occupancyPct: pctToFractionOrNull(fd.get("occupancyPct")),
      annualRevenue: numOrNull(fd.get("annualRevenue")),
      reviewCount: intOrNull(fd.get("reviewCount")),
      rating: numOrNull(fd.get("rating")),
      qualityScore: intOrNull(fd.get("qualityScore")),
      notes: emptyToNull(fd.get("notes")),
    };
    for (const [key] of AMENITY_KEYS) {
      payload[key] = fd.get(key) === "on";
    }

    if (!payload.name) {
      setError("Comp name is required.");
      setBusy(false);
      return;
    }

    try {
      const res = await fetch(`/api/str-deals/${dealId}/comps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Save failed (${res.status})`);
      } else {
        setShowForm(false);
        e.currentTarget.reset();
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(compId: string) {
    if (!confirm("Delete this comp?")) return;
    const res = await fetch(`/api/str-deals/${dealId}/comps/${compId}`, {
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
          {comps.length} comp{comps.length === 1 ? "" : "s"}. Manual entry for
          now — BNB Calc, AirDNA, and Google Maps integrations land later.
        </p>
        <button
          type="button"
          onClick={() => {
            setShowForm((s) => !s);
            setError(null);
          }}
          className="rounded-md bg-brand-blue px-3 py-1.5 text-xs font-semibold text-white shadow-btn-primary transition hover:bg-brand-blue-dark"
        >
          {showForm ? "Cancel" : "+ Add comp"}
        </button>
      </div>

      {showForm ? (
        <form
          onSubmit={handleAdd}
          className="space-y-4 rounded-2xl border border-brand-hairline/60 bg-white p-5 shadow-card"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Name" required>
              <input
                name="name"
                required
                placeholder="e.g. Cozy Cabin on Bear Ridge"
                className={INPUT_CLS}
              />
            </Field>
            <Field label="Airbnb / VRBO URL">
              <input
                name="listingUrl"
                type="url"
                placeholder="https://..."
                className={INPUT_CLS}
              />
            </Field>
          </div>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
            <NumField label="Distance (mi)" name="distanceMiles" step="0.1" />
            <NumField label="Beds" name="beds" step="1" />
            <NumField label="Baths" name="baths" step="0.5" />
            <NumField label="Sleeps" name="sleeps" step="1" />
            <NumField label="ADR" name="adr" step="5" />
            <NumField label="Occupancy %" name="occupancyPct" step="1" suffix="%" />
          </div>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
            <NumField label="Annual revenue" name="annualRevenue" step="1000" />
            <NumField label="Review count" name="reviewCount" step="1" />
            <NumField label="Rating (0–5)" name="rating" step="0.1" />
            <NumField label="Quality score (1–10)" name="qualityScore" step="1" />
          </div>
          <Field label="Amenities">
            <div className="mt-1.5 grid gap-2 md:grid-cols-4">
              {AMENITY_KEYS.map(([key, label]) => (
                <label
                  key={key}
                  className="inline-flex items-center gap-2 text-sm text-brand-navy"
                >
                  <input
                    type="checkbox"
                    name={key}
                    className="h-4 w-4 rounded border-brand-hairline text-brand-blue focus:ring-brand-blue/30"
                  />
                  {label}
                </label>
              ))}
            </div>
          </Field>
          <Field label="Notes">
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
              {busy ? "Saving…" : "Add comp"}
            </button>
          </div>
        </form>
      ) : null}

      {comps.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-brand-hairline bg-white px-5 py-8 text-center text-sm text-brand-muted">
          No comps yet. Add one to support the revenue assumptions.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-brand-hairline/60 bg-white shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/60 text-[11px] uppercase tracking-wide text-brand-muted">
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold">Name</th>
                <th className="px-4 py-2.5 text-right font-semibold">Dist</th>
                <th className="px-4 py-2.5 text-right font-semibold">BR/BA/Sl</th>
                <th className="px-4 py-2.5 text-right font-semibold">ADR</th>
                <th className="px-4 py-2.5 text-right font-semibold">Occ</th>
                <th className="px-4 py-2.5 text-right font-semibold">Rev</th>
                <th className="px-4 py-2.5 text-right font-semibold">Rating</th>
                <th className="px-4 py-2.5 text-right font-semibold">Quality</th>
                <th className="px-4 py-2.5 text-left font-semibold">Amenities</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-hairline/70">
              {comps.map((c) => (
                <tr key={c.id} className="hover:bg-brand-blue-tint/30">
                  <td className="px-4 py-2.5">
                    {c.listingUrl ? (
                      <a
                        href={c.listingUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-brand-navy hover:text-brand-blue"
                      >
                        {c.name} ↗
                      </a>
                    ) : (
                      <span className="font-medium text-brand-navy">{c.name}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {c.distanceMiles === null ? "—" : `${c.distanceMiles}mi`}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {c.beds ?? "—"}/{c.baths ?? "—"}/{c.sleeps ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {c.adr === null ? "—" : `$${c.adr.toFixed(0)}`}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {c.occupancyPct === null
                      ? "—"
                      : `${(c.occupancyPct * 100).toFixed(0)}%`}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {c.annualRevenue === null
                      ? "—"
                      : `$${(c.annualRevenue / 1000).toFixed(0)}k`}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {c.rating === null ? "—" : c.rating.toFixed(1)}
                    {c.reviewCount !== null ? (
                      <span className="ml-1 text-xs text-brand-muted">
                        ({c.reviewCount})
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {c.qualityScore ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-brand-muted">
                    {summarizeAmenities(c) || "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => handleDelete(c.id)}
                      className="text-xs font-medium text-rose-600 hover:text-rose-800"
                    >
                      Delete
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

function summarizeAmenities(c: CompRow): string {
  return AMENITY_KEYS
    .filter(([key]) => c[key as keyof CompRow])
    .map(([, label]) => label)
    .join(" · ");
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

function NumField({
  label,
  name,
  step,
  suffix,
}: {
  label: string;
  name: string;
  step?: string;
  suffix?: string;
}) {
  return (
    <Field label={label}>
      <div className="relative">
        <input
          name={name}
          type="number"
          step={step}
          inputMode="decimal"
          className={`${INPUT_CLS} ${suffix ? "pr-8" : ""}`}
        />
        {suffix ? (
          <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-brand-muted">
            {suffix}
          </span>
        ) : null}
      </div>
    </Field>
  );
}

function emptyToNull(v: FormDataEntryValue | null): string | null {
  if (v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}
function numOrNull(v: FormDataEntryValue | null): number | null {
  if (v === null) return null;
  const s = String(v).trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
function intOrNull(v: FormDataEntryValue | null): number | null {
  const n = numOrNull(v);
  return n === null ? null : Math.round(n);
}
function pctToFractionOrNull(v: FormDataEntryValue | null): number | null {
  const n = numOrNull(v);
  return n === null ? null : n / 100;
}
