import { SignOutButton } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import type { ReactNode } from "react";
import { CommandPalette } from "@/components/command-palette";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";
import { config } from "@/lib/config";
import { syncClerkUser } from "@/lib/features/users/sync";
import { ActiveNav } from "@/components/active-nav";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/leads", label: "Leads" },
  { href: "/contacts", label: "Contacts" },
  { href: "/pipeline", label: "Pipeline" },
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
    <div className="flex min-h-screen">
      <KeyboardShortcuts />
      <CommandPalette />
      <aside className="hidden w-64 shrink-0 flex-col bg-brand-navy px-4 py-6 text-white md:flex">
        <Link href="/" className="mb-8 ml-1 inline-flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-blue text-sm font-bold text-white shadow-card">
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
            <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-white/80">
              <div className="flex items-center gap-1.5 font-semibold text-brand-blue-soft">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-mint" />
                Preview mode
              </div>
              <div className="mt-1 text-white/60">
                No database connected — rendering static fixtures.
              </div>
            </div>
          ) : null}
          <div className="flex items-center gap-2.5 rounded-lg border border-white/5 bg-white/5 px-3 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-blue text-sm font-semibold leading-8 text-white">
              {initials.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium text-white">{displayName}</div>
              {config.authEnabled && user ? (
                <SignOutButton>
                  <button className="text-[11px] text-white/50 hover:text-white/80">
                    Sign out
                  </button>
                </SignOutButton>
              ) : null}
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-brand-hairline bg-white/80 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 md:px-6">
            <div className="flex items-center gap-3">
              <Link href="/" className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-blue text-sm font-bold text-white md:hidden">
                F
              </Link>
              <h1 className="text-base font-semibold tracking-tight text-brand-navy md:text-lg">
                {title}
              </h1>
            </div>
            <div className="text-[11px] text-brand-muted">
              <span className="hidden sm:inline">{displayName}</span>
            </div>
          </div>
          <nav className="md:hidden">
            <ActiveNav items={NAV} variant="mobile" />
          </nav>
        </header>
        <main className="flex-1">
          <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
