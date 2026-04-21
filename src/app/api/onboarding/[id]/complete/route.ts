import { auth } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";
import { REQUIRED_BEFORE_COMPLETE, stageIndex } from "@/lib/onboarding/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Mark the onboarding complete — gate on (a) stage is at least
 * ACCOUNT_SETUP_COMPLETE and (b) no checklist items are in BLOCKED status.
 * The UI already disables the button when these aren't met, but we enforce
 * again on the server so the guarantee holds even when called directly.
 */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!config.dbEnabled || !config.authEnabled)
    return NextResponse.json({ error: "Database + auth required." }, { status: 503 });

  const session = await auth();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const onboarding = await prisma.onboarding.findUnique({
    where: { id },
    include: { checklistItems: { select: { status: true } } },
  });
  if (!onboarding) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (onboarding.completedAt)
    return NextResponse.json({ error: "Already complete" }, { status: 409 });

  const ready = REQUIRED_BEFORE_COMPLETE.every(
    (s) => stageIndex(onboarding.stage) >= stageIndex(s)
  );
  if (!ready)
    return NextResponse.json(
      { error: "Required stages not reached yet." },
      { status: 409 }
    );

  const blocked = onboarding.checklistItems.filter((i) => i.status === "BLOCKED").length;
  if (blocked > 0)
    return NextResponse.json(
      { error: `${blocked} checklist item${blocked === 1 ? "" : "s"} blocked — clear before completing.` },
      { status: 409 }
    );

  const now = new Date();
  await prisma.onboarding.update({
    where: { id },
    data: { stage: "COMPLETE", completedAt: now },
  });

  return NextResponse.json({ ok: true });
}
