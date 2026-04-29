import { NextResponse, type NextRequest } from "next/server";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";
import { requireSTRAccess, STRAuthError } from "@/lib/features/str/auth";
import { recomputeDeal } from "@/lib/features/str/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; expenseId: string }> }
) {
  if (!config.dbEnabled || !config.authEnabled) {
    return NextResponse.json(
      { error: "Database + auth required." },
      { status: 503 }
    );
  }
  try {
    await requireSTRAccess();
  } catch (e) {
    if (e instanceof STRAuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }

  const { id: dealId, expenseId } = await ctx.params;
  const expense = await prisma.sTRExpense.findUnique({ where: { id: expenseId } });
  if (!expense || expense.dealId !== dealId) {
    return NextResponse.json({ error: "Expense not found" }, { status: 404 });
  }

  await prisma.sTRExpense.delete({ where: { id: expenseId } });
  await recomputeDeal(dealId);

  return NextResponse.json({ ok: true });
}
