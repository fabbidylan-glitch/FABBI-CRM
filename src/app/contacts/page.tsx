import { Shell } from "@/components/shell";
import { Card, CardBody, Pill, RawPill } from "@/components/ui";

export const dynamic = "force-dynamic";
export const revalidate = 0;

import { listContacts, type ContactType } from "@/lib/features/contacts/queries";
import {
  STAGE_LABEL,
  formatCurrency,
  formatRelative,
  gradeColor,
  stageColor,
} from "@/lib/preview/fixtures";
import Link from "next/link";

type SearchParams = { [k: string]: string | string[] | undefined };

function pick(sp: SearchParams, key: string): string | undefined {
  const v = sp[key];
  if (typeof v === "string" && v.length > 0) return v;
  return undefined;
}

function buildContactsExportQuery(type: ContactType | undefined, search: string | undefined): string {
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  if (search) params.set("search", search);
  const qs = params.toString();
  return qs ? `/api/contacts/export?${qs}` : "/api/contacts/export";
}

const TYPE_TABS: { v: ContactType | "ALL"; label: string }[] = [
  { v: "ALL", label: "All" },
  { v: "CLIENT", label: "Clients" },
  { v: "PROSPECT", label: "Prospects" },
  { v: "NURTURE", label: "Nurture" },
  { v: "LOST", label: "Lost" },
];

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const typeParam = pick(sp, "type");
  const validTypes: ContactType[] = ["CLIENT", "PROSPECT", "NURTURE", "LOST"];
  const type = validTypes.includes(typeParam as ContactType) ? (typeParam as ContactType) : undefined;
  const search = pick(sp, "search");

  const contacts = await listContacts({ type, search });

  const counts: Record<ContactType | "ALL", number> = {
    ALL: 0,
    CLIENT: 0,
    PROSPECT: 0,
    NURTURE: 0,
    LOST: 0,
  };
  for (const c of await listContacts({ search })) {
    counts[c.type]++;
    counts.ALL++;
  }

  return (
    <Shell title="Contacts">
      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-brand-hairline px-5 py-3">
          <div className="flex items-center gap-1">
            {TYPE_TABS.map((t) => {
              const active = (t.v === "ALL" && !type) || type === t.v;
              const href = t.v === "ALL" ? "/contacts" : `/contacts?type=${t.v}`;
              return (
                <Link
                  key={t.v}
                  href={href}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                    active
                      ? "bg-brand-blue text-white"
                      : "text-brand-navy hover:bg-brand-blue-tint"
                  }`}
                >
                  {t.label} <span className="opacity-60">({counts[t.v]})</span>
                </Link>
              );
            })}
          </div>

          <form action="/contacts" className="ml-auto flex items-center gap-2">
            {type ? <input type="hidden" name="type" value={type} /> : null}
            <input
              type="search"
              name="search"
              defaultValue={search ?? ""}
              placeholder="Search name, email, company…"
              className="w-64 rounded-md border border-brand-hairline bg-white px-3 py-1.5 text-sm text-brand-navy placeholder:text-brand-muted focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
            />
            <Link
              href="/contacts/import"
              className="rounded-md border border-brand-hairline bg-white px-3 py-1.5 text-xs font-medium text-brand-navy hover:bg-brand-blue-tint"
            >
              Import CSV
            </Link>
            <a
              href={buildContactsExportQuery(type, search)}
              className="rounded-md border border-brand-hairline bg-white px-3 py-1.5 text-xs font-medium text-brand-navy hover:bg-brand-blue-tint"
            >
              Export CSV
            </a>
            <Link
              href="/contacts/merge"
              className="rounded-md border border-brand-hairline bg-white px-3 py-1.5 text-xs font-medium text-brand-navy hover:bg-brand-blue-tint"
            >
              Merge
            </Link>
          </form>
        </div>
        <CardBody className="px-0 py-0">
         <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-sm">
            <thead>
              <tr className="border-b border-brand-hairline text-left text-xs uppercase tracking-wide text-brand-muted">
                <th className="px-5 py-2.5 font-medium">Name</th>
                <th className="py-2.5 font-medium">Email / Phone</th>
                <th className="py-2.5 font-medium">Company</th>
                <th className="py-2.5 font-medium">Owner</th>
                <th className="py-2.5 font-medium">Type</th>
                <th className="py-2.5 text-right font-medium">Inquiries</th>
                <th className="py-2.5 font-medium">Latest stage</th>
                <th className="py-2.5 text-right font-medium">Lifetime value</th>
                <th className="px-5 py-2.5 text-right font-medium">Last contact</th>
              </tr>
            </thead>
            <tbody>
              {contacts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-8 text-center text-sm text-brand-muted">
                    No contacts yet. Submit a lead at <code>/intake</code> to populate this list.
                  </td>
                </tr>
              ) : (
                contacts.map((c) => (
                  <tr
                    key={c.latestLeadId}
                    className="group border-b border-brand-hairline/60 last:border-none hover:bg-brand-blue-tint"
                  >
                    <td className="px-5 py-3">
                      <Link
                        href={`/contacts/${encodeURIComponent(c.email)}`}
                        className="flex items-center gap-2"
                      >
                        <span className="font-medium text-brand-navy group-hover:underline">
                          {c.fullName}
                        </span>
                        <RawPill className={gradeColor(c.latestLeadGrade)}>
                          {c.latestLeadGrade}
                        </RawPill>
                      </Link>
                      <Link
                        href={`/leads/${c.latestLeadId}`}
                        className="mt-0.5 block text-[11px] text-brand-muted hover:text-brand-blue"
                      >
                        latest lead →
                      </Link>
                    </td>
                    <td className="py-3 text-xs text-slate-700">
                      <div className="truncate">
                        <a
                          href={`mailto:${c.email}`}
                          className="text-brand-navy hover:text-brand-blue"
                        >
                          {c.email}
                        </a>
                      </div>
                      {c.phone ? (
                        <div className="text-brand-muted">
                          <a href={`tel:${c.phone}`} className="hover:text-brand-navy">
                            {c.phone}
                          </a>
                        </div>
                      ) : null}
                    </td>
                    <td className="py-3 text-slate-700">{c.company ?? "—"}</td>
                    <td className="py-3 text-slate-700">
                      {c.ownerName ?? <span className="text-amber-600">Unassigned</span>}
                    </td>
                    <td className="py-3">
                      <ContactTypePill type={c.type} />
                    </td>
                    <td className="py-3 text-right tabular-nums text-slate-700">{c.leadCount}</td>
                    <td className="py-3">
                      <RawPill className={stageColor(c.latestLeadStage)}>
                        {STAGE_LABEL[c.latestLeadStage]}
                      </RawPill>
                    </td>
                    <td className="py-3 text-right tabular-nums text-slate-700">
                      {c.totalEstimatedValue > 0 ? formatCurrency(c.totalEstimatedValue) : "—"}
                    </td>
                    <td className="px-5 py-3 text-right text-xs text-brand-muted">
                      {c.lastContactedAt ? formatRelative(c.lastContactedAt) : "—"}
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

function ContactTypePill({ type }: { type: ContactType }) {
  switch (type) {
    case "CLIENT":
      return <Pill tone="emerald">Client</Pill>;
    case "PROSPECT":
      return <Pill tone="brand">Prospect</Pill>;
    case "NURTURE":
      return <Pill tone="slate">Nurture</Pill>;
    case "LOST":
      return <Pill tone="rose">Lost</Pill>;
  }
}
