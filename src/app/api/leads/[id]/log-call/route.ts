import { auth } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OUTCOMES = [
  "CONNECTED",
  "VOICEMAIL",
  "NO_ANSWER",
  "NOT_INTERESTED",
  "BAD_NUMBER",
] as const;

type Outcome = (typeof OUTCOMES)[number];

const schema = z.object({
  outcome: z.enum(OUTCOMES),
  durationMinutes: z.number().int().nonnegative().max(600).optional(),
  notes: z.string().trim().max(4000).optional(),
  completeOpenCallTask: z.boolean().default(true),
});

const OUTCOME_LABEL: Record<Outcome, string> = {
  CONNECTED: "Connected",
  VOICEMAIL: "Left voicemail",
  NO_ANSWER: "No answer",
  NOT_INTERESTED: "Not interested",
  BAD_NUMBER: "Bad number",
};

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!config.dbEnabled || !config.authEnabled)
    return NextResponse.json({ error: "Database + auth required." }, { status: 503 });

  const session = await auth();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );

  const actor = await prisma.user.findFirst({ where: { externalId: session.userId } });
  if (!actor)
    return NextResponse.json(
      { error: "Your internal user record is missing — refresh and try again." },
      { status: 409 }
    );

  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const { outcome, durationMinutes, notes, completeOpenCallTask } = parsed.data;
  const now = new Date();
  const summary = [
    `Call — ${OUTCOME_LABEL[outcome]}`,
    durationMinutes ? `${durationMinutes}m` : null,
    notes ? notes : null,
  ]
    .filter(Boolean)
    .join(" · ");

  // Create the Communication row, update lead touch timestamp, log the pipeline
  // event, and (optionally) close any open CALL task in a single transaction so
  // the UI reflects the logged call atomically.
  const ops: Array<Promise<unknown>> = [
    prisma.communication.create({
      data: {
        leadId: id,
        channel: "CALL",
        direction: "OUTBOUND",
        bodyText: summary || `Call — ${OUTCOME_LABEL[outcome]}`,
        deliveryStatus: outcome === "CONNECTED" ? "DELIVERED" : "SENT",
        sentAt: now,
        deliveredAt: outcome === "CONNECTED" ? now : null,
        metadataJson: {
          loggedBy: actor.id,
          outcome,
          durationMinutes: durationMinutes ?? null,
        },
      },
    }),
    prisma.lead.update({
      where: { id },
      data: { lastContactedAt: now },
    }),
    prisma.pipelineEvent.create({
      data: {
        leadId: id,
        actorUserId: actor.id,
        eventType: "COMMUNICATION_SENT",
        note: summary.slice(0, 200),
      },
    }),
  ];

  if (completeOpenCallTask) {
    const openCallTask = await prisma.task.findFirst({
      where: { leadId: id, taskType: "CALL", status: { in: ["OPEN", "IN_PROGRESS", "OVERDUE"] } },
      orderBy: { dueAt: "asc" },
    });
    if (openCallTask) {
      ops.push(
        prisma.task.update({
          where: { id: openCallTask.id },
          data: { status: "COMPLETED", completedAt: now },
        })
      );
      ops.push(
        prisma.pipelineEvent.create({
          data: {
            leadId: id,
            actorUserId: actor.id,
            eventType: "TASK_COMPLETED",
            note: `Completed via call log: ${openCallTask.title}`.slice(0, 200),
          },
        })
      );
    }
  }

  await prisma.$transaction(ops);

  return NextResponse.json({ ok: true });
}
