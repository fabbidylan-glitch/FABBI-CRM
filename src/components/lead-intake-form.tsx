"use client";

import Script from "next/script";
import { useState } from "react";

type Stage = "idle" | "submitting" | "success" | "error";
export type IntakeVariant = "str" | "ecom" | "general";

export function LeadIntakeForm({
  calendlyUrl,
  variant = "general",
}: {
  calendlyUrl?: string;
  variant?: IntakeVariant;
}) {
  const [stage, setStage] = useState<Stage>("idle");
  const [message, setMessage] = useState<string | null>(null);
  // Values we just submitted — used to pre-fill the Calendly URL on success.
  const [submitted, setSubmitted] = useState<{
    firstName: string;
    lastName: string;
    email: string;
  } | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStage("submitting");
    setMessage(null);

    const formEl = e.currentTarget;
    const fd = new FormData(formEl);
    const statesRaw = String(fd.get("statesOfOperation") ?? "");
    // E-commerce form sends sales channels as repeated checkboxes; STR form
    // sends none. `getAll` returns [] when nothing is checked.
    const salesChannels = fd.getAll("salesChannels").map(String).filter(Boolean);
    const costSegRaw = String(fd.get("costSegInterest") ?? "");
    const costSegInterest =
      costSegRaw === "YES" ? true : costSegRaw === "NO" ? false : undefined;

    const payload = {
      firstName: fd.get("firstName"),
      lastName: fd.get("lastName"),
      email: fd.get("email"),
      phone: fd.get("phone") || "",
      companyName: fd.get("companyName") || "",
      websiteUrl: fd.get("websiteUrl") || "",
      source: fd.get("source") || "LANDING_PAGE",
      niche: fd.get("niche") || "UNKNOWN",
      serviceInterest: fd.get("serviceInterest") || "UNSURE",
      annualRevenueRange: fd.get("annualRevenueRange") || "UNKNOWN",
      taxesPaidLastYearRange: fd.get("taxesPaidLastYearRange") || "UNKNOWN",
      propertyCount: fd.get("propertyCount") || "UNKNOWN",
      urgency: fd.get("urgency") || "UNKNOWN",
      statesOfOperation: statesRaw
        .split(/[,\s]+/)
        .map((s) => s.trim().toUpperCase())
        .filter((s) => s.length === 2),
      w2IncomeFlag: fd.get("w2IncomeFlag") === "on",
      payrollFlag: fd.get("payrollFlag") === "on",
      otherBusinessIncomeFlag: fd.get("otherBusinessIncomeFlag") === "on",
      salesChannels,
      monthlyAdSpendRange: fd.get("monthlyAdSpendRange") || undefined,
      booksStatus: fd.get("booksStatus") || undefined,
      costSegInterest,
      painPoint: fd.get("painPoint") || "",
      website_hp: fd.get("website_hp") || "",
    };

    try {
      const res = await fetch("/api/public/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setStage("error");
        setMessage(
          data?.issues
            ? data.issues.map((i: { path: string; message: string }) => `${i.path}: ${i.message}`).join("\n")
            : data?.error ?? "Submission failed"
        );
        return;
      }
      void data;
      setSubmitted({
        firstName: String(payload.firstName ?? ""),
        lastName: String(payload.lastName ?? ""),
        email: String(payload.email ?? ""),
      });
      setStage("success");
      formEl.reset();
    } catch {
      setStage("error");
      setMessage("Network error. Try again.");
    }
  }

  if (stage === "success") {
    // Build a Calendly URL with `name` + `email` pre-filled so the prospect
    // doesn't have to retype. Calendly's prefill params are stable public API.
    const prefillUrl = calendlyUrl
      ? (() => {
          const url = new URL(calendlyUrl);
          if (submitted?.firstName || submitted?.lastName) {
            url.searchParams.set(
              "name",
              `${submitted.firstName ?? ""} ${submitted.lastName ?? ""}`.trim()
            );
          }
          if (submitted?.email) url.searchParams.set("email", submitted.email);
          return url.toString();
        })()
      : null;

    return (
      <div className="rounded-xl border border-brand-hairline bg-white p-8 shadow-card">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand-mint px-3 py-1 text-xs font-semibold text-brand-navy">
          Received
        </div>
        <h3 className="text-xl font-semibold text-brand-navy">
          Thanks{submitted?.firstName ? `, ${submitted.firstName}` : ""} — we&rsquo;ve got it.
        </h3>
        <p className="mt-2 text-sm text-brand-navy">
          A confirmation email is on its way to your inbox.
        </p>

        {prefillUrl ? (
          <div className="mt-6">
            <h4 className="text-base font-semibold text-brand-navy">
              Next step: book your consultation
            </h4>
            <p className="mt-1 text-sm text-brand-muted">
              Pick a 20-minute slot below — your name and email are already filled
              in, just confirm a time.
            </p>
            <Script
              src="https://assets.calendly.com/assets/external/widget.js"
              strategy="lazyOnload"
            />
            <div
              className="calendly-inline-widget mt-4 overflow-hidden rounded-xl border border-brand-hairline bg-white"
              data-url={prefillUrl}
              style={{ minWidth: 320, height: 700 }}
            />
            <p className="mt-2 text-center text-xs text-brand-muted">
              Calendar not loading?{" "}
              <a
                href={prefillUrl}
                target="_blank"
                rel="noreferrer"
                className="text-brand-blue hover:underline"
              >
                Open in a new tab
              </a>
              .
            </p>
          </div>
        ) : null}

        <p className="mt-5 text-xs text-brand-muted">
          Didn&rsquo;t get the email? Check your spam folder — if it&rsquo;s still
          missing after a few minutes, write to{" "}
          <a
            href="mailto:dylan@fabbi.co"
            className="text-brand-blue hover:underline"
          >
            dylan@fabbi.co
          </a>
          .
        </p>
      </div>
    );
  }

  const isStr = variant === "str";
  const isEcom = variant === "ecom";
  const defaultNiche = isStr ? "STR_OWNER" : isEcom ? "E_COMMERCE" : "UNKNOWN";
  const statesLabel = isEcom
    ? "States with sales tax nexus (comma or space separated)"
    : "States of operation (comma or space separated)";
  const painPointLabel = isStr
    ? "What's the most important thing for us to solve for your portfolio?"
    : isEcom
      ? "What's the biggest issue in your books or tax setup right now?"
      : "What's the most important thing for us to solve?";

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-xl border border-brand-hairline bg-white p-6 shadow-card"
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="First name" required>
          <input name="firstName" required className={inputCls} />
        </Field>
        <Field label="Last name" required>
          <input name="lastName" required className={inputCls} />
        </Field>
        <Field label="Email" required>
          <input name="email" type="email" required className={inputCls} />
        </Field>
        <Field label="Phone">
          <input name="phone" type="tel" className={inputCls} placeholder="+1 555 123 4567" />
        </Field>
        <Field label="Company">
          <input name="companyName" className={inputCls} />
        </Field>
        <Field label="Website">
          <input name="websiteUrl" type="url" className={inputCls} placeholder="https://" />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Niche">
          <select name="niche" className={inputCls} defaultValue={defaultNiche}>
            {isStr ? (
              <>
                <option value="STR_OWNER">Short-term rental owner</option>
                <option value="AIRBNB_VRBO_OPERATOR">Airbnb / VRBO operator</option>
                <option value="REAL_ESTATE_INVESTOR">Real estate investor</option>
                <option value="HIGH_INCOME_STR_STRATEGY">High-income + STR strategy</option>
              </>
            ) : isEcom ? (
              <option value="E_COMMERCE">E-commerce / dropshipping</option>
            ) : (
              <>
                <option value="STR_OWNER">Short-term rental owner</option>
                <option value="AIRBNB_VRBO_OPERATOR">Airbnb / VRBO operator</option>
                <option value="REAL_ESTATE_INVESTOR">Real estate investor</option>
                <option value="HIGH_INCOME_STR_STRATEGY">High-income + STR strategy</option>
                <option value="E_COMMERCE">E-commerce / dropshipping</option>
                <option value="MULTI_SERVICE_CLIENT">Multi-service client</option>
                <option value="GENERAL_SMB">General SMB</option>
                <option value="OTHER">Other</option>
              </>
            )}
          </select>
        </Field>
        <Field label="Service interest">
          <select name="serviceInterest" className={inputCls} defaultValue="UNSURE">
            <option value="TAX_PREP">Tax prep only</option>
            <option value="BOOKKEEPING">Bookkeeping</option>
            <option value="TAX_STRATEGY">Tax strategy</option>
            <option value="BOOKKEEPING_AND_TAX">Bookkeeping + tax</option>
            <option value="CFO">CFO</option>
            <option value="FULL_SERVICE">Full-service</option>
            <option value="UNSURE">Unsure</option>
          </select>
        </Field>
        <Field label="Annual revenue">
          <select name="annualRevenueRange" className={inputCls} defaultValue="UNKNOWN">
            <option value="UNDER_250K">Under $250k</option>
            <option value="FROM_250K_TO_500K">$250k – $500k</option>
            <option value="FROM_500K_TO_1M">$500k – $1M</option>
            <option value="OVER_1M">$1M+</option>
            <option value="UNKNOWN">Prefer not to say</option>
          </select>
        </Field>
        <Field label="Taxes paid last year">
          <select name="taxesPaidLastYearRange" className={inputCls} defaultValue="UNKNOWN">
            <option value="UNDER_10K">Under $10k</option>
            <option value="FROM_10K_TO_25K">$10k – $25k</option>
            <option value="FROM_25K_TO_50K">$25k – $50k</option>
            <option value="FROM_50K_TO_100K">$50k – $100k</option>
            <option value="OVER_100K">$100k+</option>
            <option value="UNKNOWN">Prefer not to say</option>
          </select>
        </Field>

        {/* STR-only: property count + cost seg */}
        {isStr ? (
          <>
            <Field label="Property count">
              <select name="propertyCount" className={inputCls} defaultValue="UNKNOWN">
                <option value="NONE">None yet</option>
                <option value="ONE">1</option>
                <option value="TWO_TO_FOUR">2 – 4</option>
                <option value="FIVE_TO_NINE">5 – 9</option>
                <option value="TEN_PLUS">10+</option>
                <option value="UNKNOWN">Unknown</option>
              </select>
            </Field>
            <Field label="Interested in a cost seg study?">
              <select name="costSegInterest" className={inputCls} defaultValue="">
                <option value="">Not sure yet</option>
                <option value="YES">Yes — want to explore</option>
                <option value="NO">No, not relevant</option>
              </select>
            </Field>
          </>
        ) : null}

        {/* E-com-only: ad spend + books status */}
        {isEcom ? (
          <>
            <Field label="Monthly ad spend">
              <select name="monthlyAdSpendRange" className={inputCls} defaultValue="UNKNOWN">
                <option value="NONE">No paid ads</option>
                <option value="UNDER_5K">Under $5k / month</option>
                <option value="FROM_5K_TO_25K">$5k – $25k / month</option>
                <option value="FROM_25K_TO_100K">$25k – $100k / month</option>
                <option value="OVER_100K">$100k+ / month</option>
                <option value="UNKNOWN">Not sure</option>
              </select>
            </Field>
            <Field label="Are your books up to date?">
              <select name="booksStatus" className={inputCls} defaultValue="">
                <option value="">Select one</option>
                <option value="UP_TO_DATE">Yes — up to date</option>
                <option value="BEHIND_1_3">Behind 1–3 months</option>
                <option value="BEHIND_4_PLUS">Behind 4+ months</option>
                <option value="NEVER_DONE">Never done them</option>
                <option value="UNSURE">Not sure</option>
              </select>
            </Field>
          </>
        ) : null}

        <Field label="Urgency">
          <select name="urgency" className={inputCls} defaultValue="UNKNOWN">
            <option value="NOW">Now</option>
            <option value="NEXT_30_DAYS">Next 30 days</option>
            <option value="RESEARCHING">Still researching</option>
            <option value="UNKNOWN">—</option>
          </select>
        </Field>
      </div>

      {/* E-com-only: multi-select sales channels */}
      {isEcom ? (
        <fieldset className="rounded-md border border-brand-hairline p-3">
          <legend className="px-1 text-[11px] uppercase tracking-wider text-brand-muted">
            Sales channels
          </legend>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {[
              { v: "SHOPIFY", label: "Shopify" },
              { v: "AMAZON", label: "Amazon" },
              { v: "WALMART", label: "Walmart" },
              { v: "EBAY", label: "eBay" },
              { v: "ETSY", label: "Etsy" },
              { v: "TIKTOK_SHOP", label: "TikTok Shop" },
              { v: "WOO", label: "WooCommerce" },
              { v: "CUSTOM", label: "Custom / other" },
            ].map((opt) => (
              <Checkbox key={opt.v} name="salesChannels" value={opt.v} label={opt.label} />
            ))}
          </div>
        </fieldset>
      ) : null}

      <Field label={statesLabel}>
        <input name="statesOfOperation" className={inputCls} placeholder="TX, FL, CO" />
      </Field>

      <fieldset className="rounded-md border border-brand-hairline p-3">
        <legend className="px-1 text-[11px] uppercase tracking-wider text-brand-muted">
          Complexity
        </legend>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          {/* STR customers often have W-2 + payroll signals. For e-com the more
              useful third flag is "runs payroll". */}
          {isStr ? (
            <>
              <Checkbox name="w2IncomeFlag" label="Has W-2 income" />
              <Checkbox name="payrollFlag" label="Runs payroll" />
              <Checkbox name="otherBusinessIncomeFlag" label="Other business income" />
            </>
          ) : isEcom ? (
            <>
              <Checkbox name="payrollFlag" label="Runs payroll" />
              <Checkbox name="otherBusinessIncomeFlag" label="Other business income" />
              <Checkbox name="w2IncomeFlag" label="Has W-2 day job" />
            </>
          ) : (
            <>
              <Checkbox name="w2IncomeFlag" label="Has W-2 income" />
              <Checkbox name="payrollFlag" label="Runs payroll" />
              <Checkbox name="otherBusinessIncomeFlag" label="Other business income" />
            </>
          )}
        </div>
      </fieldset>

      <Field label={painPointLabel}>
        <textarea name="painPoint" rows={3} className={inputCls} />
      </Field>

      {/* honeypot — hidden from humans, visible to bots */}
      <input name="website_hp" type="text" tabIndex={-1} autoComplete="off" className="hidden" />

      <input
        type="hidden"
        name="source"
        value={variant === "general" ? "WEBSITE" : "LANDING_PAGE"}
      />

      <div className="flex items-center justify-between">
        <p className="text-xs text-brand-muted">
          Your info is stored in FABBI&rsquo;s CRM and only used to respond to your inquiry.
        </p>
        <button
          type="submit"
          disabled={stage === "submitting"}
          className="rounded-md bg-brand-blue px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-blue-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {stage === "submitting" ? "Submitting…" : "Submit inquiry"}
        </button>
      </div>

      {stage === "error" && message ? (
        <pre className="whitespace-pre-wrap rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          {message}
        </pre>
      ) : null}
    </form>
  );
}

const inputCls =
  "mt-1 block w-full rounded-md border border-brand-hairline bg-white px-3 py-2 text-sm text-brand-navy placeholder:text-brand-muted focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20";

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
      <span className="text-xs font-medium uppercase tracking-wider text-brand-muted">
        {label}
        {required ? <span className="text-brand-blue"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

function Checkbox({
  name,
  label,
  value,
}: {
  name: string;
  label: string;
  value?: string;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-brand-navy">
      <input
        type="checkbox"
        name={name}
        value={value}
        className="h-4 w-4 rounded border-brand-hairline text-brand-blue focus:ring-brand-blue"
      />
      {label}
    </label>
  );
}
