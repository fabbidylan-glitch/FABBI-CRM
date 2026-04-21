import { LeadIntakeForm } from "@/components/lead-intake-form";

export const metadata = {
  title: "Request a consult — FABBI",
};

export default function IntakePage() {
  const calendlyUrl = process.env.CALENDLY_DEFAULT_EVENT_URL;

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <div className="mb-8">
        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-blue">
          FABBI · New client inquiry
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-brand-navy">
          Tell us about your situation
        </h1>
        <p className="mt-2 text-sm text-brand-muted">
          Short-term rentals, real estate investing, tax strategy. Fill this out and we&rsquo;ll
          come back to you within one business day.
        </p>
      </div>

      <LeadIntakeForm calendlyUrl={calendlyUrl} />
    </main>
  );
}
