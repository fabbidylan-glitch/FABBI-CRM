import { Shell } from "@/components/shell";
import { OnboardingDetail } from "@/components/onboarding-detail";

export const dynamic = "force-dynamic";
export const revalidate = 0;

import { config } from "@/lib/config";
import { getOnboarding } from "@/lib/features/onboarding/queries";
import { listActiveUsers } from "@/lib/features/users/queries";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function OnboardingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!config.dbEnabled) return notFound();

  const [onboarding, users] = await Promise.all([getOnboarding(id), listActiveUsers()]);
  if (!onboarding) return notFound();

  const canEdit = config.dbEnabled && config.authEnabled;

  return (
    <Shell
      title={`Onboarding — ${onboarding.lead.firstName ?? ""} ${onboarding.lead.lastName ?? ""}`.trim()}
    >
      <div className="mb-4 flex items-center gap-2 text-xs text-brand-muted">
        <Link
          href="/onboarding"
          className="inline-flex items-center gap-1 rounded-md border border-transparent px-1.5 py-0.5 transition hover:border-brand-hairline hover:bg-white hover:text-brand-navy"
        >
          <span aria-hidden>←</span> All onboardings
        </Link>
        <span aria-hidden className="text-brand-hairline">/</span>
        <span className="text-brand-navy/70">
          {onboarding.lead.firstName} {onboarding.lead.lastName}
        </span>
      </div>

      <OnboardingDetail
        onboarding={{
          id: onboarding.id,
          leadId: onboarding.leadId,
          leadName: `${onboarding.lead.firstName ?? ""} ${onboarding.lead.lastName ?? ""}`.trim(),
          companyName: onboarding.lead.companyName,
          templateKey: onboarding.templateKey,
          stage: onboarding.stage,
          blockerNote: onboarding.blockerNote,
          blockedAt: onboarding.blockedAt?.toISOString() ?? null,
          completedAt: onboarding.completedAt?.toISOString() ?? null,
          scopeSummary: onboarding.scopeSummary,
          monthlyFee: onboarding.monthlyFee ? Number(onboarding.monthlyFee) : null,
          catchupFee: onboarding.catchupFee ? Number(onboarding.catchupFee) : null,
          taxFee: onboarding.taxFee ? Number(onboarding.taxFee) : null,
          assignedUserId: onboarding.assignedUserId,
          assignedUserName: onboarding.assignedUser
            ? `${onboarding.assignedUser.firstName ?? ""} ${onboarding.assignedUser.lastName ?? ""}`.trim()
            : null,
          items: onboarding.checklistItems.map((it) => ({
            id: it.id,
            kind: it.kind,
            label: it.label,
            description: it.description,
            status: it.status,
            note: it.note,
          })),
        }}
        users={users.map((u) => ({ id: u.id, name: u.name }))}
        canEdit={canEdit}
      />
    </Shell>
  );
}
