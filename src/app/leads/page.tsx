import { Shell } from "@/components/shell";
import { LeadsFilters } from "@/components/leads-filters";
import { LeadsTable } from "@/components/leads-table";

export const dynamic = "force-dynamic";
export const revalidate = 0;

import { Card } from "@/components/ui";
import { config } from "@/lib/config";
import { listLeads, type LeadsFilter, type LeadsSortKey } from "@/lib/features/leads/queries";
import { listActiveLostReasons, listActiveUsers } from "@/lib/features/users/queries";
import type { Stage } from "@/lib/preview/fixtures";
import Link from "next/link";

type SearchParams = { [k: string]: string | string[] | undefined };

function pick(sp: SearchParams, key: string): string | undefined {
  const v = sp[key];
  if (typeof v === "string" && v.length > 0) return v;
  return undefined;
}

const SORT_COLUMNS: LeadsSortKey[] = [
  "name",
  "niche",
  "service",
  "source",
  "score",
  "stage",
  "arr",
  "created",
  "owner",
  "nextAction",
];

export default async function LeadsListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const rawSort = pick(sp, "sort");
  const sort = SORT_COLUMNS.includes(rawSort as LeadsSortKey)
    ? (rawSort as LeadsSortKey)
    : undefined;
  const dir = pick(sp, "dir") === "asc" ? "asc" : pick(sp, "dir") === "desc" ? "desc" : undefined;

  const filter: LeadsFilter = {
    search: pick(sp, "search"),
    stage: pick(sp, "stage") as Stage | undefined,
    source: pick(sp, "source"),
    grade: pick(sp, "grade") as LeadsFilter["grade"],
    qualification: pick(sp, "qualification") as LeadsFilter["qualification"],
    niche: pick(sp, "niche"),
    serviceInterest: pick(sp, "serviceInterest"),
    urgency: pick(sp, "urgency"),
    sort,
    dir,
  };

  const [leads, lostReasons, users] = await Promise.all([
    listLeads(filter),
    listActiveLostReasons(),
    listActiveUsers(),
  ]);
  const canEdit = config.dbEnabled && config.authEnabled;

  const paramsSnapshot: Record<string, string | undefined> = Object.fromEntries(
    Object.entries(sp)
      .map(([k, v]) => [k, typeof v === "string" ? v : undefined])
      .filter(([, v]) => v !== undefined) as Array<[string, string]>
  );

  return (
    <Shell title="Leads">
      <Card>
        <LeadsFilters />
        <div className="flex items-center justify-between px-5 py-2.5 text-sm text-brand-muted">
          <div className="flex items-center gap-2">
            <span className="font-medium text-brand-navy">{leads.length}</span>
            <span>lead{leads.length === 1 ? "" : "s"}</span>
            {sort ? (
              <span className="ml-2 text-xs">
                sorted by <span className="font-medium text-brand-navy">{sort}</span> ({dir ?? "default"})
              </span>
            ) : null}
          </div>
          <Link
            href="/intake"
            className="rounded-md bg-brand-blue px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-blue-dark"
          >
            + New lead
          </Link>
        </div>
        <LeadsTable
          leads={leads}
          users={users}
          lostReasons={lostReasons}
          currentSort={sort}
          currentDir={dir}
          paramsSnapshot={paramsSnapshot}
          canEdit={canEdit}
        />
      </Card>
    </Shell>
  );
}
