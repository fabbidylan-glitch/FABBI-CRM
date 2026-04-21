import { auth } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  status: z.enum(["PENDING", "COMPLETE", "BLOCKED", "NOT_APPLICABLE"]),
  note: z.string().max(2000).optional(),
});

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; itemId: string }> }
) {
  if (!config.dbEnabled || !config.authEnabled)
    return NextResponse.json({ error: "Database + auth required." }, { status: 503 });

  const session = await auth();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, itemId } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Validation failed" }, { status: 422 });

  const item = await prisma.onboardingChecklistItem.findUnique({ where: { id: itemId } });
  if (!item || item.onboardingId !== id)
    return NextResponse.json({ error: "Item not found" }, { status: 404 });

  await prisma.onboardingChecklistItem.update({
    where: { id: itemId },
    data: {
      status: parsed.data.status,
      note: parsed.data.note ?? item.note,
      completedAt: parsed.data.status === "COMPLETE" ? new Date() : null,
    },
  });

  return NextResponse.json({ ok: true });
}
