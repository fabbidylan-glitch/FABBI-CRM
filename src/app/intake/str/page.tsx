import Link from "next/link";
import { LeadIntakeForm } from "@/components/lead-intake-form";

export const metadata = {
  title: "STR & real estate inquiry — FABBI",
};

// STR / real estate funnel entry. Niche is pinned to STR_OWNER by default;
// prospects can adjust to Airbnb-operator or REI from inside the form.
export default function StrIntakePage() {
  const calendlyUrl = process.env.CALENDLY_DEFAULT_EVENT_URL;

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <div className="mb-8">
        <Link
          href="/intake"
          className="text-xs font-medium text-brand-muted hover:text-brand-blue"
        >
          ← Not real estate?
        </Link>
        <div className="mt-3 text-xs font-semibold uppercase tracking-[0.22em] text-brand-blue">
          FABBI · Short-term rentals & real estate
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-brand-navy">
          Free STR tax &amp; bookkeeping review
        </h1>
        <p className="mt-2 text-sm text-brand-muted">
          Built for Airbnb hosts, VRBO operators, and real estate investors.
          Tell us about your portfolio and we&rsquo;ll come back within one
          business day.
        </p>
      </div>

      <LeadIntakeForm variant="str" calendlyUrl={calendlyUrl} />
    </main>
  );
}
