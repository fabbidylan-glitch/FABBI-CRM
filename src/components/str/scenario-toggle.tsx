"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

const SCENARIOS = [
  { key: "conservative", label: "Conservative" },
  { key: "base", label: "Base" },
  { key: "aggressive", label: "Aggressive" },
] as const;

export type ScenarioKey = (typeof SCENARIOS)[number]["key"];

/** URL-driven 3-way toggle. Updates the `scenario` search param and pushes
 * a new URL so the server component re-renders summary cards with the right
 * numbers. No client state — the URL is the state. */
export function ScenarioToggle({ active }: { active: ScenarioKey }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function setScenario(key: ScenarioKey) {
    const next = new URLSearchParams(params.toString());
    next.set("scenario", key);
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="inline-flex rounded-md border border-brand-hairline bg-white p-0.5 text-xs">
      {SCENARIOS.map((s) => {
        const isActive = active === s.key;
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => setScenario(s.key)}
            className={`rounded px-3 py-1 font-medium transition ${
              isActive
                ? "bg-brand-blue text-white shadow-btn-primary"
                : "text-brand-navy hover:bg-brand-blue-tint"
            }`}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
