import { auth } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";
import { addBusinessHours } from "@/lib/features/leads/business-hours";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("complete"),
    taskIds: z.array(z.string()).min(1).max(200),
  }),
  z.object({
    action: z.literal("snooze"),
    taskIds: z.array(z.string()).min(1).max(200),
    hours: z.number().int().min(1).max(30 * 24),
  }),
  z.object({
    action: z.literal("reassign"),
    taskIds: z.array(z.string()).min(1).max(200),
    assignedUserId: z.string().nullable(),
  }),
]);

export async function POST(req: NextRequest) {
  if (!config.dbEnabled || !config.authEnabled)
    return NextResponse.json({ error: "Database + auth required." }, { status: 503 });

  const session = await auth();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  const actor = await prisma.user.findFirst({ where: { externalId: session.userId } });
  const input = parsed.data;

  if (input.action === "complete") {
    const now = new Date();
    const tasks = await prisma.task.findMany({
      where: { id: { in: input.taskIds }, status: { not: "COMPLETED" } },
      select: { id: true, leadId: true, title: true },
    });
    await prisma.$transaction([
      prisma.task.updateMany({
        where: { id: { in: tasks.map((t) => t.id) } },
        data: { status: "COMPLETED", completedAt: now },
      }),
      prisma.pipelineEvent.createMany({
        data: tasks.map((t) => ({
          leadId: t.leadId,
          actorUserId: actor?.id ?? null,
          eventType: "TASK_COMPLETED" as const,
          note: `Bulk-completed: ${t.title}`,
        })),
      }),
    ]);
    return NextResponse.json({ ok: true, updated: tasks.length });
  }

  if (input.action === "snooze") {
    // Push dueAt forward by N business hours.
    const tasks = await prisma.task.findMany({
      where: { id: { in: input.taskIds } },
      select: { id: true, dueAt: true },
    });
    const now = new Date();
    for (const t of tasks) {
      const anchor = t.dueAt && t.dueAt.getTime() > now.getTime() ? t.dueAt : now;
      await prisma.task.update({
        where: { id: t.id },
        data: { dueAt: addBusinessHours(anchor, input.hours) },
      });
    }
    return NextResponse.json({ ok: true, updated: tasks.length });
  }

  // reassign
  if (input.assignedUserId) {
    const owner = await prisma.user.findUnique({ where: { id: input.assignedUserId } });
    if (!owner) return NextResponse.json({ error: "Owner not found" }, { status: 404 });
  }
  await prisma.task.updateMany({
    where: { id: { in: input.taskIds } },
    data: { assignedUserId: input.assignedUserId },
  });
  return NextResponse.json({ ok: true, updated: input.taskIds.length });
}
