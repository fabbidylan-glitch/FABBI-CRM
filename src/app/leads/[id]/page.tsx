import { Shell } from "@/components/shell";
import { ConsultOutcomeButtons } from "@/components/consult-outcome-buttons";
import { LeadEditModal } from "@/components/lead-edit-modal";
import { LeadNextAction } from "@/components/lead-next-action";
import { LeadNotesCard } from "@/components/lead-notes-card";

export const dynamic = "force-dynamic";
export const revalidate = 0;

import { LeadOwnerControl } from "@/components/lead-owner-control";
import { LeadSendActions } from "@/components/lead-send-actions";
import { LeadStageControl } from "@/components/lead-stage-control";
import { LeadTasksCard } from "@/components/lead-tasks-card";
import { Card, CardBody, CardHeader, Pill, RawPill } from "@/components/ui";
import { config } from "@/lib/config";
import { getLead } from "@/lib/features/leads/queries";
import { listSendableTemplates } from "@/lib/features/leads/templates";
import {
  listActiveLostReasons,
  listActiveUsers,
} from "@/lib/features/users/queries";
import {
  STAGE_LABEL,
  formatCurrency,
  formatRelative,
  gradeColor,
  stageColor,
  type Stage,
} from "@/lib/preview/fixtures";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [data, allTemplates, users, lostReasons] = await Promise.all([
    getLead(id),
    listSendableTemplates(),
    listActiveUsers(),
    listActiveLostReasons(),
  ]);
  if (!data) return notFound();
  const { lead, ownerUserId, timeline, communications, tasks, notes, scoreBreakdown, hasUnansweredInbound } = data;
  const emailTemplates = allTemplates.filter((t) => t.channel === "EMAIL");
  const whatsappTemplates = allTemplates.filter((t) => t.channel === "WHATSAPP");
  const smsTemplates = allTemplates.filter((t) => t.channel === "SMS");
  const phoneE164 = normalizeE164(lead.phone);
  const canEdit = config.dbEnabled && config.authEnabled;
  const calendlyUrl = process.env.CALENDLY_DEFAULT_EVENT_URL;

  return (
    <Shell title={`${lead.firstName} ${lead.lastName}`}>
      <div className="mb-4 flex items-center gap-3 text-sm text-brand-muted">
        <Link href="/leads" className="hover:text-brand-navy">← All leads</Link>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardBody>
              <div className="flex items-start justify-between gap-6">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-semibold tracking-tight text-brand-navy">
                      {lead.firstName} {lead.lastName}
                    </h2>
                    <RawPill className={gradeColor(lead.grade)}>{lead.grade}</RawPill>
                    <RawPill className={stageColor(lead.stage)}>{STAGE_LABEL[lead.stage]}</RawPill>
                  </div>
                  <div className="mt-1 text-sm text-brand-muted">
                    {lead.niche} · {lead.serviceInterest}
                  </div>
                  {lead.painPoint ? (
                    <p className="mt-3 max-w-2xl rounded-md border border-brand-hairline bg-brand-blue-tint px-3 py-2 text-sm text-brand-navy">
                      {lead.painPoint}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="flex items-center gap-1.5">
                    <LeadEditModal
                      leadId={lead.id}
                      initial={{
                        firstName: lead.firstName,
                        lastName: lead.lastName,
                        email: lead.email,
                        phone: lead.phone,
                        companyName: lead.companyName,
                        painPoint: lead.painPoint,
                        estimatedAnnualValue: lead.estimatedAnnualValue,
                      }}
                      canEdit={canEdit}
                    />
                    {canEdit ? (
                      <LeadStageControl
                        leadId={lead.id}
                        currentStage={lead.stage as Stage}
                        lostReasons={lostReasons}
                      />
                    ) : (
                      <button
                        disabled
                        title="Database + auth required"
                        className="rounded-md bg-brand-blue px-3 py-1.5 text-xs font-semibold text-white opacity-60"
                      >
                        Advance stage
                      </button>
                    )}
                  </div>
                  <LeadSendActions
                    leadId={lead.id}
                    phoneE164={phoneE164}
                    emailEnabled={config.emailEnabled}
                    whatsappEnabled={config.whatsappEnabled}
                    smsEnabled={config.smsEnabled}
                    dbEnabled={config.dbEnabled}
                    authEnabled={config.authEnabled}
                    emailTemplates={emailTemplates}
                    whatsappTemplates={whatsappTemplates}
                    smsTemplates={smsTemplates}
                  />
                </div>
              </div>

              <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-brand-hairline pt-5 text-sm md:grid-cols-4">
                <Field label="Email" value={lead.email} href={lead.email ? `mailto:${lead.email}` : undefined} />
                <Field label="Phone" value={lead.phone} href={phoneE164 ? `tel:${phoneE164}` : undefined} />
                <Field
                  label="Source"
                  value={`${lead.source}${lead.campaignName ? ` · ${lead.campaignName}` : ""}`}
                />
                {canEdit ? (
                  <LeadOwnerControl leadId={lead.id} currentOwnerId={ownerUserId} users={users} />
                ) : (
                  <Field label="Owner" value={lead.ownerName ?? "Unassigned"} />
                )}
                <Field label="Revenue" value={lead.annualRevenueRange} />
                <Field label="Taxes paid" value={lead.taxesPaidLastYearRange} />
                <Field label="Properties" value={lead.propertyCount} />
                <Field label="Urgency" value={lead.urgency} />
                <Field label="Fit" value={lead.fitType} />
                <Field label="States" value={lead.states.length ? lead.states.join(", ") : "—"} />
                <Field
                  label="Complexity"
                  value={
                    [
                      lead.w2IncomeFlag && "W-2",
                      lead.payrollFlag && "Payroll",
                      lead.otherBusinessIncomeFlag && "Other biz",
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"
                  }
                />
                <Field
                  label="Est. annual value"
                  value={lead.estimatedAnnualValue ? formatCurrency(lead.estimatedAnnualValue) : "—"}
                />
              </dl>
            </CardBody>
          </Card>

          <LeadNotesCard leadId={lead.id} notes={notes} canEdit={canEdit} />

          <Card>
            <CardHeader title="Timeline" />
            <CardBody>
              {timeline.length === 0 ? (
                <p className="text-sm text-brand-muted">No activity yet.</p>
              ) : (
                <ol className="relative space-y-5 border-l border-brand-hairline pl-5">
                  {timeline.map((t, idx) => (
                    <li key={idx} className="relative">
                      <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white bg-brand-blue ring-1 ring-brand-blue-soft" />
                      <div className="text-sm font-medium text-brand-navy">{t.title}</div>
                      {t.body ? <div className="mt-1 text-sm text-slate-600">{t.body}</div> : null}
                      <div className="mt-1 text-xs text-brand-muted">
                        {t.actor ?? "System"} · {formatRelative(t.at)}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Communications" />
            <CardBody className="px-0 py-0">
              {communications.length === 0 ? (
                <div className="px-5 py-4 text-sm text-brand-muted">No communications yet.</div>
              ) : (
                <ul className="divide-y divide-brand-hairline">
                  {communications.map((c, idx) => (
                    <li key={idx} className="px-5 py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Pill tone={c.direction === "OUTBOUND" ? "slate" : "brand"}>
                            {c.direction === "OUTBOUND" ? "→" : "←"} {c.channel}
                          </Pill>
                          {c.subject ? (
                            <span className="text-sm font-medium text-brand-navy">{c.subject}</span>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-brand-muted">
                          <Pill tone={c.status === "FAILED" ? "rose" : c.status === "REPLIED" ? "emerald" : "slate"}>
                            {c.status}
                          </Pill>
                          <span>{formatRelative(c.at)}</span>
                        </div>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">{c.preview}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <LeadNextAction
            stage={lead.stage as Stage}
            grade={lead.grade}
            lastStageChangeAt={lead.lastStageChangeAt}
            nextTaskTitle={tasks[0]?.title}
            nextTaskDueAt={tasks[0]?.dueAt}
            nextTaskId={tasks[0]?.id}
            ownerName={lead.ownerName}
            estimatedAnnualValue={lead.estimatedAnnualValue}
            phoneE164={phoneE164}
            email={lead.email}
            hasUnansweredInbound={hasUnansweredInbound}
          />

          {lead.stage === "CONSULT_BOOKED" ? (
            <ConsultOutcomeButtons leadId={lead.id} canEdit={canEdit} />
          ) : null}

          <Card>
            <CardHeader title="Score breakdown" action={<span className="text-xs text-brand-muted">Rules v1</span>} />
            <CardBody className="space-y-3">
              <div className="flex items-end justify-between">
                <div className="text-4xl font-semibold text-brand-navy tabular-nums">{lead.score}</div>
                <RawPill className={gradeColor(lead.grade)}>Grade {lead.grade}</RawPill>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-brand-blue-tint">
                <div
                  className="h-full rounded-full bg-brand-blue"
                  style={{ width: `${Math.min(100, lead.score)}%` }}
                />
              </div>
              {scoreBreakdown ? (
                <>
                  <ScoreRow label="Revenue" value={scoreBreakdown.revenueScore} />
                  <ScoreRow label="Taxes paid" value={scoreBreakdown.taxScore} />
                  <ScoreRow label="Service interest" value={scoreBreakdown.serviceScore} />
                  <ScoreRow label="Niche fit" value={scoreBreakdown.fitScore} />
                  <ScoreRow label="Urgency" value={scoreBreakdown.urgencyScore} />
                  <ScoreRow label="Source quality" value={scoreBreakdown.sourceScore} />
                  <ScoreRow label="Complexity" value={scoreBreakdown.complexityScore} />
                  {scoreBreakdown.bookedConsultScore > 0 ? (
                    <ScoreRow
                      label="Consult booked bonus"
                      value={scoreBreakdown.bookedConsultScore}
                    />
                  ) : null}
                </>
              ) : (
                <div className="text-xs text-brand-muted">
                  No score breakdown recorded yet.
                </div>
              )}
            </CardBody>
          </Card>

          <LeadTasksCard leadId={lead.id} tasks={tasks} canEdit={canEdit} />

          <Card>
            <CardHeader title="Attribution" />
            <CardBody className="space-y-2 text-sm">
              <Row label="Source" value={lead.source} />
              {lead.campaignName ? <Row label="Campaign" value={lead.campaignName} /> : null}
              <Row label="Niche" value={lead.niche} />
              <Row label="Fit" value={lead.fitType} />
              <Row label="Created" value={formatRelative(lead.createdAt)} />
              {lead.lastContactedAt ? (
                <Row label="Last contact" value={formatRelative(lead.lastContactedAt)} />
              ) : null}
              {lead.nextActionAt ? (
                <Row label="Next action" value={formatRelative(lead.nextActionAt)} />
              ) : null}
            </CardBody>
          </Card>

          {calendlyUrl ? (
            <Card>
              <CardHeader title="Share booking link" />
              <CardBody className="space-y-2 text-sm">
                <a
                  href={calendlyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block truncate rounded-md border border-brand-hairline bg-brand-blue-tint px-3 py-2 font-mono text-xs text-brand-blue hover:border-brand-blue-soft"
                  title={calendlyUrl}
                >
                  {calendlyUrl}
                </a>
                <div className="flex gap-2">
                  <a
                    href={calendlyUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 rounded-md bg-brand-blue px-3 py-1.5 text-center text-xs font-semibold text-white hover:bg-brand-blue-dark"
                  >
                    Open Calendly ↗
                  </a>
                  {lead.email ? (
                    <a
                      href={`mailto:${lead.email}?subject=${encodeURIComponent(
                        "Let's find a time to chat"
                      )}&body=${encodeURIComponent(
                        `Hi ${lead.firstName},\n\nGrab a 20-min slot that works for you: ${calendlyUrl}\n\nTalk soon,\nDylan`
                      )}`}
                      className="flex-1 rounded-md border border-brand-hairline bg-white px-3 py-1.5 text-center text-xs font-medium text-brand-navy hover:bg-brand-blue-tint"
                    >
                      Email it to {lead.firstName}
                    </a>
                  ) : null}
                </div>
                <p className="text-[11px] text-brand-muted">
                  Or use the Email / SMS buttons above with the &quot;Qualified — schedule
                  consult&quot; template, which auto-inserts this link.
                </p>
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </Shell>
  );
}

function Field({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-brand-muted">{label}</dt>
      <dd className="mt-0.5 text-brand-navy">
        {href ? (
          <a href={href} className="underline decoration-brand-hairline underline-offset-2 hover:decoration-brand-blue">
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

function ScoreRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-brand-muted">{label}</span>
      <span className="tabular-nums font-medium text-brand-navy">+{value}</span>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-brand-muted">{label}</span>
      <span className="text-brand-navy">{value}</span>
    </div>
  );
}

function normalizeE164(raw?: string): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 11) return `+${digits}`;
  return null;
}
