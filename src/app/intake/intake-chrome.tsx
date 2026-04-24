import Link from "next/link";

/**
 * Branded chrome for the public intake flow. Mirrors the fabbi.co header
 * exactly — same FABBI wordmark, same typography, same ink palette — so
 * prospects moving from an ad / the marketing site into the intake don't
 * see a visual break.
 *
 * Kept intentionally minimal (logo only, no nav) so the page stays
 * conversion-focused. The wordmark links back to fabbi.co in case the
 * prospect wants to browse the marketing site before submitting.
 */
export function IntakeHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-site-border/70 bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/70">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link
          href="https://fabbi.co"
          className="flex items-center gap-2"
          aria-label="FABBI"
        >
          <span className="font-display text-2xl font-semibold tracking-tight text-site-ink">
            FABBI
          </span>
        </Link>
        <div className="text-xs font-medium uppercase tracking-[0.18em] text-site-muted">
          New Client Intake
        </div>
      </div>
    </header>
  );
}

/**
 * Outer surface for the intake pages. Sets the page background to the
 * marketing site's surface tone (not the dashboard's blue-tint).
 */
export function IntakeShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-site-surface font-sans text-site-ink">
      <IntakeHeader />
      {children}
    </div>
  );
}
