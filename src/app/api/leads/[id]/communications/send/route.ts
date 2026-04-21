import { auth } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";
import { MessagingError, sendMessage } from "@/lib/messaging/send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  channel: z.enum(["EMAIL", "WHATSAPP", "SMS", "CALL", "OTHER"]),
  templateKey: z.string().min(1),
  whatsappTemplateName: z.string().optional(),
  whatsappLanguageCode: z.string().optional(),
  extraVars: z.record(z.string(), z.string()).optional(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!config.authEnabled)
    return NextResponse.json(
      { error: "Auth must be configured to use authenticated endpoints." },
      { status: 503 }
    );
  if (!config.dbEnabled)
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 }
    );

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
      {
        error: "Validation failed",
        issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      },
      { status: 422 }
    );

  // Map the Clerk user id to our internal User row for audit trail.
  const actor = await prisma.user.findFirst({ where: { externalId: session.userId } });

  try {
    const result = await sendMessage({
      leadId: id,
      templateKey: parsed.data.templateKey,
      channel: parsed.data.channel,
      whatsappTemplateName: parsed.data.whatsappTemplateName,
      whatsappLanguageCode: parsed.data.whatsappLanguageCode,
      extraVars: parsed.data.extraVars,
      actorUserId: actor?.id ?? null,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof MessagingError) {
      const status =
        err.code === "NOT_CONFIGURED"
          ? 503
          : err.code === "MISSING_CONTACT" || err.code === "BAD_TEMPLATE"
            ? 400
            : 502;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    console.error("[send] unexpected", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
