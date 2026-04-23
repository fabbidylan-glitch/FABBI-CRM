import Link from "next/link";
import { LeadIntakeForm } from "@/components/lead-intake-form";

export const metadata = {
  title: "E-commerce inquiry — FABBI",
};

// E-commerce / dropshipper funnel entry. Niche is pinned to E_COMMERCE.
export default function EcomIntakePage() {
  const calendlyUrl = process.env.CALENDLY_DEFAULT_EVENT_URL;

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <div className="mb-8">
        <Link
          href="/intake"
          className="text-xs font-medium text-brand-muted hover:text-brand-blue"
        >
          ← Not e-commerce?
        </Link>
        <div className="mt-3 text-xs font-semibold uppercase tracking-[0.22em] text-brand-blue">
          FABBI · E-commerce &amp; dropshipping
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-brand-navy">
          Free e-commerce books + tax review
        </h1>
        <p className="mt-2 text-sm text-brand-muted">
          For Shopify sellers, Amazon merchants, dropshippers, and multi-channel
          brands. Tell us about your operation and we&rsquo;ll come back within
          one business day.
        </p>
      </div>

      <LeadIntakeForm variant="ecom" calendlyUrl={calendlyUrl} />
    </main>
  );
}
