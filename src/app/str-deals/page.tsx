import Link from "next/link";
import { Shell } from "@/components/shell";
import { DecisionBadge } from "@/components/str/decision-badge";
import { Card, CardBody, Pill, RawPill } from "@/components/ui";
import { config } from "@/lib/config";
import { getSTRAccess } from "@/lib/features/str/auth";
import {
  formatMoney,
  formatPercent,
  formatRatio,
  formatLocation,
  STATUS_LABEL,
  type StatusLabel,
  type DecisionLabel,
} from "@/lib/features/str/format";
import { listDeals } from "@/lib/features/str/queries";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function STRDealsListPage() {
  if (!config.dbEnabled || !config.authEnabled) {
    return (
      <Shell title="STR Deals">
        <UnavailableNotice
          title="Database + auth required"
          body="STR deals are stored in the production database; this page is hidden in preview mode."
        />
      </Shell>
    );
  }

  const actor = await getSTRAccess();
  if (!actor) {
    return (
      <Shell title="STR Deals">
        <UnavailableNotice
          title="STR access required"
          body="STR deal underwriting is restricted to admins and managers. Ask an admin to upgrade your role if you need access."
        />
      </Shell>
    );
  }

  const deals = await listDeals();

  return (
    <Shell title="STR Deals">
      <Card>
        <div className="flex items-center justify-between border-b border-brand-hairline/70 px-5 py-3">
          <div className="flex items-center gap-2 text-sm text-brand-muted">
            <span className="font-medium text-brand-navy">{deals.length}</span>
            <span>deal{deals.length === 1 ? "" : "s"}</span>
          </div>
          <Link
            href="/str-deals/new"
            className="rounded-md bg-brand-blue px-3 py-1.5 text-xs font-semibold text-white shadow-btn-primary transition hover:bg-brand-blue-dark"
          >
            + New deal
          </Link>
        </div>
        {deals.length === 0 ? (
          <CardBody>
            <div className="py-10 text-center">
              <div className="text-sm font-medium text-brand-navy">
                No STR deals yet
              </div>
              <p className="mt-1 text-sm text-brand-muted">
                Add a property to start underwriting.
              </p>
              <Link
                href="/str-deals/new"
                className="mt-4 inline-block rounded-md bg-brand-blue px-3 py-1.5 text-xs font-semibold text-white shadow-btn-primary transition hover:bg-brand-blue-dark"
              >
                + Add a deal
              </Link>
            </div>
          </CardBody>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/60 text-[11px] uppercase tracking-wide text-brand-muted">
                <tr>
                  <Th>Deal</Th>
                  <Th>Location</Th>
                  <Th>Status</Th>
                  <Th align="right">Asking</Th>
                  <Th align="right">Gross rev</Th>
                  <Th align="right">Cash flow</Th>
                  <Th align="right">CoC</Th>
                  <Th align="right">DSCR</Th>
                  <Th align="right">Score</Th>
                  <Th>Decision</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-hairline/70">
                {deals.map((d) => (
                  <tr
                    key={d.id}
                    className="hover:bg-brand-blue-tint/30 transition"
                  >
                    <Td>
                      <Link
                        href={`/str-deals/${d.id}`}
                        className="font-medium text-brand-navy hover:text-brand-blue"
                      >
                        {d.dealName}
                      </Link>
                    </Td>
                    <Td>
                      <span className="text-brand-muted">
                        {formatLocation(d.market, d.city, d.state)}
                      </span>
                    </Td>
                    <Td>
                      <Pill tone={statusTone(d.status as StatusLabel)}>
                        {STATUS_LABEL[d.status as StatusLabel] ?? d.status}
                      </Pill>
                    </Td>
                    <Td align="right">{formatMoney(d.askingPrice)}</Td>
                    <Td align="right">{formatMoney(d.baseGrossRevenue)}</Td>
                    <Td align="right">
                      <span className={cashFlowColor(d.baseCashFlow)}>
                        {formatMoney(d.baseCashFlow)}
                      </span>
                    </Td>
                    <Td align="right">{formatPercent(d.baseCashOnCash)}</Td>
                    <Td align="right">{formatRatio(d.baseDscr)}</Td>
                    <Td align="right">
                      {d.score === null ? (
                        <span className="text-brand-muted">—</span>
                      ) : (
                        <RawPill className={scoreColor(d.score)}>
                          {d.score}
                        </RawPill>
                      )}
                    </Td>
                    <Td>
                      <DecisionBadge
                        decision={d.decision as DecisionLabel}
                      />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </Shell>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`px-4 py-2.5 font-semibold ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <td
      className={`px-4 py-2.5 tabular-nums ${
        align === "right" ? "text-right" : ""
      }`}
    >
      {children}
    </td>
  );
}

function cashFlowColor(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "text-brand-muted";
  if (n >= 0) return "text-emerald-700";
  return "text-rose-700";
}

function scoreColor(score: number): string {
  if (score >= 80) return "bg-emerald-50 text-emerald-700 ring-emerald-200/80";
  if (score >= 65) return "bg-sky-50 text-sky-700 ring-sky-200/80";
  if (score >= 50) return "bg-amber-50 text-amber-800 ring-amber-200/80";
  return "bg-rose-50 text-rose-700 ring-rose-200/80";
}

function statusTone(
  status: StatusLabel
): "slate" | "sky" | "amber" | "emerald" | "rose" | "indigo" {
  switch (status) {
    case "NEW":
    case "RESEARCHING":
      return "slate";
    case "UNDERWRITING":
      return "indigo";
    case "OFFER_MADE":
      return "amber";
    case "UNDER_CONTRACT":
      return "sky";
    case "ACQUIRED":
      return "emerald";
    case "PASSED":
      return "rose";
    default:
      return "slate";
  }
}

function UnavailableNotice({ title, body }: { title: string; body: string }) {
  return (
    <Card>
      <CardBody>
        <div className="py-10 text-center">
          <div className="text-sm font-semibold text-brand-navy">{title}</div>
          <p className="mx-auto mt-1 max-w-md text-sm text-brand-muted">{body}</p>
        </div>
      </CardBody>
    </Card>
  );
}
