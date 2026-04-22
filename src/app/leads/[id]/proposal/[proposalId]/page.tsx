import { Shell } from "@/components/shell";
import { EditableProposal } from "@/components/editable-proposal";
import { OpenInAnchorButton } from "@/components/open-in-anchor-button";
import { ProposalActions } from "@/components/proposal-actions";
import { QuickPasteFields } from "@/components/quick-paste-fields";
import { computeDiscount } from "@/lib/features/proposals/discount";
import { formatScopeForAnchor } from "@/lib/features/proposals/format-scope";

export const dynamic = "force-dynamic";
export const revalidate = 0;

import { Card, CardBody, Pill } from "@/components/ui";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function ProposalPage({
  params,
}: {
  params: Promise<{ id: string; proposalId: string }>;
}) {
  const { id, proposalId } = await params;

  if (!config.dbEnabled) return notFound();

  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    include: {
      lead: true,
      quote: true,
      lineItems: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!proposal || proposal.leadId !== id) return notFound();

  const canEdit = config.dbEnabled && config.authEnabled;

  const monthlyLines = proposal.lineItems.filter((li) => li.monthlyAmount && Number(li.monthlyAmount) > 0);
  const onetimeLines = proposal.lineItems.filter((li) => li.onetimeAmount && Number(li.onetimeAmount) > 0);
  const monthlySubtotal = monthlyLines.reduce((sum, li) => sum + Number(li.monthlyAmount ?? 0), 0);
  const onetimeSubtotal = onetimeLines.reduce((sum, li) => sum + Number(li.onetimeAmount ?? 0), 0);
  const discountResult = computeDiscount(monthlySubtotal, onetimeSubtotal, {
    discountLabel: proposal.discountLabel,
    discountAmount: proposal.discountAmount ? Number(proposal.discountAmount) : null,
    discountPct: proposal.discountPct ? Number(proposal.discountPct) : null,
    discountAppliesTo: proposal.discountAppliesTo,
  });
  const monthlyTotal = Math.max(0, monthlySubtotal - discountResult.monthly);
  const onetimeTotal = Math.max(0, onetimeSubtotal - discountResult.onetime);

  // Pre-format the scope once on the server so the "Open in Anchor" button can
  // copy it to the clipboard without any client-side formatting dependencies.
  const anchorClipboardText = formatScopeForAnchor({
    clientName: `${proposal.lead.firstName ?? ""} ${proposal.lead.lastName ?? ""}`.trim() || null,
    companyName: proposal.lead.companyName ?? null,
    scopeSummary: proposal.scopeSummary,
    lineItems: proposal.lineItems.map((li) => ({
      description: li.description,
      monthlyAmount: li.monthlyAmount !== null ? Number(li.monthlyAmount) : null,
      onetimeAmount: li.onetimeAmount !== null ? Number(li.onetimeAmount) : null,
    })),
    discount: {
      label: proposal.discountLabel,
      amount: proposal.discountAmount ? Number(proposal.discountAmount) : null,
      pct: proposal.discountPct ? Number(proposal.discountPct) : null,
      appliesTo: proposal.discountAppliesTo,
    },
  });

  return (
    <Shell title={`Proposal — ${proposal.lead.firstName} ${proposal.lead.lastName}`}>
      <div className="mb-4 flex items-center gap-2 text-xs text-brand-muted">
        <Link
          href={`/leads/${proposal.leadId}`}
          className="inline-flex items-center gap-1 rounded-md border border-transparent px-1.5 py-0.5 transition hover:border-brand-hairline hover:bg-white hover:text-brand-navy"
        >
          <span aria-hidden>←</span> {proposal.lead.firstName} {proposal.lead.lastName}
        </Link>
        <span aria-hidden className="text-brand-hairline">/</span>
        <span className="text-brand-navy/70">Proposal</span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-brand-blue via-brand-blue-dark to-brand-navy" />
            <CardBody>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-muted">
                    Proposal
                  </div>
                  <h2 className="mt-1 text-2xl font-semibold tracking-[-0.01em] text-brand-navy">
                    {proposal.lead.firstName} {proposal.lead.lastName}
                    {proposal.lead.companyName ? ` · ${proposal.lead.companyName}` : ""}
                  </h2>
                  {proposal.scopeSummary ? (
                    <p className="mt-2 max-w-2xl text-sm text-brand-muted">{proposal.scopeSummary}</p>
                  ) : null}
                </div>
                <ProposalStatusPill status={proposal.proposalStatus} />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-brand-navy">Scope of services</h3>
                <div className="flex items-center gap-3 text-[11px] text-brand-muted">
                  {proposal.proposalStatus === "DRAFT" ? (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200/80">
                      Editable
                    </span>
                  ) : null}
                  {proposal.quote ? (
                    <span>
                      Complexity:{" "}
                      <span className="font-semibold text-brand-navy">
                        {proposal.quote.complexityLevel.replaceAll("_", " ")}
                      </span>
                    </span>
                  ) : null}
                </div>
              </div>

              <EditableProposal
                proposalId={proposal.id}
                scopeSummary={proposal.scopeSummary}
                isEditable={proposal.proposalStatus === "DRAFT" && canEdit}
                signingUrl={proposal.signingUrl}
                discount={{
                  label: proposal.discountLabel,
                  amount: proposal.discountAmount ? Number(proposal.discountAmount) : null,
                  pct: proposal.discountPct ? Number(proposal.discountPct) : null,
                  appliesTo: proposal.discountAppliesTo,
                }}
                items={proposal.lineItems.map((li) => ({
                  id: li.id,
                  kind: li.kind,
                  description: li.description,
                  monthlyAmount: li.monthlyAmount !== null ? Number(li.monthlyAmount) : null,
                  onetimeAmount: li.onetimeAmount !== null ? Number(li.onetimeAmount) : null,
                  quantity: li.quantity,
                }))}
              />
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <h3 className="mb-2 text-sm font-semibold text-brand-navy">Assumptions + next steps</h3>
              <ul className="space-y-1.5 text-sm text-brand-muted">
                <li>• Engagement begins month of signature; first deliverables within 15 business days.</li>
                <li>• Pricing holds for 30 days from send date.</li>
                <li>• Cleanup work (if any) is billed one-time and must be complete before recurring service begins.</li>
                <li>• Tax filings are billed separately per entity.</li>
                <li>• Either party can terminate with 30 days written notice.</li>
              </ul>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardBody>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-muted">
                Pricing summary
              </div>
              <div className="mt-2 text-3xl font-semibold tracking-tight tabular-nums text-brand-navy">
                ${monthlyTotal.toLocaleString()}/mo
              </div>
              {discountResult.totalDollars > 0 ? (
                <div className="mt-1 text-[11px] font-medium text-emerald-700">
                  {discountResult.label}
                </div>
              ) : null}
              {onetimeTotal > 0 ? (
                <div className="mt-1 text-xs text-brand-muted">
                  + <span className="tabular-nums">${onetimeTotal.toLocaleString()}</span> one-time
                </div>
              ) : null}
              {proposal.quote ? (
                <div className="mt-3 flex items-center gap-3 text-[11px] text-brand-muted">
                  <span>
                    Floor <span className="tabular-nums text-brand-navy">${Number(proposal.quote.floorPrice).toLocaleString()}</span>
                  </span>
                  <span>
                    Stretch <span className="tabular-nums text-brand-navy">${Number(proposal.quote.stretchPrice).toLocaleString()}</span>
                  </span>
                </div>
              ) : null}
            </CardBody>
          </Card>

          {proposal.proposalStatus === "DRAFT" && canEdit ? (
            <Card>
              <CardBody className="space-y-4">
                <OpenInAnchorButton
                  scopeText={anchorClipboardText}
                  anchorUrl={config.anchorNewProposalUrl}
                />
                <div className="border-t border-brand-hairline pt-4">
                  <QuickPasteFields
                    fields={[
                      {
                        label: "Client first name",
                        value: proposal.lead.firstName ?? "",
                      },
                      {
                        label: "Client last name",
                        value: proposal.lead.lastName ?? "",
                      },
                      {
                        label: "Full name",
                        value:
                          `${proposal.lead.firstName ?? ""} ${proposal.lead.lastName ?? ""}`.trim(),
                      },
                      {
                        label: "Email",
                        value: proposal.lead.email ?? "",
                      },
                      {
                        label: "Phone",
                        value: proposal.lead.phone ?? "",
                      },
                      {
                        label: "Company",
                        value: proposal.lead.companyName ?? "",
                      },
                      {
                        label: "Monthly total",
                        value: String(monthlyTotal),
                        preview: `$${monthlyTotal.toLocaleString()}/mo`,
                      },
                      {
                        label: "One-time total",
                        value: String(onetimeTotal),
                        preview:
                          onetimeTotal > 0 ? `$${onetimeTotal.toLocaleString()}` : "—",
                      },
                      {
                        label: "Scope summary",
                        value: proposal.scopeSummary ?? "",
                      },
                      {
                        label: "Full scope (with line items)",
                        value: anchorClipboardText,
                        preview: "Click to copy full scope block",
                      },
                    ]}
                  />
                </div>
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardBody>
              <ProposalActions
                proposalId={proposal.id}
                leadId={proposal.leadId}
                status={proposal.proposalStatus}
                canEdit={canEdit}
                sentAt={proposal.sentAt ? proposal.sentAt.toISOString() : null}
                acceptedAt={proposal.acceptedAt ? proposal.acceptedAt.toISOString() : null}
                declinedAt={proposal.declinedAt ? proposal.declinedAt.toISOString() : null}
                declineReason={proposal.declineReason ?? null}
                anchorEnabled={config.anchorOutboundEnabled}
                hasSigningUrl={Boolean(proposal.signingUrl)}
              />
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <h3 className="text-sm font-semibold text-brand-navy">Lead</h3>
              <dl className="mt-2 space-y-1 text-xs">
                <Row label="Email" value={proposal.lead.email} />
                <Row label="Phone" value={proposal.lead.phone} />
                <Row label="Source" value={proposal.lead.source} />
                <Row label="Stage" value={proposal.lead.pipelineStage} />
                <Row label="Score" value={`${proposal.lead.leadScore} (${proposal.lead.leadGrade})`} />
              </dl>
            </CardBody>
          </Card>
        </div>
      </div>
    </Shell>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-brand-muted">{label}</dt>
      <dd className="max-w-[60%] truncate text-brand-navy">{value ?? "—"}</dd>
    </div>
  );
}

function ProposalStatusPill({ status }: { status: string }) {
  const tone =
    status === "ACCEPTED"
      ? "emerald"
      : status === "DECLINED"
        ? "rose"
        : status === "SENT" || status === "VIEWED"
          ? "sky"
          : status === "EXPIRED" || status === "WITHDRAWN"
            ? "slate"
            : "brand";
  return (
    <Pill tone={tone as never}>
      {status}
    </Pill>
  );
}
