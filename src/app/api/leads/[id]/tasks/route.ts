import { auth } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  taskType: z
    .enum(["CALL", "EMAIL", "SMS", "WHATSAPP", "MEETING", "REVIEW", "INTERNAL", "OTHER"])
    .default("CALL"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  // ISO-8601 or null
  dueAt: z
    .string()
    .datetime()
    .optional()
    .nullable()
    .transform((v) => (v ? new Date(v) : null)),
  assignedUserId: z.string().nullable().optional(),
});

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

  const actor = await prisma.user.findFirst({ where: { externalId: session.userId } });
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const task = await prisma.task.create({
    data: {
      leadId: id,
      assignedUserId: parsed.data.assignedUserId ?? actor?.id ?? null,
      taskType: parsed.data.taskType,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      priority: parsed.data.priority,
      dueAt: parsed.data.dueAt,
    },
  });
  await prisma.pipelineEvent.create({
    data: {
      leadId: id,
      actorUserId: actor?.id ?? null,
      eventType: "TASK_CREATED",
      note: parsed.data.title,
    },
  });

  return NextResponse.json({ ok: true, taskId: task.id });
}
