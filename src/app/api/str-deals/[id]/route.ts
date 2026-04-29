import { NextResponse, type NextRequest } from "next/server";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";
import { requireSTRAccess, STRAuthError } from "@/lib/features/str/auth";
import { dealUpdateSchema } from "@/lib/features/str/input";
import { recomputeDeal } from "@/lib/features/str/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function gate() {
  if (!config.dbEnabled || !config.authEnabled) {
    return {
      error: NextResponse.json(
        { error: "Database + auth required." },
        { status: 503 }
      ),
    };
  }
  try {
    return { actor: await requireSTRAccess() };
  } catch (e) {
    if (e instanceof STRAuthError) {
      return { error: NextResponse.json({ error: e.message }, { status: e.status }) };
    }
    throw e;
  }
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const guard = await gate();
  if (guard.error) return guard.error;

  const { id } = await ctx.params;
  const existing = await prisma.sTRDeal.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = dealUpdateSchema.safeParse(body);
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

  await prisma.sTRDeal.update({ where: { id }, data: parsed.data });
  await recomputeDeal(id);

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const guard = await gate();
  if (guard.error) return guard.error;

  const { id } = await ctx.params;
  const existing = await prisma.sTRDeal.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Cascading FK constraints handle scenarios/comps/expenses/memos.
  await prisma.sTRDeal.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
