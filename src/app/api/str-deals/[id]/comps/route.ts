import { NextResponse, type NextRequest } from "next/server";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";
import { requireSTRAccess, STRAuthError } from "@/lib/features/str/auth";
import { compCreateSchema } from "@/lib/features/str/input";
import { recomputeDeal } from "@/lib/features/str/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
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

  const { id: dealId } = await ctx.params;
  const exists = await prisma.sTRDeal.findUnique({ where: { id: dealId } });
  if (!exists) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = compCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 422 }
    );
  }

  const created = await prisma.sTRComp.create({
    data: { dealId, ...parsed.data },
  });
  // Adding/removing comps doesn't change underwriting math, but it can change
  // the user's view of comp quality — we don't auto-touch the rating field.
  // Recompute is still cheap and keeps everything consistent.
  await recomputeDeal(dealId);

  return NextResponse.json({ id: created.id }, { status: 201 });
}
