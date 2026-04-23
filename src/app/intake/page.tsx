import Link from "next/link";

export const metadata = {
  title: "Talk to FABBI — choose your niche",
};

// Chooser landing page. The two target niches get their own entry points so
// each form can ask the qualification questions that actually matter to that
// industry (property count vs. sales channels, cost seg vs. ad spend, etc.).
// Keeping a generic fallback link for anyone who doesn't fit either bucket.
export default function IntakeChooserPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <div className="mb-10 text-center">
        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-blue">
          FABBI · New client inquiry
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-brand-navy">
          What kind of business do you run?
        </h1>
        <p className="mt-2 text-sm text-brand-muted">
          Two-minute form. We&rsquo;ll come back to you within one business day.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <NicheCard
          href="/intake/str"
          eyebrow="Real estate"
          title="Short-term rentals & real estate"
          bullets={[
            "Airbnb, VRBO, and direct bookings",
            "Portfolio bookkeeping at property level",
            "Cost seg, STR loophole, and entity strategy",
          ]}
        />
        <NicheCard
          href="/intake/ecom"
          eyebrow="E-commerce"
          title="Shopify, Amazon & dropshipping"
          bullets={[
            "Platform reconciliation across channels",
            "Real margin + COGS visibility",
            "Multi-state sales tax clarity",
          ]}
        />
      </div>

      <div className="mt-10 text-center text-sm text-brand-muted">
        Something else?{" "}
        <Link href="/intake/general" className="text-brand-blue hover:underline">
          Use the general inquiry form
        </Link>
        .
      </div>
    </main>
  );
}

function NicheCard({
  href,
  eyebrow,
  title,
  bullets,
}: {
  href: string;
  eyebrow: string;
  title: string;
  bullets: string[];
}) {
  return (
    <Link
      href={href}
      className="group block rounded-xl border border-brand-hairline bg-white p-7 shadow-card transition hover:-translate-y-0.5 hover:border-brand-blue hover:shadow-card-hover"
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-blue">
        {eyebrow}
      </div>
      <h2 className="mt-2 text-xl font-semibold text-brand-navy">{title}</h2>
      <ul className="mt-4 space-y-1.5 text-sm text-brand-navy/80">
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-2">
            <span className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full bg-brand-blue" />
            <span>{b}</span>
          </li>
        ))}
      </ul>
      <div className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-brand-blue">
        Start
        <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
          →
        </span>
      </div>
    </Link>
  );
}
