import { auth } from "@clerk/nextjs/server";
import { ActivityFeed } from "@/components/activity-feed";
import {
  OverdueTasksCard,
  StuckLeadsCard,
} from "@/components/accountability-widgets";
import { IntegrationsStatus } from "@/components/integrations-status";
import { LiveRefresh } from "@/components/live-refresh";
import { Shell } from "@/components/shell";
import { config as appConfig } from "@/lib/config";
import { prisma } from "@/lib/db";
import {
  countUnassignedLeads,
  getOverdueTasks,
  getStuckLeads,
} from "@/lib/features/dashboard/accountability";
import { listActiveUsers } from "@/lib/features/users/queries";

// Never cache the dashboard — every render should pull fresh counts. Without
// this, Next's full-route cache + client Router Cache can serve stale KPIs
// after a lead is added or edited.
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { Card, CardBody, CardHeader, Pill, Stat } from "@/components/ui";
import { listRecentActivity } from "@/lib/features/activity/queries";
import {
  getDashboardKpis,
  getOpenTasks,
  getRecentLeads,
  getSourcePerformance,
} from "@/lib/features/dashboard/queries";
import { formatCurrency, formatRelative, gradeColor } from "@/lib/preview/fixtures";
import Link from "next/link";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const sp = await searchParams;
  const isMyView = sp.view === "me";

  // Resolve the current user's internal id when the "My Day" filter is on.
  let meUserId: string | undefined;
  if (isMyView && appConfig.authEnabled) {
    const session = await auth();
    if (session.userId) {
      const me = await prisma.user.findFirst({
        where: { externalId: session.userId },
        select: { id: true },
      });
      meUserId = me?.id;
    }
  }
  const [
    kpis,
    sourcePerf,
    recent,
    tasks,
    activity,
    overdueTasks,
    stuckLeads,
    unassignedCount,
    users,
  ] = await Promise.all([
    getDashboardKpis(),
    getSourcePerformance(),
    getRecentLeads(5),
    getOpenTasks(),
    listRecentActivity(25),
    getOverdueTasks(15, meUserId ? { assignedUserId: meUserId } : {}),
    getStuckLeads(10, meUserId ? { ownerUserId: meUserId } : {}),
    countUnassignedLeads(),
    listActiveUsers(),
  ]);

  return (
    <Shell title={isMyView ? "My Day" : "Dashboard"}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 rounded-lg border border-brand-hairline bg-white p-0.5">
          <Link
            href="/"
            scroll={false}
            className={`rounded-md px-3 py-1 text-xs font-medium transition ${
              !isMyView
                ? "bg-brand-navy text-white"
                : "text-brand-muted hover:text-brand-navy"
            }`}
          >
            Team
          </Link>
          <Link
            href="/?view=me"
            scroll={false}
            className={`rounded-md px-3 py-1 text-xs font-medium transition ${
              isMyView
                ? "bg-brand-navy text-white"
                : "text-brand-muted hover:text-brand-navy"
            }`}
          >
            My Day
          </Link>
        </div>
        <LiveRefresh />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Leads this month"
          value={String(kpis.leadsThisMonth)}
          hint="All sources"
          tooltip="Count of Lead records created in the current calendar month, any source."
        />
        <Stat
          label="Qualified"
          value={String(kpis.qualifiedThisMonth)}
          hint={
            kpis.leadsThisMonth > 0
              ? `${Math.round((kpis.qualifiedThisMonth / kpis.leadsThisMonth) * 100)}% qualification rate`
              : "—"
          }
          tooltip="Leads created this month whose scoring result was QUALIFIED. Manual qualification overrides in the admin UI also count."
        />
        <Stat
          label="Consults booked"
          value={String(kpis.consultsBookedThisMonth)}
          hint={`${Math.round(kpis.showRate * 100)}% show rate`}
          tooltip="Stage transitions INTO Consult Booked this month — drag/drop, pill dropdown, and Calendly webhook all count. Show rate = leads that progressed to Consult Completed in last 30 days."
        />
        <Stat
          label="Proposals sent"
          value={String(kpis.proposalsSent)}
          hint={`${Math.round(kpis.closeRate * 100)}% close rate`}
          tooltip="Stage transitions INTO Proposal Sent this month (manual or via Anchor webhook). Close rate = Won / Proposals Sent."
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Won this month"
          value={String(kpis.wonThisMonth)}
          hint={`${formatCurrency(kpis.wonArrThisMonth)} new ARR`}
          tooltip="Stage transitions INTO Won this month. ARR is the sum of each won lead's estimated annual value."
        />
        <Stat
          label="Pipeline value"
          value={formatCurrency(kpis.pipelineValue)}
          hint="Open weighted ARR"
          tooltip="Sum of estimatedAnnualValue for every active lead not yet Won/Lost/Cold Nurture."
        />
        <Stat
          label="Avg response time"
          value={`${kpis.avgResponseMinutes}m`}
          hint="A-leads SLA: < 5m"
          tooltip="Average minutes between Lead creation and the first outbound communication, across leads in the last 30 days. 0 if no outbound has been sent yet."
        />
        <Stat
          label="Open tasks"
          value={String(tasks.length)}
          hint="Today + overdue"
          tooltip="Tasks with status OPEN or IN_PROGRESS, assigned to anyone. Tasks auto-created by sequences count the same as ones you add manually."
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <OverdueTasksCard
          tasks={overdueTasks}
          unassignedCount={unassignedCount}
          users={users.map((u) => ({ id: u.id, name: u.name }))}
        />
        <StuckLeadsCard leads={stuckLeads} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Source performance"
            action={<span className="text-xs text-brand-muted">Last 30 days</span>}
          />
          <CardBody className="px-0 py-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-hairline text-left text-xs uppercase tracking-wide text-brand-muted">
                  <th className="px-5 py-2 font-medium">Source</th>
                  <th className="py-2 text-right font-medium">Leads</th>
                  <th className="py-2 text-right font-medium">Qualified</th>
                  <th className="py-2 text-right font-medium">Proposals</th>
                  <th className="py-2 text-right font-medium">Won ARR</th>
                  <th className="px-5 py-2 text-right font-medium">CPL</th>
                </tr>
              </thead>
              <tbody>
                {sourcePerf.map((s) => {
                  const cpl = s.spend > 0 && s.leads > 0 ? s.spend / s.leads : null;
                  return (
                    <tr key={s.source} className="border-b border-brand-hairline/60 last:border-none">
                      <td className="px-5 py-2.5 text-brand-navy">{s.source}</td>
                      <td className="py-2.5 text-right tabular-nums text-slate-700">{s.leads}</td>
                      <td className="py-2.5 text-right tabular-nums text-slate-700">{s.qualified}</td>
                      <td className="py-2.5 text-right tabular-nums text-slate-700">{s.proposals}</td>
                      <td className="py-2.5 text-right tabular-nums text-emerald-700">
                        {s.wonArr > 0 ? formatCurrency(s.wonArr) : "—"}
                      </td>
                      <td className="px-5 py-2.5 text-right tabular-nums text-brand-muted">
                        {cpl !== null ? formatCurrency(cpl) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Recent leads"
            action={
              <Link href="/leads" className="text-xs text-brand-muted hover:text-brand-navy">
                View all →
              </Link>
            }
          />
          <CardBody className="px-0 py-0">
            <ul className="divide-y divide-brand-hairline">
              {recent.map((l) => (
                <li key={l.id}>
                  <Link
                    href={`/leads/${l.id}`}
                    className="flex items-center justify-between px-5 py-3 hover:bg-brand-blue-tint"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-brand-navy">
                        {l.firstName} {l.lastName}
                      </div>
                      <div className="truncate text-xs text-brand-muted">
                        {l.niche} · {l.source}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${gradeColor(l.grade)}`}
                      >
                        {l.grade}
                      </span>
                      <span className="text-xs text-brand-muted">{formatRelative(l.createdAt)}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ActivityFeed items={activity} />
        <IntegrationsStatus />
        <Card>
          <CardHeader title="Tasks due" />
          <CardBody className="px-0 py-0">
            <ul className="divide-y divide-brand-hairline">
              {tasks.map((t) => (
                <li key={t.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <Pill tone={t.priority === "URGENT" ? "rose" : t.priority === "HIGH" ? "amber" : "slate"}>
                      {t.priority}
                    </Pill>
                    <div>
                      <div className="text-sm font-medium text-brand-navy">{t.title}</div>
                      <div className="text-xs text-brand-muted">
                        {t.assignee} · due {formatRelative(t.dueAt)}
                      </div>
                    </div>
                  </div>
                  {t.leadId ? (
                    <Link href={`/leads/${t.leadId}`} className="text-xs text-brand-muted hover:text-brand-navy">
                      Open lead →
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>
    </Shell>
  );
}
