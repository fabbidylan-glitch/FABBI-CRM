import "server-only";

// Lightweight in-memory sliding-window rate limiter. Good enough to block
// the obvious cases (runaway form script, accidental double-submit, a single
// attacker retrying from one IP). NOT good enough to stop a coordinated
// attack across many IPs — for that, switch to Upstash Redis and the
// `@upstash/ratelimit` package.
//
// Caveats on Vercel serverless:
//   - Memory is per-function-instance, so the same IP hitting a cold instance
//     resets the bucket. In practice Vercel reuses warm instances for minutes,
//     so most abuse from one source still gets blocked.
//   - On Hobby we stick with in-memory to keep cost at zero.

type Bucket = { hits: number[] };
const buckets = new Map<string, Bucket>();

export type RateLimitResult = { ok: boolean; remaining: number; resetAt: number };

export function rateLimit(
  key: string,
  opts: { limit: number; windowMs: number }
): RateLimitResult {
  const now = Date.now();
  const cutoff = now - opts.windowMs;
  const bucket = buckets.get(key) ?? { hits: [] };
  // Drop expired hits.
  bucket.hits = bucket.hits.filter((t) => t > cutoff);

  if (bucket.hits.length >= opts.limit) {
    buckets.set(key, bucket);
    return {
      ok: false,
      remaining: 0,
      resetAt: (bucket.hits[0] ?? now) + opts.windowMs,
    };
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);

  // Occasionally garbage-collect buckets that haven't been touched in a while
  // so memory doesn't grow unbounded.
  if (buckets.size > 2_000) {
    for (const [k, b] of buckets) {
      if (b.hits.length === 0 || (b.hits[b.hits.length - 1] ?? 0) < now - opts.windowMs * 4) {
        buckets.delete(k);
      }
    }
  }

  return {
    ok: true,
    remaining: opts.limit - bucket.hits.length,
    resetAt: now + opts.windowMs,
  };
}

export function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() ?? "unknown";
  return req.headers.get("x-real-ip") ?? "unknown";
}
