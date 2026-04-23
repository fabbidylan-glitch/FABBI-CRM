import Link from "next/link";
import { LeadIntakeForm } from "@/components/lead-intake-form";

export const metadata = {
  title: "General inquiry — FABBI",
};

// Fallback form for prospects who don't fit the STR or e-commerce funnels.
// Shows the full niche dropdown and generic qualification fields.
export default function GeneralIntakePage() {
  const calendlyUrl = process.env.CALENDLY_DEFAULT_EVENT_URL;

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <div className="mb-8">
        <Link
          href="/intake"
          className="text-xs font-medium text-brand-muted hover:text-brand-blue"
        >
          ← Back to niche picker
        </Link>
        <div className="mt-3 text-xs font-semibold uppercase tracking-[0.22em] text-brand-blue">
          FABBI · New client inquiry
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-brand-navy">
          Tell us about your situation
        </h1>
        <p className="mt-2 text-sm text-brand-muted">
          Not sure which bucket you&rsquo;re in? Fill this out and we&rsquo;ll
          come back to you within one business day.
        </p>
      </div>

      <LeadIntakeForm variant="general" calendlyUrl={calendlyUrl} />
    </main>
  );
}
