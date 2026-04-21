import { intakeLead } from "@/lib/features/leads/intake";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { leadIntakeSchema } from "@/lib/validators/lead-intake";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // Per-IP + per-email rate limit — a single source can't submit more than
  // 10 leads in 10 minutes. Blocks accidental double-submits, runaway form
  // scripts, and one-IP spam. Coordinated attacks from many IPs get through;
  // for that, add Upstash Redis + @upstash/ratelimit.
  const ip = getClientIp(req);
  const ipGate = rateLimit(`intake:ip:${ip}`, { limit: 10, windowMs: 10 * 60_000 });
  if (!ipGate.ok) {
    return NextResponse.json(
      { error: "Too many submissions. Please try again shortly." },
      {
        status: 429,
        headers: {
          "retry-after": String(Math.ceil((ipGate.resetAt - Date.now()) / 1000)),
        },
      }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Secondary gate on the email so a spammer rotating IPs can't just keep
  // pumping the same address.
  const maybeEmail = typeof (body as { email?: unknown })?.email === "string"
    ? String((body as { email?: unknown }).email).toLowerCase().trim()
    : null;
  if (maybeEmail) {
    const emailGate = rateLimit(`intake:email:${maybeEmail}`, {
      limit: 5,
      windowMs: 10 * 60_000,
    });
    if (!emailGate.ok) {
      return NextResponse.json(
        { error: "Too many submissions for this email. Please try again shortly." },
        { status: 429 }
      );
    }
  }

  try {
    const input = leadIntakeSchema.parse(body);

    if (input.website_hp && input.website_hp.length > 0) {
      // Honeypot triggered — pretend success to avoid giving bots a signal.
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const result = await intakeLead(input, {
      ipAddress:
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        req.headers.get("x-real-ip") ??
        null,
      userAgent: req.headers.get("user-agent"),
      referer: req.headers.get("referer"),
    });

    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Validation failed",
          issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        },
        { status: 422 }
      );
    }
    console.error("[/api/public/lead] intake failed", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
