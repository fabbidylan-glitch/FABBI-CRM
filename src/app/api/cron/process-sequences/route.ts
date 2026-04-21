import { NextResponse, type NextRequest } from "next/server";
import { processDueSequences } from "@/lib/automation/engine";
import { config } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cron endpoint — Vercel Cron hits this with an `Authorization: Bearer <token>`
 * header where the token is `CRON_SECRET`. If CRON_SECRET is unset, we allow
 * any request (useful for local manual testing, NOT production).
 */
async function handle(req: NextRequest) {
  if (!config.dbEnabled) {
    return NextResponse.json({ skipped: "db not configured" }, { status: 200 });
  }

  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await processDueSequences();
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
