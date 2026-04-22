import "server-only";
import { prisma } from "@/lib/db";
import { computeDiscount } from "./discount";

/**
 * Recalculate a proposal's monthly / one-time / annual totals from its line
 * items, applying the proposal-level discount (if any). Called any time line
 * items change OR the discount fields change.
 */
export async function recomputeProposalTotals(proposalId: string): Promise<void> {
  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    select: {
      discountLabel: true,
      discountAmount: true,
      discountPct: true,
      discountAppliesTo: true,
      lineItems: { select: { monthlyAmount: true, onetimeAmount: true } },
    },
  });
  if (!proposal) return;

  const monthlySubtotal = proposal.lineItems.reduce(
    (sum, li) => sum + Number(li.monthlyAmount ?? 0),
    0
  );
  const onetimeSubtotal = proposal.lineItems.reduce(
    (sum, li) => sum + Number(li.onetimeAmount ?? 0),
    0
  );

  const discount = computeDiscount(monthlySubtotal, onetimeSubtotal, {
    discountAmount: proposal.discountAmount ? Number(proposal.discountAmount) : null,
    discountPct: proposal.discountPct ? Number(proposal.discountPct) : null,
    discountAppliesTo: proposal.discountAppliesTo,
    discountLabel: proposal.discountLabel,
  });

  const monthly = Math.max(0, monthlySubtotal - discount.monthly);
  const onetime = Math.max(0, onetimeSubtotal - discount.onetime);

  await prisma.proposal.update({
    where: { id: proposalId },
    data: {
      monthlyValue: monthly,
      onetimeValue: onetime,
      annualValue: Math.round(monthly * 12),
    },
  });
}
