import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Telnyx messaging webhook.
 *
 * Event types we care about:
 *   - `message.received`  — inbound SMS/MMS → log as INBOUND Communication
 *   - `message.sent`      — our outbound just hit Telnyx's network
 *   - `message.finalized` — delivered / failed / etc.
 *
 * Signing: Telnyx signs with Ed25519. Verification requires TELNYX_PUBLIC_KEY
 * (the base64 public key from the portal). If it's not set we accept unsigned
 * events so local testing works.
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();

  const publicKeyB64 = process.env.TELNYX_PUBLIC_KEY;
  if (publicKeyB64) {
    if (!verifyTelnyxSignature(req.headers, raw, publicKeyB64)) {
      return NextResponse.json({ error: "bad signature" }, { status: 401 });
    }
  }

  if (!config.dbEnabled) return NextResponse.json({ ok: true });

  let evt: TelnyxEvent;
  try {
    evt = JSON.parse(raw) as TelnyxEvent;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const payload = evt.data?.payload;
  const type = evt.data?.event_type;
  if (!payload || !type) return NextResponse.json({ ok: true });

  // Inbound message — log as INBOUND Communication, idempotent on message id.
  if (type === "message.received") {
    const fromE164 = payload.from?.phone_number;
    if (!fromE164) return NextResponse.json({ ok: true });

    const lead = await prisma.lead.findFirst({ where: { phoneE164: fromE164 } });
    if (!lead) return NextResponse.json({ ok: true });

    const bodyText = payload.text ?? "[no text]";
    const created = await prisma.communication.upsert({
      where: { externalMessageId: payload.id },
      update: {},
      create: {
        leadId: lead.id,
        channel: "SMS",
        direction: "INBOUND",
        bodyText,
        externalMessageId: payload.id,
        deliveryStatus: "DELIVERED",
        sentAt: payload.received_at ? new Date(payload.received_at) : new Date(),
        metadataJson: payload as unknown as object,
      },
    });
    if (created.createdAt.getTime() >= Date.now() - 5_000) {
      await prisma.pipelineEvent.create({
        data: {
          leadId: lead.id,
          eventType: "COMMUNICATION_RECEIVED",
          note: `SMS reply: ${bodyText.slice(0, 120)}`,
        },
      });
    }
    return NextResponse.json({ ok: true });
  }

  // Delivery status updates — map Telnyx status → our DeliveryStatus
  if (type === "message.sent" || type === "message.finalized") {
    const target = await prisma.communication.findUnique({
      where: { externalMessageId: payload.id },
    });
    if (!target) return NextResponse.json({ ok: true });

    const status =
      payload.to?.[0]?.status ?? (type === "message.sent" ? "sent" : "delivered");
    const update = mapStatusUpdate(status);
    if (Object.keys(update).length > 0) {
      await prisma.communication.update({ where: { id: target.id }, data: update });
    }
  }

  return NextResponse.json({ ok: true });
}

function mapStatusUpdate(status: string) {
  switch (status.toLowerCase()) {
    case "sent":
    case "queued":
      return { deliveryStatus: "SENT" as const, sentAt: new Date() };
    case "delivered":
      return { deliveryStatus: "DELIVERED" as const, deliveredAt: new Date() };
    case "delivery_failed":
    case "sending_failed":
    case "failed":
      return { deliveryStatus: "FAILED" as const, failedAt: new Date() };
    default:
      return {};
  }
}

function verifyTelnyxSignature(headers: Headers, raw: string, publicKeyB64: string): boolean {
  const signatureB64 = headers.get("telnyx-signature-ed25519") ?? "";
  const timestamp = headers.get("telnyx-timestamp") ?? "";
  if (!signatureB64 || !timestamp) return false;

  // Reject events older than 5 minutes.
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;

  try {
    const key = crypto.createPublicKey({
      key: Buffer.from(publicKeyB64, "base64"),
      format: "der",
      type: "spki",
    });
    return crypto.verify(
      null,
      Buffer.from(`${timestamp}|${raw}`),
      key,
      Buffer.from(signatureB64, "base64")
    );
  } catch {
    return false;
  }
}

type TelnyxEvent = {
  data?: {
    event_type?: string;
    payload?: {
      id: string;
      text?: string;
      received_at?: string;
      from?: { phone_number?: string };
      to?: Array<{ phone_number?: string; status?: string }>;
    };
  };
};
