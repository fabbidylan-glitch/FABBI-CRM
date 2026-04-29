import { NextResponse, type NextRequest } from "next/server";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";
import { requireSTRAccess, STRAuthError } from "@/lib/features/str/auth";
import { recomputeDeal } from "@/lib/features/str/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; compId: string }> }
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

  const { id: dealId, compId } = await ctx.params;
  const comp = await prisma.sTRComp.findUnique({ where: { id: compId } });
  if (!comp || comp.dealId !== dealId) {
    return NextResponse.json({ error: "Comp not found" }, { status: 404 });
  }

  await prisma.sTRComp.delete({ where: { id: compId } });
  await recomputeDeal(dealId);

  return NextResponse.json({ ok: true });
}
