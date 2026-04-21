import { Shell } from "@/components/shell";
import { ScopeForm } from "@/components/scope-form";

export const dynamic = "force-dynamic";
export const revalidate = 0;

import { Card, CardBody } from "@/components/ui";
import { config } from "@/lib/config";
import { getLead } from "@/lib/features/leads/queries";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function LeadScopePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getLead(id);
  if (!data) return notFound();
  const { lead } = data;
  const canSubmit = config.dbEnabled && config.authEnabled;

  return (
    <Shell title={`Scope — ${lead.firstName} ${lead.lastName}`}>
      <div className="mb-4 flex items-center gap-2 text-xs text-brand-muted">
        <Link
          href={`/leads/${lead.id}`}
          className="inline-flex items-center gap-1 rounded-md border border-transparent px-1.5 py-0.5 transition hover:border-brand-hairline hover:bg-white hover:text-brand-navy"
        >
          <span aria-hidden>←</span> {lead.firstName} {lead.lastName}
        </Link>
        <span aria-hidden className="text-brand-hairline">/</span>
        <span className="text-brand-navy/70">Scope + price</span>
      </div>

      <Card className="overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-brand-blue via-brand-blue-dark to-brand-navy" />
        <CardBody>
          <div className="mb-6">
            <h2 className="text-xl font-semibold tracking-tight text-brand-navy">
              Scope + pricing
            </h2>
            <p className="mt-1 text-sm text-brand-muted">
              Answer the questions below. As you move through the form the recommended monthly fee updates
              live. When you&rsquo;re done, &ldquo;Save + generate proposal&rdquo; drafts a proposal you can
              send from the next screen.
            </p>
          </div>
          <ScopeForm
            leadId={lead.id}
            canSubmit={canSubmit}
            defaultIndustry={lead.niche === "STR_OWNER" || lead.niche === "AIRBNB_VRBO_OPERATOR" ? "STR" : lead.niche === "REAL_ESTATE_INVESTOR" ? "REAL_ESTATE" : "GENERAL"}
          />
        </CardBody>
      </Card>
    </Shell>
  );
}
