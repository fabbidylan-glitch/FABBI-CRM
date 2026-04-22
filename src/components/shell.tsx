import { SignOutButton } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import type { ReactNode } from "react";
import { CommandPalette } from "@/components/command-palette";
import { InstallAppBanner } from "@/components/install-app-banner";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";
import { config } from "@/lib/config";
import { syncClerkUser } from "@/lib/features/users/sync";
import { ActiveNav } from "@/components/active-nav";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/leads", label: "Leads" },
  { href: "/contacts", label: "Contacts" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/onboarding", label: "Onboarding" },
];

export async function Shell({ children, title }: { children: ReactNode; title: string }) {
  const user = config.authEnabled ? await currentUser() : null;
  if (user && config.dbEnabled) {
    try {
      await syncClerkUser(user);
    } catch (err) {
      console.error("[shell] syncClerkUser failed", err);
    }
  }
  const initials = user
    ? `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}` || user.emailAddresses[0]?.emailAddress[0]?.toUpperCase() || "U"
    : "DF";
  const displayName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(" ") ||
      user.emailAddresses[0]?.emailAddress ||
      "Signed in"
    : "Dylan Fabbi";

  return (
    <div className="flex min-h-screen bg-[#fafbfd]">
      <KeyboardShortcuts />
      <CommandPalette />
      <InstallAppBanner />
      <aside className="relative hidden w-64 shrink-0 flex-col bg-gradient-sidebar px-4 py-6 text-white md:flex">
        {/* Subtle inner highlight along the right edge — the sort of detail that reads
            as "designed" even when the viewer can't articulate why. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-white/0 via-white/10 to-white/0"
        />
        <Link href="/" className="mb-8 ml-1 inline-flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-blue text-sm font-bold text-white shadow-[inset_0_1px_0_0_rgb(255_255_255/0.18),0_4px_10px_-2px_rgb(0_91_247/0.5)]">
            F
          </span>
          <div>
            <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-brand-blue-soft/80">
              Internal CRM
            </div>
            <div className="-mt-0.5 text-lg font-semibold tracking-tight text-white">FABBI</div>
          </div>
        </Link>

        <ActiveNav items={NAV} variant="sidebar" />

        <div className="mt-auto space-y-3">
          {!config.dbEnabled ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-xs text-white/80 backdrop-blur-sm">
              <div className="flex items-center gap-1.5 font-semibold text-brand-blue-soft">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-mint" />
                Preview mode
              </div>
              <div className="mt-1 text-white/60">
                No database connected — rendering static fixtures.
              </div>
            </div>
          ) : null}
          <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.04] px-3 py-2 backdrop-blur-sm">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-blue text-sm font-semibold leading-8 text-white shadow-[inset_0_1px_0_0_rgb(255_255_255/0.2)]">
              {initials.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium text-white">{displayName}</div>
              {config.authEnabled && user ? (
                <SignOutButton>
                  <button className="text-[11px] text-white/50 transition hover:text-white/90">
                    Sign out
                  </button>
                </SignOutButton>
              ) : null}
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-brand-hairline/70 bg-white/70 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 md:px-6">
            <div className="flex items-center gap-3">
              <Link href="/" className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-blue text-sm font-bold text-white shadow-[inset_0_1px_0_0_rgb(255_255_255/0.18)] md:hidden">
                F
              </Link>
              <div>
                <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-brand-muted">
                  FABBI CRM
                </div>
                <h1 className="text-[17px] font-semibold leading-tight tracking-[-0.01em] text-brand-navy md:text-[19px]">
                  {title}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs text-brand-muted">
              <kbd className="hidden rounded-md border border-brand-hairline bg-white px-1.5 py-0.5 text-[10px] font-medium text-brand-muted shadow-sm sm:inline-block">
                ⌘K
              </kbd>
              <span className="hidden sm:inline">{displayName}</span>
            </div>
          </div>
          <nav className="md:hidden">
            <ActiveNav items={NAV} variant="mobile" />
          </nav>
        </header>
        <main className="flex-1 bg-gradient-surface">
          <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
