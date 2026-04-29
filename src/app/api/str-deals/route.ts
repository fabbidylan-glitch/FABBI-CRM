import { NextResponse, type NextRequest } from "next/server";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";
import { requireSTRAccess, STRAuthError } from "@/lib/features/str/auth";
import { dealCreateSchema } from "@/lib/features/str/input";
import { recomputeDeal } from "@/lib/features/str/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!config.dbEnabled || !config.authEnabled) {
    return NextResponse.json(
      { error: "Database + auth required." },
      { status: 503 }
    );
  }

  let actor;
  try {
    actor = await requireSTRAccess();
  } catch (e) {
    if (e instanceof STRAuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = dealCreateSchema.safeParse(body);
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

  const created = await prisma.sTRDeal.create({
    data: {
      ...parsed.data,
      createdByUserId: actor.userId,
    },
  });
  await recomputeDeal(created.id);

  return NextResponse.json({ id: created.id }, { status: 201 });
}
