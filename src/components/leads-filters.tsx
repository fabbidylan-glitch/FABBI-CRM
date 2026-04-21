"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const STAGES = [
  { v: "", label: "All stages" },
  { v: "NEW_LEAD", label: "New Lead" },
  { v: "CONTACTED", label: "Contacted" },
  { v: "QUALIFIED", label: "Qualified" },
  { v: "CONSULT_BOOKED", label: "Consult Booked" },
  { v: "CONSULT_COMPLETED", label: "Consult Completed" },
  { v: "PROPOSAL_DRAFTING", label: "Proposal Drafting" },
  { v: "PROPOSAL_SENT", label: "Proposal Sent" },
  { v: "FOLLOW_UP_NEGOTIATION", label: "Follow-up" },
  { v: "WON", label: "Won" },
  { v: "LOST", label: "Lost" },
  { v: "COLD_NURTURE", label: "Cold Nurture" },
];

const SOURCES = [
  { v: "", label: "All sources" },
  { v: "WEBSITE", label: "Website" },
  { v: "LANDING_PAGE", label: "Landing Page" },
  { v: "GOOGLE_ADS", label: "Google Ads" },
  { v: "META_ADS", label: "Meta Ads" },
  { v: "LINKEDIN_ADS", label: "LinkedIn Ads" },
  { v: "ORGANIC_SEARCH", label: "Organic Search" },
  { v: "ORGANIC_BRANDED", label: "Organic Branded" },
  { v: "REFERRAL", label: "Referral" },
  { v: "PARTNER_REFERRAL", label: "Partner Referral" },
  { v: "CALENDLY", label: "Calendly" },
  { v: "MANUAL", label: "Manual" },
  { v: "CSV_IMPORT", label: "CSV Import" },
];

const GRADES = [
  { v: "", label: "All grades" },
  { v: "A", label: "A" },
  { v: "B", label: "B" },
  { v: "C", label: "C" },
  { v: "D", label: "D" },
];

const QUALIFICATIONS = [
  { v: "", label: "Any qualification" },
  { v: "QUALIFIED", label: "Qualified" },
  { v: "MANUAL_REVIEW", label: "Manual review" },
  { v: "NURTURE_ONLY", label: "Nurture only" },
  { v: "DISQUALIFIED", label: "Disqualified" },
  { v: "UNREVIEWED", label: "Unreviewed" },
];

const NICHES = [
  { v: "", label: "All niches" },
  { v: "STR_OWNER", label: "STR Owner" },
  { v: "AIRBNB_VRBO_OPERATOR", label: "Airbnb / VRBO" },
  { v: "REAL_ESTATE_INVESTOR", label: "REI" },
  { v: "HIGH_INCOME_STR_STRATEGY", label: "High-income + STR" },
  { v: "MULTI_SERVICE_CLIENT", label: "Multi-service" },
  { v: "GENERAL_SMB", label: "General SMB" },
  { v: "OTHER", label: "Other" },
];

const SERVICES = [
  { v: "", label: "Any service" },
  { v: "TAX_PREP", label: "Tax prep" },
  { v: "BOOKKEEPING", label: "Bookkeeping" },
  { v: "TAX_STRATEGY", label: "Tax strategy" },
  { v: "BOOKKEEPING_AND_TAX", label: "Bookkeeping + tax" },
  { v: "CFO", label: "CFO" },
  { v: "FULL_SERVICE", label: "Full-service" },
  { v: "UNSURE", label: "Unsure" },
];

const URGENCIES = [
  { v: "", label: "Any urgency" },
  { v: "NOW", label: "Now" },
  { v: "NEXT_30_DAYS", label: "Next 30 days" },
  { v: "RESEARCHING", label: "Researching" },
  { v: "UNKNOWN", label: "Unknown" },
];

export function LeadsFilters() {
  const sp = useSearchParams();
  const router = useRouter();
  const [search, setSearch] = useState(sp.get("search") ?? "");

  // Debounce text search so we don't refresh on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams(sp.toString());
      if (search) params.set("search", search);
      else params.delete("search");
      if ((sp.get("search") ?? "") !== search) {
        router.replace(`/leads?${params.toString()}`);
      }
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const setParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(sp.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      router.replace(`/leads?${params.toString()}`);
    },
    [sp, router]
  );

  const activeFilters = Array.from(sp.entries()).filter(
    ([k, v]) => v && k !== "search"
  ).length;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-brand-hairline px-5 py-3">
      <input
        type="search"
        placeholder="Search name, email, company…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-64 rounded-md border border-brand-hairline bg-white px-3 py-1.5 text-sm text-brand-navy placeholder:text-brand-muted focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
      />

      <FilterSelect name="stage" sp={sp} options={STAGES} setParam={setParam} />
      <FilterSelect name="source" sp={sp} options={SOURCES} setParam={setParam} />
      <FilterSelect name="grade" sp={sp} options={GRADES} setParam={setParam} />
      <FilterSelect name="qualification" sp={sp} options={QUALIFICATIONS} setParam={setParam} />
      <FilterSelect name="niche" sp={sp} options={NICHES} setParam={setParam} />
      <FilterSelect name="serviceInterest" sp={sp} options={SERVICES} setParam={setParam} />
      <FilterSelect name="urgency" sp={sp} options={URGENCIES} setParam={setParam} />

      {activeFilters > 0 ? (
        <button
          onClick={() => router.replace("/leads")}
          className="ml-1 text-xs font-medium text-brand-blue hover:underline"
        >
          Clear filters ({activeFilters})
        </button>
      ) : null}
    </div>
  );
}

function FilterSelect({
  name,
  sp,
  options,
  setParam,
}: {
  name: string;
  sp: URLSearchParams;
  options: Array<{ v: string; label: string }>;
  setParam: (k: string, v: string) => void;
}) {
  const current = sp.get(name) ?? "";
  return (
    <select
      value={current}
      onChange={(e) => setParam(name, e.target.value)}
      className={`rounded-md border bg-white px-2 py-1.5 text-xs font-medium ${
        current
          ? "border-brand-blue text-brand-blue"
          : "border-brand-hairline text-brand-navy"
      } focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20`}
    >
      {options.map((o) => (
        <option key={o.v} value={o.v}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
