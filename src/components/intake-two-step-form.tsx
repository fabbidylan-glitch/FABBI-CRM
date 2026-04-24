"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

/*
 * Two-step public intake form.
 * - Step 1: 5 low-friction fields (name, email, phone, revenue, service interest)
 * - Step 2: qualification fields (business type, properties, states, taxes,
 *           frustration, notes)
 *
 * UTMs and marketing-site attribution (source, page, campaign, utm_*) are read
 * from window.location.search on mount and passed through to /api/public/lead,
 * which the intake pipeline already persists to the Lead record.
 */

type ServiceInterestUi =
  | "BOOKKEEPING"
  | "TAX_STRATEGY"
  | "TAX_PREP"
  | "CFO"
  | "COST_SEG";

const SERVICE_INTEREST_OPTIONS: { value: ServiceInterestUi; label: string }[] = [
  { value: "BOOKKEEPING", label: "Bookkeeping" },
  { value: "TAX_STRATEGY", label: "Tax Planning" },
  { value: "TAX_PREP", label: "Tax Preparation" },
  { value: "CFO", label: "Fractional CFO" },
  { value: "COST_SEG", label: "Cost Segregation" },
];

const REVENUE_OPTIONS = [
  { value: "UNDER_250K", label: "Under $250K" },
  { value: "FROM_250K_TO_500K", label: "$250K–$500K" },
  { value: "FROM_500K_TO_1M", label: "$500K–$1M" },
  { value: "OVER_1M", label: "$1M+" },
] as const;

// Business type → maps to Prisma `niche` enum.
const BUSINESS_TYPE_OPTIONS = [
  { value: "STR_OWNER", label: "Short-term rentals / Airbnb" },
  { value: "REAL_ESTATE_INVESTOR", label: "Real estate investor" },
  { value: "E_COMMERCE", label: "E-commerce / online store" },
  { value: "GENERAL_SMB", label: "Service business / agency" },
  { value: "OTHER", label: "Something else" },
] as const;

const TAXES_PAID_OPTIONS = [
  { value: "UNKNOWN", label: "Not sure" },
  { value: "UNDER_10K", label: "Under $10K" },
  { value: "FROM_10K_TO_25K", label: "$10K–$25K" },
  { value: "FROM_25K_TO_50K", label: "$25K–$50K" },
  { value: "FROM_50K_TO_100K", label: "$50K–$100K" },
  { value: "OVER_100K", label: "Over $100K" },
] as const;

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  annualRevenueRange: string;
  serviceInterestUi: ServiceInterestUi | "";
  niche: string;
  propertyCount: string;
  statesOfOperation: string;
  taxesPaidLastYearRange: string;
  painPoint: string;
  notes: string;
  website_hp: string; // honeypot
};

const initialState: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  annualRevenueRange: "",
  serviceInterestUi: "",
  niche: "",
  propertyCount: "UNKNOWN",
  statesOfOperation: "",
  taxesPaidLastYearRange: "UNKNOWN",
  painPoint: "",
  notes: "",
  website_hp: "",
};

type Attribution = {
  source: string;
  page: string;
  campaign: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_term: string;
  utm_content: string;
};

const EMPTY_ATTRIBUTION: Attribution = {
  source: "",
  page: "",
  campaign: "",
  utm_source: "",
  utm_medium: "",
  utm_campaign: "",
  utm_term: "",
  utm_content: "",
};

// Map our UI source param ("website", "landing_page") to the Prisma enum.
function mapSource(raw: string): string {
  const normalized = raw.toLowerCase();
  if (normalized === "website") return "WEBSITE";
  if (normalized === "landing_page" || normalized === "landing-page") return "LANDING_PAGE";
  if (normalized === "google_ads" || normalized === "google-ads") return "GOOGLE_ADS";
  if (normalized === "meta_ads" || normalized === "meta-ads") return "META_ADS";
  return "WEBSITE";
}

function requiredStep1(state: FormState): string | null {
  if (!state.firstName.trim()) return "First name is required.";
  if (!state.email.trim()) return "Email is required.";
  if (!/^\S+@\S+\.\S+$/.test(state.email.trim())) return "Enter a valid email.";
  if (!state.phone.trim()) return "Phone is required.";
  if (!state.annualRevenueRange) return "Select a revenue range.";
  if (!state.serviceInterestUi) return "Select a service interest.";
  return null;
}

export function IntakeTwoStepForm() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<FormState>(initialState);
  const [attribution, setAttribution] = useState<Attribution>(EMPTY_ATTRIBUTION);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    setAttribution({
      source: sp.get("source") ?? "",
      page: sp.get("page") ?? "",
      campaign: sp.get("campaign") ?? "",
      utm_source: sp.get("utm_source") ?? "",
      utm_medium: sp.get("utm_medium") ?? "",
      utm_campaign: sp.get("utm_campaign") ?? "",
      utm_term: sp.get("utm_term") ?? "",
      utm_content: sp.get("utm_content") ?? "",
    });
  }, []);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleContinue(e: React.FormEvent) {
    e.preventDefault();
    const err = requiredStep1(form);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setStep(2);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function handleBack() {
    setError(null);
    setStep(1);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    // Map our UI service interest (with COST_SEG) onto the Prisma enum. If the
    // prospect selected Cost Segregation, we flag it via costSegInterest and
    // route serviceInterest to TAX_STRATEGY (closest primary service).
    const costSegInterest = form.serviceInterestUi === "COST_SEG";
    const serviceInterest =
      form.serviceInterestUi === "COST_SEG" ? "TAX_STRATEGY" : form.serviceInterestUi;

    // Preserve the landing page attribution alongside the user's notes so the
    // sales team sees where the click originated. utm_* and source are stored
    // in their own columns by the intake pipeline.
    const attributionLine = attribution.page
      ? `[Landing page: ${attribution.page}]`
      : null;
    const userNotes = form.notes.trim();
    const notes = [attributionLine, userNotes].filter(Boolean).join("\n\n");

    const payload = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim() || "—",
      email: form.email.trim(),
      phone: form.phone.trim(),

      source: mapSource(attribution.source || "website"),
      campaignName: attribution.campaign || attribution.utm_campaign || undefined,

      niche: form.niche || "UNKNOWN",
      serviceInterest: serviceInterest || "UNSURE",
      annualRevenueRange: form.annualRevenueRange || "UNKNOWN",
      taxesPaidLastYearRange: form.taxesPaidLastYearRange || "UNKNOWN",
      propertyCount: form.propertyCount || "UNKNOWN",
      statesOfOperation: form.statesOfOperation
        .split(/[,\s]+/)
        .map((s) => s.trim().toUpperCase())
        .filter((s) => s.length === 2),
      costSegInterest,
      painPoint: form.painPoint.trim() || undefined,
      notes: notes || undefined,

      utmSource: attribution.utm_source || undefined,
      utmMedium: attribution.utm_medium || undefined,
      utmCampaign: attribution.utm_campaign || undefined,
      utmTerm: attribution.utm_term || undefined,
      utmContent: attribution.utm_content || undefined,

      website_hp: form.website_hp,
    };

    try {
      const res = await fetch("/api/public/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        issues?: { path: string; message: string }[];
      };
      if (!res.ok) {
        setSubmitting(false);
        setError(
          data.issues
            ? data.issues.map((i) => `${i.path}: ${i.message}`).join(", ")
            : data.error ?? "Submission failed. Please try again."
        );
        return;
      }
      // Success — off to the confirmation page.
      router.push("/intake/thanks");
    } catch {
      setSubmitting(false);
      setError("Network error. Please try again.");
    }
  }

  const propertyQuestionVisible = useMemo(
    () =>
      form.niche === "STR_OWNER" ||
      form.niche === "REAL_ESTATE_INVESTOR" ||
      form.niche === "AIRBNB_VRBO_OPERATOR",
    [form.niche]
  );

  return (
    <div className="rounded-2xl border border-brand-hairline bg-white p-7 shadow-card sm:p-9">
      <StepIndicator step={step} />

      {step === 1 ? (
        <form onSubmit={handleContinue} className="mt-6 space-y-5" noValidate>
          <Field label="First name" required>
            <input
              type="text"
              name="firstName"
              autoComplete="given-name"
              value={form.firstName}
              onChange={(e) => update("firstName", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Last name">
            <input
              type="text"
              name="lastName"
              autoComplete="family-name"
              value={form.lastName}
              onChange={(e) => update("lastName", e.target.value)}
              className={inputCls}
            />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Email" required>
              <input
                type="email"
                name="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Phone" required>
              <input
                type="tel"
                name="phone"
                autoComplete="tel"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
                placeholder="929-555-0100"
                className={inputCls}
              />
            </Field>
          </div>
          <Field label="Annual revenue" required>
            <select
              value={form.annualRevenueRange}
              onChange={(e) => update("annualRevenueRange", e.target.value)}
              className={inputCls}
            >
              <option value="">Select a range…</option>
              {REVENUE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Service interest" required>
            <div className="grid gap-2 sm:grid-cols-2">
              {SERVICE_INTEREST_OPTIONS.map((o) => (
                <label
                  key={o.value}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition ${
                    form.serviceInterestUi === o.value
                      ? "border-brand-navy bg-brand-blue-tint text-brand-navy"
                      : "border-brand-hairline bg-white text-brand-navy/90 hover:border-brand-navy/40"
                  }`}
                >
                  <input
                    type="radio"
                    name="serviceInterest"
                    value={o.value}
                    checked={form.serviceInterestUi === o.value}
                    onChange={() => update("serviceInterestUi", o.value)}
                    className="h-4 w-4 accent-brand-navy"
                  />
                  <span>{o.label}</span>
                </label>
              ))}
            </div>
          </Field>

          {/* Honeypot */}
          <input
            type="text"
            name="website_hp"
            value={form.website_hp}
            onChange={(e) => update("website_hp", e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="hidden"
          />

          {error && <ErrorMessage>{error}</ErrorMessage>}

          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-brand-muted">
              Takes about 2 minutes. Step 2 has the qualification questions.
            </p>
            <button type="submit" className={primaryBtnCls}>
              Continue →
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-5" noValidate>
          <Field label="Business type" required>
            <select
              value={form.niche}
              onChange={(e) => update("niche", e.target.value)}
              className={inputCls}
            >
              <option value="">Select one…</option>
              {BUSINESS_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>

          {propertyQuestionVisible && (
            <Field label="How many properties do you operate?">
              <select
                value={form.propertyCount}
                onChange={(e) => update("propertyCount", e.target.value)}
                className={inputCls}
              >
                <option value="UNKNOWN">Not sure yet</option>
                <option value="NONE">Zero (planning to acquire)</option>
                <option value="ONE">1</option>
                <option value="TWO_TO_FOUR">2–4</option>
                <option value="FIVE_TO_NINE">5–9</option>
                <option value="TEN_PLUS">10+</option>
              </select>
            </Field>
          )}

          <Field label="States of operation">
            <input
              type="text"
              value={form.statesOfOperation}
              onChange={(e) => update("statesOfOperation", e.target.value)}
              placeholder="e.g. NY, NJ, FL"
              className={inputCls}
            />
            <p className="mt-1 text-xs text-brand-muted">
              Two-letter state codes, comma separated.
            </p>
          </Field>

          <Field label="Approximate taxes paid last year">
            <select
              value={form.taxesPaidLastYearRange}
              onChange={(e) => update("taxesPaidLastYearRange", e.target.value)}
              className={inputCls}
            >
              {TAXES_PAID_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Biggest frustration with your current accountant">
            <textarea
              value={form.painPoint}
              onChange={(e) => update("painPoint", e.target.value)}
              rows={3}
              className={inputCls}
              placeholder="What's broken about your current setup?"
            />
          </Field>

          <Field label="Anything else we should know?">
            <textarea
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              rows={3}
              className={inputCls}
            />
          </Field>

          {error && <ErrorMessage>{error}</ErrorMessage>}

          <p className="text-sm text-brand-muted">
            You&rsquo;ll get a response within 1 business day. No spam. No
            obligation.
          </p>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={handleBack}
              className="text-sm font-semibold text-brand-muted transition hover:text-brand-navy"
              disabled={submitting}
            >
              ← Back
            </button>
            <button
              type="submit"
              className={primaryBtnCls}
              disabled={submitting}
            >
              {submitting ? "Submitting…" : "Get My Custom Plan"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function StepIndicator({ step }: { step: 1 | 2 }) {
  return (
    <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-brand-muted">
      <span className={step === 1 ? "text-brand-navy" : undefined}>
        Step {step} of 2
      </span>
      <span aria-hidden className="flex flex-1 gap-1">
        <span
          className={`h-1 flex-1 rounded-full ${
            step >= 1 ? "bg-brand-navy" : "bg-brand-hairline"
          }`}
        />
        <span
          className={`h-1 flex-1 rounded-full ${
            step >= 2 ? "bg-brand-navy" : "bg-brand-hairline"
          }`}
        />
      </span>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-brand-navy">
        {label}
        {required && <span className="ml-0.5 text-brand-blue">*</span>}
      </span>
      {children}
    </label>
  );
}

function ErrorMessage({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
    >
      {children}
    </p>
  );
}

const inputCls =
  "block w-full rounded-lg border border-brand-hairline bg-white px-3.5 py-2.5 text-[15px] text-brand-navy shadow-sm transition placeholder:text-brand-muted/70 focus:border-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/15";

const primaryBtnCls =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-brand-navy px-6 py-3 text-sm font-semibold tracking-tight text-white shadow-sm transition hover:bg-brand-ink disabled:cursor-not-allowed disabled:opacity-60";
