import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { config } from "@/lib/config";
import { deleteClerkUser, syncClerkUser } from "@/lib/features/users/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Clerk sends webhooks via Svix. Svix headers:
 *   svix-id, svix-timestamp, svix-signature
 * Verify by HMAC-SHA256 over `<id>.<timestamp>.<rawBody>` with CLERK_WEBHOOK_SECRET.
 */
export async function POST(req: NextRequest) {
  if (!config.dbEnabled) return NextResponse.json({ ok: true });

  const raw = await req.text();
  const secret = process.env.CLERK_WEBHOOK_SECRET;

  if (secret) {
    if (!verifySvix(req.headers, raw, secret)) {
      return NextResponse.json({ error: "bad signature" }, { status: 401 });
    }
  }

  let evt: ClerkEvent;
  try {
    evt = JSON.parse(raw) as ClerkEvent;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  switch (evt.type) {
    case "user.created":
    case "user.updated":
      await syncClerkUser({
        id: evt.data.id,
        firstName: evt.data.first_name,
        lastName: evt.data.last_name,
        emailAddresses: (evt.data.email_addresses ?? []).map((e) => ({
          emailAddress: e.email_address,
          id: e.id,
        })),
        primaryEmailAddressId: evt.data.primary_email_address_id,
      });
      break;
    case "user.deleted":
      if (evt.data.id) await deleteClerkUser(evt.data.id);
      break;
  }

  return NextResponse.json({ ok: true });
}

function verifySvix(headers: Headers, raw: string, secret: string): boolean {
  const svixId = headers.get("svix-id") ?? "";
  const svixTs = headers.get("svix-timestamp") ?? "";
  const svixSig = headers.get("svix-signature") ?? "";
  if (!svixId || !svixTs || !svixSig) return false;

  // Svix secret is stored as `whsec_<base64>` — decode the base64 part.
  const key = secret.startsWith("whsec_") ? Buffer.from(secret.slice(6), "base64") : Buffer.from(secret);
  const digest = crypto.createHmac("sha256", key).update(`${svixId}.${svixTs}.${raw}`).digest("base64");
  const expected = `v1,${digest}`;

  // svix-signature can contain multiple "v1,<sig>" entries separated by spaces
  const candidates = svixSig.split(" ");
  return candidates.some((c) => {
    try {
      return (
        c.length === expected.length &&
        crypto.timingSafeEqual(Buffer.from(c), Buffer.from(expected))
      );
    } catch {
      return false;
    }
  });
}

type ClerkEvent = {
  type: "user.created" | "user.updated" | "user.deleted" | string;
  data: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    email_addresses?: Array<{ id: string; email_address: string }>;
    primary_email_address_id?: string | null;
  };
};
