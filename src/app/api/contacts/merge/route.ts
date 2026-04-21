import { auth } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  sourceEmail: z.string().trim().toLowerCase().email(),
  targetEmail: z.string().trim().toLowerCase().email(),
});

/**
 * Contact-level merge: re-point every Lead row owned by the source email to
 * the target email, preserving all submissions / notes / comms / tasks that
 * hang off each Lead. Idempotent — running twice is a no-op since the source
 * has no rows after the first pass.
 */
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

  const { sourceEmail, targetEmail } = parsed.data;
  if (sourceEmail === targetEmail)
    return NextResponse.json({ error: "Source and target are the same contact" }, { status: 400 });

  const actor = await prisma.user.findFirst({ where: { externalId: session.userId } });

  const sourceLeads = await prisma.lead.findMany({
    where: { emailNormalized: sourceEmail },
    select: { id: true, email: true },
  });
  if (sourceLeads.length === 0)
    return NextResponse.json({ error: "Source contact has no leads" }, { status: 404 });

  const targetExists = await prisma.lead.findFirst({
    where: { emailNormalized: targetEmail },
    select: { id: true, email: true },
  });
  if (!targetExists)
    return NextResponse.json({ error: "Target contact has no leads" }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    await tx.lead.updateMany({
      where: { emailNormalized: sourceEmail },
      data: {
        email: targetExists.email ?? targetEmail,
        emailNormalized: targetEmail,
      },
    });
    await tx.pipelineEvent.createMany({
      data: sourceLeads.map((l) => ({
        leadId: l.id,
        actorUserId: actor?.id ?? null,
        eventType: "OTHER" as const,
        note: `Contact merged: ${sourceEmail} → ${targetEmail}`,
      })),
    });
  });

  return NextResponse.json({
    ok: true,
    merged: sourceLeads.length,
    sourceEmail,
    targetEmail,
  });
}
