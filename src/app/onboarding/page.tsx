import { Shell } from "@/components/shell";

export const dynamic = "force-dynamic";
export const revalidate = 0;

import { Card, CardBody, Pill, RawPill } from "@/components/ui";
import {
  countOnboardings,
  listOnboardings,
  type OnboardingFilter,
} from "@/lib/features/onboarding/queries";
import { STAGE_LABEL, stageIndex, ONBOARDING_STAGE_ORDER } from "@/lib/onboarding/templates";
import Link from "next/link";
import type { OnboardingStage } from "@prisma/client";

type SearchParams = { [k: string]: string | string[] | undefined };

function pick(sp: SearchParams, key: string): string | undefined {
  const v = sp[key];
  if (typeof v === "string" && v.length > 0) return v;
  return undefined;
}

const FILTER_TABS: Array<{ v: NonNullable<OnboardingFilter["status"]>; label: string }> = [
  { v: "active", label: "Active" },
  { v: "blocked", label: "Blocked" },
  { v: "complete", label: "Complete" },
  { v: "all", label: "All" },
];

export default async function OnboardingListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const statusParam = pick(sp, "status") as NonNullable<OnboardingFilter["status"]> | undefined;
  const status = statusParam ?? "active";

  const [rows, counts] = await Promise.all([listOnboardings({ status }), countOnboardings()]);

  return (
    <Shell title="Onboarding">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-hairline px-5 py-3">
          <div className="flex items-center gap-1">
            {FILTER_TABS.map((t) => {
              const active = status === t.v;
              const count =
                t.v === "active" ? counts.active : t.v === "blocked" ? counts.blocked : t.v === "complete" ? counts.complete : counts.active + counts.complete;
              const href = `/onboarding?status=${t.v}`;
              return (
                <Link
                  key={t.v}
                  href={href}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                    active ? "bg-brand-blue text-white" : "text-brand-navy hover:bg-brand-blue-tint"
                  }`}
                >
                  {t.label} <span className="opacity-60">({count})</span>
                </Link>
              );
            })}
          </div>
          <div className="text-[11px] text-brand-muted">
            Onboardings are created automatically when a proposal is accepted.
          </div>
        </div>

        <CardBody className="px-0 py-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-sm">
              <thead>
                <tr className="border-b border-brand-hairline/70 bg-slate-50/40 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-muted">
                  <th className="px-5 py-2.5">Client</th>
                  <th className="py-2.5">Template</th>
                  <th className="py-2.5">Stage</th>
                  <th className="py-2.5">Progress</th>
                  <th className="py-2.5">Owner</th>
                  <th className="py-2.5 text-right">Monthly</th>
                  <th className="py-2.5 text-right">Items</th>
                  <th className="px-5 py-2.5 text-right">Created</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-12 text-center text-sm text-brand-muted">
                      {status === "complete"
                        ? "No completed onboardings yet."
                        : status === "blocked"
                          ? "No blocked onboardings. 🎉"
                          : "No active onboardings yet. Accept a proposal to create one."}
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr
                      key={r.id}
                      className={`group border-b border-brand-hairline/50 transition-colors last:border-none ${r.blockedAt ? "bg-rose-50/50" : "hover:bg-slate-50/70"}`}
                    >
                      <td className="px-5 py-3">
                        <Link href={`/onboarding/${r.id}`} className="block">
                          <div className="font-semibold tracking-tight text-brand-navy group-hover:text-brand-blue">
                            {r.leadName || "—"}
                          </div>
                          <div className="mt-0.5 text-xs text-brand-muted">
                            {r.companyName ?? "No company"}
                          </div>
                        </Link>
                      </td>
                      <td className="py-3 text-xs text-brand-muted">
                        {r.templateKey ? r.templateKey.replaceAll("_", " ") : "—"}
                      </td>
                      <td className="py-3">
                        <StagePill stage={r.stage} blocked={!!r.blockedAt} />
                      </td>
                      <td className="py-3">
                        <ProgressBar stage={r.stage} />
                      </td>
                      <td className="py-3 text-slate-700">
                        {r.ownerName ?? <span className="text-amber-600">Unassigned</span>}
                      </td>
                      <td className="py-3 text-right tabular-nums text-brand-navy">
                        {r.monthlyFee ? `$${r.monthlyFee.toLocaleString()}` : "—"}
                      </td>
                      <td className="py-3 text-right text-xs">
                        <span className="tabular-nums text-brand-navy">
                          {r.totalItems - r.openItems - r.blockedItems}/{r.totalItems}
                        </span>
                        {r.blockedItems > 0 ? (
                          <span className="ml-2 rounded-full bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700 ring-1 ring-inset ring-rose-200/80">
                            {r.blockedItems} blocked
                          </span>
                        ) : null}
                      </td>
                      <td className="px-5 py-3 text-right text-xs text-brand-muted">
                        {new Date(r.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </Shell>
  );
}

function StagePill({ stage, blocked }: { stage: OnboardingStage; blocked: boolean }) {
  if (blocked) return <Pill tone="rose">Blocked · {STAGE_LABEL[stage]}</Pill>;
  if (stage === "COMPLETE") return <Pill tone="emerald">Complete</Pill>;
  return <Pill tone="brand">{STAGE_LABEL[stage]}</Pill>;
}

function ProgressBar({ stage }: { stage: OnboardingStage }) {
  const idx = stageIndex(stage);
  const pct = Math.round(((idx + 1) / ONBOARDING_STAGE_ORDER.length) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-brand-hairline">
        <div
          className={`h-full rounded-full ${stage === "COMPLETE" ? "bg-emerald-500" : "bg-brand-blue"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[11px] tabular-nums text-brand-muted">{pct}%</span>
    </div>
  );
}
