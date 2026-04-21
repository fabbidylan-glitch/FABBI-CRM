import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Meta webhook handshake: Meta sends a GET with hub.* params; echo the challenge
// back when the verify token matches what we registered in the dashboard.
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  if (mode === "subscribe" && token && token === process.env.META_WA_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return new NextResponse("forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  const raw = await req.text();

  // Verify x-hub-signature-256 when the app secret is set. Treat a missing or
  // mismatched signature as fatal in prod; in dev (no secret configured) allow
  // the event through so local tests aren't blocked.
  const appSecret = process.env.META_WA_APP_SECRET;
  if (appSecret) {
    const sig = req.headers.get("x-hub-signature-256") ?? "";
    const expected = "sha256=" + crypto.createHmac("sha256", appSecret).update(raw).digest("hex");
    if (
      sig.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
    ) {
      return new NextResponse("bad signature", { status: 401 });
    }
  }

  if (!config.dbEnabled) return NextResponse.json({ ok: true });

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(raw) as WebhookPayload;
  } catch {
    return new NextResponse("bad json", { status: 400 });
  }

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;

      // Delivery receipts — update the matching Communication row. `externalMessageId`
      // is unique now, so findUnique is safe; a missing row means the send wasn't
      // made by us (ignore).
      for (const status of value.statuses ?? []) {
        const target = await prisma.communication.findUnique({
          where: { externalMessageId: status.id },
        });
        if (!target) continue;
        const update = mapStatusUpdate(status.status);
        if (Object.keys(update).length === 0) continue;
        await prisma.communication.update({ where: { id: target.id }, data: update });
      }

      // Inbound messages — upsert on externalMessageId so that Meta's webhook
      // retries (which fire on any non-200 response) don't create duplicates.
      for (const msg of value.messages ?? []) {
        const fromE164 = `+${msg.from}`;
        const lead = await prisma.lead.findFirst({ where: { phoneE164: fromE164 } });
        if (!lead) continue;

        const bodyText =
          msg.text?.body ??
          msg.button?.text ??
          msg.interactive?.button_reply?.title ??
          msg.interactive?.list_reply?.title ??
          `[${msg.type} message]`;

        const created = await prisma.communication.upsert({
          where: { externalMessageId: msg.id },
          update: {}, // no-op on replay
          create: {
            leadId: lead.id,
            channel: "WHATSAPP",
            direction: "INBOUND",
            bodyText,
            externalMessageId: msg.id,
            deliveryStatus: "DELIVERED",
            sentAt: new Date(Number(msg.timestamp) * 1000),
            metadataJson: msg as unknown as object,
          },
        });

        // Only log a pipeline event on the initial create, not replays.
        if (created.createdAt.getTime() >= Date.now() - 5_000) {
          await prisma.pipelineEvent.create({
            data: {
              leadId: lead.id,
              eventType: "COMMUNICATION_RECEIVED",
              note: `WhatsApp reply: ${bodyText.slice(0, 120)}`,
            },
          });
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}

function mapStatusUpdate(status: string) {
  switch (status) {
    case "sent":
      return { deliveryStatus: "SENT" as const, sentAt: new Date() };
    case "delivered":
      return { deliveryStatus: "DELIVERED" as const, deliveredAt: new Date() };
    case "read":
      return { deliveryStatus: "OPENED" as const, openedAt: new Date() };
    case "failed":
      return { deliveryStatus: "FAILED" as const, failedAt: new Date() };
    default:
      return {};
  }
}

// Narrow view of Meta's webhook payload — enough to be useful, loose enough to
// not break when Meta adds new fields.
type WebhookPayload = {
  entry?: Array<{
    changes?: Array<{
      value: {
        statuses?: Array<{ id: string; status: string }>;
        messages?: Array<{
          id: string;
          from: string;
          timestamp: string;
          type: string;
          text?: { body: string };
          button?: { text: string };
          interactive?: {
            button_reply?: { title: string };
            list_reply?: { title: string };
          };
        }>;
      };
    }>;
  }>;
};
