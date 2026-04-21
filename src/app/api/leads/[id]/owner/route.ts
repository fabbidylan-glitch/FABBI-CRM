import { auth } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  ownerUserId: z.string().nullable(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
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

  const lead = await prisma.lead.findUnique({
    where: { id },
    include: { owner: { select: { firstName: true, lastName: true } } },
  });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const newOwner = parsed.data.ownerUserId
    ? await prisma.user.findUnique({ where: { id: parsed.data.ownerUserId } })
    : null;
  if (parsed.data.ownerUserId && !newOwner)
    return NextResponse.json({ error: "Owner not found" }, { status: 404 });

  const actor = await prisma.user.findFirst({ where: { externalId: session.userId } });

  await prisma.$transaction([
    prisma.lead.update({
      where: { id },
      data: { ownerUserId: parsed.data.ownerUserId },
    }),
    prisma.pipelineEvent.create({
      data: {
        leadId: id,
        actorUserId: actor?.id ?? null,
        eventType: "OWNER_CHANGED",
        note: `Owner: ${
          lead.owner ? `${lead.owner.firstName} ${lead.owner.lastName}` : "Unassigned"
        } → ${newOwner ? `${newOwner.firstName} ${newOwner.lastName}` : "Unassigned"}`,
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
