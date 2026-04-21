import { auth } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  body: z.string().trim().min(1, "Note body is required").max(5000),
  noteType: z
    .enum(["GENERAL", "CALL_SUMMARY", "MEETING_SUMMARY", "DISCOVERY", "INTERNAL"])
    .default("GENERAL"),
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

  const author = await prisma.user.findFirst({ where: { externalId: session.userId } });
  if (!author)
    return NextResponse.json(
      { error: "Your internal user record is missing — refresh and try again." },
      { status: 409 }
    );

  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const [note] = await prisma.$transaction([
    prisma.leadNote.create({
      data: { leadId: id, authorUserId: author.id, body: parsed.data.body, noteType: parsed.data.noteType },
    }),
    prisma.pipelineEvent.create({
      data: {
        leadId: id,
        actorUserId: author.id,
        eventType: "NOTE_ADDED",
        note: parsed.data.body.slice(0, 200),
      },
    }),
  ]);

  return NextResponse.json({ ok: true, noteId: note.id });
}
