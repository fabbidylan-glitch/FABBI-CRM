"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  items: Array<{ href: string; label: string }>;
  variant: "sidebar" | "mobile";
};

/**
 * Nav that highlights the current route. Same component for desktop sidebar
 * and mobile horizontal tabs — the only difference is visual treatment.
 */
export function ActiveNav({ items, variant }: Props) {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  if (variant === "sidebar") {
    return (
      <nav className="flex flex-col gap-0.5 text-sm">
        {items.map((n) => {
          const active = isActive(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-2 rounded-md px-3 py-2 font-medium transition ${
                active
                  ? "bg-white/10 text-white"
                  : "text-white/60 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span
                className={`h-1 w-1 rounded-full transition ${
                  active ? "bg-brand-blue" : "bg-transparent"
                }`}
              />
              {n.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <div className="flex gap-1 overflow-x-auto border-t border-brand-hairline px-2 py-1.5 text-xs">
      {items.map((n) => {
        const active = isActive(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 rounded-md px-3 py-1.5 font-medium transition ${
              active
                ? "bg-brand-blue text-white"
                : "text-brand-navy hover:bg-brand-blue-tint"
            }`}
          >
            {n.label}
          </Link>
        );
      })}
    </div>
  );
}
