import Link from "next/link";
import { ThanksCalendly } from "./thanks-calendly";

// Force-dynamic so the Calendly URL env var is read per-request. Otherwise a
// build-time value gets baked in, and changing CALENDLY_DEFAULT_EVENT_URL in
// Vercel does nothing until the next deploy.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Book your 15-minute call | FABBI",
  description:
    "We received your info. Pick a time so we can review your setup and identify opportunities to save you money.",
  robots: { index: false, follow: false },
};

const REVIEW_ITEMS = [
  "Your tax setup",
  "Potential missed savings",
  "Your entity structure",
  "Bookkeeping gaps",
];

// STR-specific mistakes we see often. Shown here because the page is the
// first post-submit touchpoint — surface concrete value before the call.
const STR_MISTAKES = [
  "Filing STR income as passive without testing average stay and material participation",
  "Missing depreciation or skipping a cost segregation study on a qualifying property",
  "Treating net Airbnb/VRBO deposits as revenue and losing visibility on platform fees",
  "Running multiple LLCs through one QuickBooks file without entity-level books",
  "No contemporaneous log of hosting hours, so the STR loophole can't hold up under audit",
];

export default function IntakeThanksPage() {
  // Same env var the rest of the app reads — keeps a single source of truth
  // so ops doesn't have to set two different keys.
  const calendlyUrl = process.env.CALENDLY_DEFAULT_EVENT_URL ?? null;

  return (
    <div className="mx-auto max-w-3xl px-5 py-14 sm:px-8 sm:py-20">
      {/* Primary action: booking. Rendered first so submitters can act now. */}
      <section className="rounded-2xl border border-site-border bg-white p-8 shadow-[0_1px_2px_rgba(11,31,58,0.04),0_8px_24px_-12px_rgba(11,31,58,0.12)] sm:p-10">
        <span className="inline-flex items-center gap-2 rounded-full bg-site-accent-soft px-3 py-1 text-xs font-semibold text-site-ink">
          <svg
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden
            className="h-3.5 w-3.5 text-site-accent"
          >
            <path
              d="M4 10l4 4 8-8"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Received
        </span>

        <h1 className="mt-5 font-display text-3xl font-semibold leading-tight tracking-tight text-site-ink sm:text-4xl">
          Book Your 15-Minute Call Now.
        </h1>
        <p className="mt-4 text-base leading-relaxed text-site-ink-2 sm:text-lg">
          We&rsquo;ve received your info — the next step is to schedule your
          call so we can review your setup and identify opportunities to save
          you money.
        </p>
        <p className="mt-3 text-sm font-medium text-site-accent">
          Most clients book within a few minutes — availability fills
          quickly.
        </p>

        {calendlyUrl ? (
          <div className="mt-6">
            <ThanksCalendly url={calendlyUrl} />
          </div>
        ) : (
          <p className="mt-6 rounded-xl border border-site-border bg-site-surface px-5 py-4 text-sm text-site-ink-2">
            We&rsquo;ll follow up with a scheduling link shortly.
          </p>
        )}
      </section>

      {/* What we'll review — sets expectations for the call and makes the
          prospect feel value before we ever get on the phone. */}
      <section className="mt-6 rounded-2xl border border-site-border bg-white p-8 shadow-[0_1px_2px_rgba(11,31,58,0.04),0_8px_24px_-12px_rgba(11,31,58,0.12)] sm:p-10">
        <h2 className="font-display text-xl font-semibold tracking-tight text-site-ink sm:text-2xl">
          Here&rsquo;s what we&rsquo;ll review before your call.
        </h2>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {REVIEW_ITEMS.map((item) => (
            <li
              key={item}
              className="flex items-start gap-3 rounded-xl border border-site-border bg-site-surface px-4 py-3 text-sm font-medium text-site-ink"
            >
              <svg
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden
                className="mt-0.5 h-4 w-4 shrink-0 text-site-accent"
              >
                <path
                  d="M4 10l4 4 8-8"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-sm leading-relaxed text-site-ink-2 sm:text-base">
          We&rsquo;ll come to the call with real insights — not generic
          advice.
        </p>
      </section>

      {/* Common STR mistakes — concrete, credible value signal for the
          lead between submit and call. */}
      <section className="mt-6 rounded-2xl border border-site-border bg-white p-8 shadow-[0_1px_2px_rgba(11,31,58,0.04),0_8px_24px_-12px_rgba(11,31,58,0.12)] sm:p-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-site-accent">
          If you operate short-term rentals
        </p>
        <h2 className="mt-2 font-display text-xl font-semibold tracking-tight text-site-ink sm:text-2xl">
          Common STR mistakes we see on almost every first call.
        </h2>
        <ul className="mt-5 space-y-3">
          {STR_MISTAKES.map((item, i) => (
            <li
              key={item}
              className="flex items-start gap-3 text-sm leading-relaxed text-site-ink sm:text-[15px]"
            >
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-site-accent-soft text-[11px] font-semibold text-site-ink">
                {i + 1}
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-8 text-center text-sm text-site-muted">
        Need to update anything?{" "}
        <Link
          href="/intake"
          className="font-medium text-site-ink underline-offset-2 hover:underline"
        >
          Resubmit the form
        </Link>{" "}
        and we&rsquo;ll merge it with your existing record.
      </p>
    </div>
  );
}
