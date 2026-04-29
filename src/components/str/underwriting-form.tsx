"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";

/**
 * Initial values for the underwriting form. All numeric values are passed in
 * as numbers (parent does the Decimal → number conversion). The form posts
 * the diff to PATCH /api/str-deals/[id] and triggers a router refresh so the
 * parent server component re-fetches with the new computed scenarios.
 */
export type UnderwritingInitial = {
  status: string;
  askingPrice: number | null;
  targetOfferPrice: number | null;
  beds: number | null;
  baths: number | null;
  sleeps: number | null;
  squareFootage: number | null;
  yearBuilt: number | null;

  purchasePrice: number;
  downPaymentPct: number;
  interestRate: number;
  loanTermYears: number;
  interestOnly: boolean;
  closingCosts: number;
  renovationBudget: number;
  furnitureBudget: number;
  initialReserves: number;

  conservativeRevenue: number | null;
  baseRevenue: number | null;
  aggressiveRevenue: number | null;
  adr: number | null;
  occupancyPct: number | null;
  cleaningFeesIncome: number | null;
  otherIncome: number | null;

  propertyTaxes: number | null;
  insurance: number | null;
  utilities: number | null;
  internet: number | null;
  repairsMaintenance: number | null;
  supplies: number | null;
  cleaningExpense: number | null;
  platformFeesPct: number | null;
  propertyMgmtPct: number | null;
  exteriorServices: number | null;
  hoa: number | null;
  accounting: number | null;
  miscExpense: number | null;

  revenueConfidence: number;
  compQualityRating: number;
  marketStrength: number;
  upgradeUpside: number;
  regulatoryRisk: number;
  maintenanceComplexity: number;
  financingRisk: number;

  targetCashOnCash: number;
  targetDscr: number;
};

const STATUS_OPTIONS = [
  "NEW",
  "RESEARCHING",
  "UNDERWRITING",
  "OFFER_MADE",
  "UNDER_CONTRACT",
  "PASSED",
  "ACQUIRED",
] as const;

export function UnderwritingForm({
  dealId,
  initial,
}: {
  dealId: string;
  initial: UnderwritingInitial;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    const fd = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = {
      status: fd.get("status"),
      askingPrice: numOrNull(fd.get("askingPrice")),
      targetOfferPrice: numOrNull(fd.get("targetOfferPrice")),
      beds: intOrNull(fd.get("beds")),
      baths: numOrNull(fd.get("baths")),
      sleeps: intOrNull(fd.get("sleeps")),
      squareFootage: intOrNull(fd.get("squareFootage")),
      yearBuilt: intOrNull(fd.get("yearBuilt")),

      purchasePrice: num(fd.get("purchasePrice")),
      downPaymentPct: pctToFraction(fd.get("downPaymentPct")),
      interestRate: pctToFraction(fd.get("interestRate")),
      loanTermYears: int(fd.get("loanTermYears")),
      interestOnly: fd.get("interestOnly") === "on",
      closingCosts: num(fd.get("closingCosts")),
      renovationBudget: num(fd.get("renovationBudget")),
      furnitureBudget: num(fd.get("furnitureBudget")),
      initialReserves: num(fd.get("initialReserves")),

      conservativeRevenue: numOrNull(fd.get("conservativeRevenue")),
      baseRevenue: numOrNull(fd.get("baseRevenue")),
      aggressiveRevenue: numOrNull(fd.get("aggressiveRevenue")),
      adr: numOrNull(fd.get("adr")),
      occupancyPct: pctToFractionOrNull(fd.get("occupancyPct")),
      cleaningFeesIncome: numOrNull(fd.get("cleaningFeesIncome")),
      otherIncome: numOrNull(fd.get("otherIncome")),

      propertyTaxes: numOrNull(fd.get("propertyTaxes")),
      insurance: numOrNull(fd.get("insurance")),
      utilities: numOrNull(fd.get("utilities")),
      internet: numOrNull(fd.get("internet")),
      repairsMaintenance: numOrNull(fd.get("repairsMaintenance")),
      supplies: numOrNull(fd.get("supplies")),
      cleaningExpense: numOrNull(fd.get("cleaningExpense")),
      platformFeesPct: pctToFractionOrNull(fd.get("platformFeesPct")),
      propertyMgmtPct: pctToFractionOrNull(fd.get("propertyMgmtPct")),
      exteriorServices: numOrNull(fd.get("exteriorServices")),
      hoa: numOrNull(fd.get("hoa")),
      accounting: numOrNull(fd.get("accounting")),
      miscExpense: numOrNull(fd.get("miscExpense")),

      revenueConfidence: int(fd.get("revenueConfidence")),
      compQualityRating: int(fd.get("compQualityRating")),
      marketStrength: int(fd.get("marketStrength")),
      upgradeUpside: int(fd.get("upgradeUpside")),
      regulatoryRisk: int(fd.get("regulatoryRisk")),
      maintenanceComplexity: int(fd.get("maintenanceComplexity")),
      financingRisk: int(fd.get("financingRisk")),

      targetCashOnCash: pctToFraction(fd.get("targetCashOnCash")),
      targetDscr: num(fd.get("targetDscr")),
    };

    try {
      const res = await fetch(`/api/str-deals/${dealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Save failed (${res.status})`);
      } else {
        setSavedAt(new Date());
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Section title="Status">
        <Field label="Status">
          <select
            name="status"
            defaultValue={initial.status}
            className={SELECT_CLS}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </Field>
        <NumberField
          label="Asking price"
          name="askingPrice"
          defaultValue={initial.askingPrice}
          step="1000"
        />
        <NumberField
          label="Target offer price"
          name="targetOfferPrice"
          defaultValue={initial.targetOfferPrice}
          step="1000"
        />
      </Section>

      <Section title="Property">
        <NumberField label="Beds" name="beds" defaultValue={initial.beds} step="1" />
        <NumberField label="Baths" name="baths" defaultValue={initial.baths} step="0.5" />
        <NumberField label="Sleeps" name="sleeps" defaultValue={initial.sleeps} step="1" />
        <NumberField
          label="Square footage"
          name="squareFootage"
          defaultValue={initial.squareFootage}
          step="50"
        />
        <NumberField
          label="Year built"
          name="yearBuilt"
          defaultValue={initial.yearBuilt}
          step="1"
        />
      </Section>

      <Section title="Acquisition costs">
        <NumberField
          label="Purchase price"
          name="purchasePrice"
          defaultValue={initial.purchasePrice}
          step="1000"
          required
        />
        <NumberField
          label="Down payment %"
          name="downPaymentPct"
          defaultValue={fractionToPct(initial.downPaymentPct)}
          step="0.5"
          suffix="%"
          required
        />
        <NumberField
          label="Interest rate"
          name="interestRate"
          defaultValue={fractionToPct(initial.interestRate)}
          step="0.05"
          suffix="%"
          required
        />
        <NumberField
          label="Loan term (yrs)"
          name="loanTermYears"
          defaultValue={initial.loanTermYears}
          step="1"
          required
        />
        <Field label="Interest-only">
          <label className="mt-1.5 inline-flex items-center gap-2 text-sm text-brand-navy">
            <input
              type="checkbox"
              name="interestOnly"
              defaultChecked={initial.interestOnly}
              className="h-4 w-4 rounded border-brand-hairline text-brand-blue focus:ring-brand-blue/30"
            />
            <span>Use interest-only payment</span>
          </label>
        </Field>
        <NumberField
          label="Closing costs"
          name="closingCosts"
          defaultValue={initial.closingCosts}
          step="100"
        />
        <NumberField
          label="Renovation budget"
          name="renovationBudget"
          defaultValue={initial.renovationBudget}
          step="500"
        />
        <NumberField
          label="Furniture budget"
          name="furnitureBudget"
          defaultValue={initial.furnitureBudget}
          step="500"
        />
        <NumberField
          label="Initial reserves"
          name="initialReserves"
          defaultValue={initial.initialReserves}
          step="500"
        />
      </Section>

      <Section title="Revenue assumptions (annual)">
        <NumberField
          label="Conservative revenue"
          name="conservativeRevenue"
          defaultValue={initial.conservativeRevenue}
          step="1000"
        />
        <NumberField
          label="Base revenue"
          name="baseRevenue"
          defaultValue={initial.baseRevenue}
          step="1000"
        />
        <NumberField
          label="Aggressive revenue"
          name="aggressiveRevenue"
          defaultValue={initial.aggressiveRevenue}
          step="1000"
        />
        <NumberField label="ADR" name="adr" defaultValue={initial.adr} step="5" />
        <NumberField
          label="Occupancy %"
          name="occupancyPct"
          defaultValue={fractionToPctOrNull(initial.occupancyPct)}
          step="1"
          suffix="%"
        />
        <NumberField
          label="Cleaning fees collected"
          name="cleaningFeesIncome"
          defaultValue={initial.cleaningFeesIncome}
          step="100"
        />
        <NumberField
          label="Other income"
          name="otherIncome"
          defaultValue={initial.otherIncome}
          step="100"
        />
      </Section>

      <Section title="Operating expenses (annual)">
        <NumberField
          label="Property taxes"
          name="propertyTaxes"
          defaultValue={initial.propertyTaxes}
          step="100"
        />
        <NumberField
          label="Insurance"
          name="insurance"
          defaultValue={initial.insurance}
          step="100"
        />
        <NumberField
          label="Utilities"
          name="utilities"
          defaultValue={initial.utilities}
          step="100"
        />
        <NumberField
          label="Internet"
          name="internet"
          defaultValue={initial.internet}
          step="50"
        />
        <NumberField
          label="Repairs / maintenance"
          name="repairsMaintenance"
          defaultValue={initial.repairsMaintenance}
          step="100"
        />
        <NumberField
          label="Supplies"
          name="supplies"
          defaultValue={initial.supplies}
          step="50"
        />
        <NumberField
          label="Cleaning expense"
          name="cleaningExpense"
          defaultValue={initial.cleaningExpense}
          step="100"
        />
        <NumberField
          label="Platform fees"
          name="platformFeesPct"
          defaultValue={fractionToPctOrNull(initial.platformFeesPct)}
          step="0.5"
          suffix="%"
        />
        <NumberField
          label="Property mgmt"
          name="propertyMgmtPct"
          defaultValue={fractionToPctOrNull(initial.propertyMgmtPct)}
          step="0.5"
          suffix="%"
        />
        <NumberField
          label="Lawn / snow / pool"
          name="exteriorServices"
          defaultValue={initial.exteriorServices}
          step="100"
        />
        <NumberField label="HOA" name="hoa" defaultValue={initial.hoa} step="50" />
        <NumberField
          label="Accounting"
          name="accounting"
          defaultValue={initial.accounting}
          step="100"
        />
        <NumberField
          label="Misc"
          name="miscExpense"
          defaultValue={initial.miscExpense}
          step="100"
        />
      </Section>

      <Section title="Underwriting targets">
        <NumberField
          label="Target cash-on-cash"
          name="targetCashOnCash"
          defaultValue={fractionToPct(initial.targetCashOnCash)}
          step="0.5"
          suffix="%"
        />
        <NumberField
          label="Target DSCR"
          name="targetDscr"
          defaultValue={initial.targetDscr}
          step="0.05"
        />
      </Section>

      <Section title="Score inputs (0–10)">
        <RatingField
          label="Revenue confidence"
          name="revenueConfidence"
          defaultValue={initial.revenueConfidence}
        />
        <RatingField
          label="Comp quality"
          name="compQualityRating"
          defaultValue={initial.compQualityRating}
        />
        <RatingField
          label="Market strength"
          name="marketStrength"
          defaultValue={initial.marketStrength}
        />
        <RatingField
          label="Upgrade upside"
          name="upgradeUpside"
          defaultValue={initial.upgradeUpside}
        />
        <RatingField
          label="Regulatory risk (lower = better)"
          name="regulatoryRisk"
          defaultValue={initial.regulatoryRisk}
        />
        <RatingField
          label="Maintenance complexity (lower = better)"
          name="maintenanceComplexity"
          defaultValue={initial.maintenanceComplexity}
        />
        <RatingField
          label="Financing risk (lower = better)"
          name="financingRisk"
          defaultValue={initial.financingRisk}
        />
      </Section>

      {error ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="sticky bottom-4 flex items-center justify-end gap-3 border-t border-brand-hairline bg-white/80 px-1 py-3 backdrop-blur">
        {savedAt ? (
          <span className="text-xs text-emerald-700">
            Saved {savedAt.toLocaleTimeString()}
          </span>
        ) : null}
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-brand-blue px-4 py-2 text-xs font-semibold text-white shadow-btn-primary transition hover:bg-brand-blue-dark disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save & recompute"}
        </button>
      </div>
    </form>
  );
}

const INPUT_CLS =
  "mt-1.5 w-full rounded-md border border-brand-hairline bg-white px-3 py-2 text-sm text-brand-navy shadow-sm placeholder:text-brand-muted/60 focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20";
const SELECT_CLS = INPUT_CLS;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-muted">
        {title}
      </legend>
      <div className="mt-3 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{children}</div>
    </fieldset>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-xs font-medium text-brand-muted">
      <span className="block uppercase tracking-wide">{label}</span>
      {children}
    </label>
  );
}

function NumberField({
  label,
  name,
  defaultValue,
  step,
  suffix,
  required,
}: {
  label: string;
  name: string;
  defaultValue: number | null;
  step?: string;
  suffix?: string;
  required?: boolean;
}) {
  return (
    <Field label={label}>
      <div className="relative">
        <input
          name={name}
          type="number"
          inputMode="decimal"
          required={required}
          step={step}
          defaultValue={defaultValue === null || !Number.isFinite(defaultValue) ? "" : String(defaultValue)}
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

function RatingField({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue: number;
}) {
  return (
    <Field label={label}>
      <input
        type="range"
        name={name}
        min={0}
        max={10}
        step={1}
        defaultValue={defaultValue}
        className="mt-2 w-full accent-brand-blue"
      />
    </Field>
  );
}

function num(v: FormDataEntryValue | null): number {
  if (v === null) return 0;
  const n = Number(String(v).trim());
  return Number.isFinite(n) ? n : 0;
}
function int(v: FormDataEntryValue | null): number {
  return Math.round(num(v));
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
function pctToFraction(v: FormDataEntryValue | null): number {
  return num(v) / 100;
}
function pctToFractionOrNull(v: FormDataEntryValue | null): number | null {
  const n = numOrNull(v);
  return n === null ? null : n / 100;
}
function fractionToPct(n: number): number {
  return n * 100;
}
function fractionToPctOrNull(n: number | null): number | null {
  return n === null ? null : n * 100;
}
