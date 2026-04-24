import { IntakeTwoStepForm } from "@/components/intake-two-step-form";

export const metadata = {
  title: "Find Out How Much You're Overpaying in Taxes | FABBI",
  description:
    "Tell us about your business and we'll identify missed tax savings opportunities and bookkeeping issues.",
  robots: { index: true, follow: true },
};

const VALUE_BULLETS = [
  "Identify missed tax savings opportunities",
  "Clean up bookkeeping and reporting issues",
  "Get a clear strategy for your business and tax structure",
];

export default function IntakePage() {
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[1fr_1.1fr] lg:gap-14 lg:py-20">
      <section className="max-w-xl">
        <p className="inline-flex items-center rounded-full border border-site-border bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-site-ink-2">
          Tax Strategy · Bookkeeping · CFO
        </p>
        <h1 className="mt-5 font-display text-4xl font-semibold leading-[1.05] tracking-tight text-site-ink sm:text-5xl">
          Find Out How Much You&rsquo;re Overpaying in Taxes.
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-site-ink-2">
          Tell us about your business and we&rsquo;ll identify missed tax
          savings opportunities and bookkeeping issues.
        </p>

        <ul className="mt-8 space-y-3">
          {VALUE_BULLETS.map((b) => (
            <li
              key={b}
              className="flex items-start gap-3 text-[15px] leading-relaxed text-site-ink"
            >
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-site-ink text-white">
                <svg
                  viewBox="0 0 20 20"
                  fill="none"
                  aria-hidden
                  className="h-3 w-3"
                >
                  <path
                    d="M4 10l4 4 8-8"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span>{b}</span>
            </li>
          ))}
        </ul>

        <p className="mt-10 text-sm font-medium text-site-ink-2">
          Clients have saved over $120,000 in taxes through proper planning
          and structure.
        </p>
      </section>

      <section>
        <IntakeTwoStepForm />
      </section>
    </div>
  );
}
