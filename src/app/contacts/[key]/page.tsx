import { Shell } from "@/components/shell";
import { Card, CardBody, CardHeader, Pill, RawPill } from "@/components/ui";

export const dynamic = "force-dynamic";
export const revalidate = 0;

import { getContactDetail } from "@/lib/features/contacts/detail";
import {
  STAGE_LABEL,
  formatCurrency,
  formatRelative,
  gradeColor,
  stageColor,
} from "@/lib/preview/fixtures";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const contact = await getContactDetail(decodeURIComponent(key));
  if (!contact) return notFound();

  const phoneE164 = contact.phone ? normalizePhone(contact.phone) : null;

  return (
    <Shell title={contact.fullName}>
      <div className="mb-4 flex items-center gap-3 text-sm text-brand-muted">
        <Link href="/contacts" className="hover:text-brand-navy">← All contacts</Link>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardBody>
              <div className="flex items-start justify-between gap-6">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-semibold tracking-tight text-brand-navy">
                      {contact.fullName}
                    </h2>
                    <ContactTypePill type={contact.type} />
                  </div>
                  {contact.company ? (
                    <div className="mt-1 text-sm text-brand-muted">{contact.company}</div>
                  ) : null}
                </div>
                <div className="text-right text-sm">
                  <div className="text-[11px] uppercase tracking-wide text-brand-muted">Lifetime value</div>
                  <div className="text-2xl font-semibold text-brand-navy tabular-nums">
                    {contact.totalEstimatedValue > 0 ? formatCurrency(contact.totalEstimatedValue) : "—"}
                  </div>
                </div>
              </div>

              <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-brand-hairline pt-5 text-sm md:grid-cols-4">
                <Field label="Email" value={contact.email} href={`mailto:${contact.email}`} />
                <Field
                  label="Phone"
                  value={contact.phone ?? "—"}
                  href={phoneE164 ? `tel:${phoneE164}` : undefined}
                />
                <Field label="Owner" value={contact.ownerName ?? "Unassigned"} />
                <Field label="First seen" value={formatRelative(contact.firstSeenAt)} />
                <Field label="Inquiries" value={String(contact.leads.length)} />
                <Field
                  label="Last contact"
                  value={contact.lastContactedAt ? formatRelative(contact.lastContactedAt) : "—"}
                />
                <Field label="Communications" value={String(contact.communications.length)} />
                <Field label="Notes" value={String(contact.notes.length)} />
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Inquiries" action={<span className="text-xs text-brand-muted">{contact.leads.length}</span>} />
            <CardBody className="px-0 py-0">
              <ul className="divide-y divide-brand-hairline">
                {contact.leads.map((l) => (
                  <li key={l.leadId}>
                    <Link
                      href={`/leads/${l.leadId}`}
                      className="flex items-center justify-between px-5 py-3 hover:bg-brand-blue-tint"
                    >
                      <div className="flex items-center gap-3">
                        <RawPill className={gradeColor(l.grade)}>{l.grade}</RawPill>
                        <RawPill className={stageColor(l.stage)}>{STAGE_LABEL[l.stage]}</RawPill>
                        <span className="text-sm text-brand-navy">{prettyEnum(l.serviceInterest)}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-brand-muted">
                        <span>{prettyEnum(l.source)}</span>
                        <span className="tabular-nums text-slate-700">
                          {l.estimatedAnnualValue ? formatCurrency(l.estimatedAnnualValue) : "—"}
                        </span>
                        <span>{formatRelative(l.createdAt)}</span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Merged timeline" action={<span className="text-xs text-brand-muted">{contact.timeline.length} events</span>} />
            <CardBody>
              {contact.timeline.length === 0 ? (
                <p className="text-sm text-brand-muted">No activity yet.</p>
              ) : (
                <ol className="relative space-y-5 border-l border-brand-hairline pl-5">
                  {contact.timeline.map((t) => (
                    <li key={t.id} className="relative">
                      <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white bg-brand-blue ring-1 ring-brand-blue-soft" />
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium text-brand-navy">{t.title}</span>
                        <Link
                          href={`/leads/${t.leadId}`}
                          className="text-[11px] text-brand-muted hover:text-brand-blue"
                        >
                          · lead
                        </Link>
                      </div>
                      <div className="mt-0.5 text-xs text-brand-muted">
                        {t.actor} · {formatRelative(t.at)}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Communications" />
            <CardBody className="px-0 py-0">
              {contact.communications.length === 0 ? (
                <div className="px-5 py-4 text-sm text-brand-muted">No communications yet.</div>
              ) : (
                <ul className="divide-y divide-brand-hairline">
                  {contact.communications.map((c) => (
                    <li key={c.id} className="px-5 py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Pill tone={c.direction === "OUTBOUND" ? "slate" : "brand"}>
                            {c.direction === "OUTBOUND" ? "→" : "←"} {c.channel}
                          </Pill>
                          {c.subject ? (
                            <span className="text-sm font-medium text-brand-navy">{c.subject}</span>
                          ) : null}
                        </div>
                        <span className="text-[11px] text-brand-muted">{formatRelative(c.at)}</span>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">{c.preview}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Notes" />
            <CardBody className="px-0 py-0">
              {contact.notes.length === 0 ? (
                <div className="px-5 py-4 text-sm text-brand-muted">No notes yet.</div>
              ) : (
                <ul className="divide-y divide-brand-hairline">
                  {contact.notes.map((n) => (
                    <li key={n.id} className="px-5 py-3">
                      <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-brand-muted">
                        <span>{n.author}</span>
                        <span>{formatRelative(n.at)}</span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-brand-navy">{n.body}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
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

function ContactTypePill({ type }: { type: "CLIENT" | "PROSPECT" | "NURTURE" | "LOST" }) {
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

function prettyEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function normalizePhone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 11) return `+${digits}`;
  return null;
}
