import { auth } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STAGES = [
  "SIGNED",
  "WELCOME_SENT",
  "PAYMENT_COLLECTED",
  "ENGAGEMENT_COMPLETED",
  "DOCS_REQUESTED",
  "DOCS_RECEIVED",
  "ACCESS_RECEIVED",
  "QUESTIONNAIRE_COMPLETE",
  "KICKOFF_SCHEDULED",
  "ACCOUNT_SETUP_COMPLETE",
  "READY_FOR_RECURRING",
  "COMPLETE",
] as const;

const schema = z.object({ stage: z.enum(STAGES) });

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!config.dbEnabled || !config.authEnabled)
    return NextResponse.json({ error: "Database + auth required." }, { status: 503 });

  const session = await auth();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Validation failed" }, { status: 422 });

  const onboarding = await prisma.onboarding.findUnique({ where: { id } });
  if (!onboarding) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.onboarding.update({
    where: { id },
    data: {
      stage: parsed.data.stage,
      completedAt: parsed.data.stage === "COMPLETE" ? new Date() : onboarding.completedAt,
    },
  });

  return NextResponse.json({ ok: true });
}
