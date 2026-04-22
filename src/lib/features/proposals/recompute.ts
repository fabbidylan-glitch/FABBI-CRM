import "server-only";
import { prisma } from "@/lib/db";

/**
 * Recalculate a proposal's monthly / one-time / annual totals from its line
 * items. Called any time line items are added / edited / deleted so the
 * summary fields on the Proposal row stay in sync with the source of truth.
 */
export async function recomputeProposalTotals(proposalId: string): Promise<void> {
  const items = await prisma.proposalLineItem.findMany({
    where: { proposalId },
    select: { monthlyAmount: true, onetimeAmount: true },
  });
  const monthly = items.reduce((sum, li) => sum + Number(li.monthlyAmount ?? 0), 0);
  const onetime = items.reduce((sum, li) => sum + Number(li.onetimeAmount ?? 0), 0);

  await prisma.proposal.update({
    where: { id: proposalId },
    data: {
      monthlyValue: monthly,
      onetimeValue: onetime,
      annualValue: Math.round(monthly * 12),
    },
  });
}
