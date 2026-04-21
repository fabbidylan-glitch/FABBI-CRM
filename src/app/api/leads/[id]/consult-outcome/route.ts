import { auth } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { enrollLead } from "@/lib/automation/engine";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";
import { ensureStageTasks } from "@/lib/features/leads/stage-workflow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  outcome: z.enum(["SHOWED_UP", "NO_SHOW"]),
  note: z.string().max(500).optional(),
});

/**
 * Mark a booked consult as showed-up or no-show. Two side effects each:
 *
 * SHOWED_UP:
 *   - Lead stage → CONSULT_COMPLETED
 *   - CONSULT_COMPLETED timeline event (counts toward show rate KPI)
 *   - Exits the consult-reminder sequence (if any) — no more reminders
 *
 * NO_SHOW:
 *   - Stage stays at CONSULT_BOOKED (client may still rebook)
 *   - CONSULT_NO_SHOW timeline event
 *   - Enrolls lead in `consult_no_show_v1` rebooking sequence (instant email,
 *     SMS at +5min, etc.)
 *   - Exits the consult-reminder sequence
 */
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
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );

  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const actor = await prisma.user.findFirst({ where: { externalId: session.userId } });

  // Exit the consult-reminder sequence in either case — reminders make no
  // sense once the meeting has happened (or not).
  await prisma.sequenceEnrollment.updateMany({
    where: {
      leadId: id,
      sequenceKey: "consult_reminder_v1",
      status: { in: ["ACTIVE", "ENROLLED"] },
    },
    data: { status: "EXITED", exitReason: "COMPLETED", exitedAt: new Date() },
  });

  if (parsed.data.outcome === "SHOWED_UP") {
    await prisma.$transaction([
      prisma.lead.update({ where: { id }, data: { pipelineStage: "CONSULT_COMPLETED" } }),
      prisma.pipelineEvent.create({
        data: {
          leadId: id,
          actorUserId: actor?.id ?? null,
          eventType: "STAGE_CHANGED",
          fromStage: lead.pipelineStage,
          toStage: "CONSULT_COMPLETED",
          note: parsed.data.note ?? "Consult completed — client showed up.",
        },
      }),
      prisma.pipelineEvent.create({
        data: {
          leadId: id,
          actorUserId: actor?.id ?? null,
          eventType: "CONSULT_COMPLETED",
          note: "Marked as showed up",
        },
      }),
    ]);
    // Consult happened → auto-create the "draft proposal" task.
    await ensureStageTasks({
      leadId: id,
      toStage: "CONSULT_COMPLETED",
      actorUserId: actor?.id ?? null,
    });
    return NextResponse.json({ ok: true, outcome: "SHOWED_UP" });
  }

  // NO_SHOW path
  await prisma.pipelineEvent.create({
    data: {
      leadId: id,
      actorUserId: actor?.id ?? null,
      eventType: "CONSULT_NO_SHOW",
      note: parsed.data.note ?? "Marked as no-show — rebooking sequence enrolled.",
    },
  });

  // Enroll in the rebooking sequence. Step 0 (instant email) fires inline.
  try {
    await enrollLead({
      leadId: id,
      sequenceKey: "consult_no_show_v1",
      runImmediate: true,
    });
  } catch (err) {
    console.error("[consult-outcome] no-show sequence enrollment failed", err);
  }

  return NextResponse.json({ ok: true, outcome: "NO_SHOW" });
}
