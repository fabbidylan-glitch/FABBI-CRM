import "server-only";

/**
 * Neon (and other serverless Postgres) can be paused/cold when no connections
 * have been open recently. The first query hitting a paused DB fails with
 * `PrismaClientInitializationError: Can't reach database server`; the SECOND
 * query usually succeeds because the wake-up completed in the background.
 *
 * `safeQuery` runs the callback, and on connection-level errors retries once
 * after a short delay. If both attempts fail we invoke the `fallback` so the
 * page renders with stale data instead of a 500.
 */
export async function safeQuery<T>(
  label: string,
  run: () => Promise<T>,
  fallback: () => T | Promise<T>
): Promise<T> {
  try {
    return await run();
  } catch (err) {
    if (!isTransientDbError(err)) {
      console.error(`[safeQuery:${label}] non-transient error:`, err);
      return await fallback();
    }
    console.warn(`[safeQuery:${label}] transient DB error — retrying once`, errMsg(err));
    await sleep(500);
    try {
      return await run();
    } catch (err2) {
      console.error(`[safeQuery:${label}] still failing, using fallback:`, errMsg(err2));
      return await fallback();
    }
  }
}

function isTransientDbError(err: unknown): boolean {
  const msg = errMsg(err).toLowerCase();
  return (
    msg.includes("can't reach database server") ||
    msg.includes("connection closed") ||
    msg.includes("connection terminated") ||
    msg.includes("connection refused") ||
    msg.includes("timeout") ||
    msg.includes("econnreset") ||
    msg.includes("etimedout")
  );
}

function errMsg(e: unknown): string {
  if (!e) return "";
  if (e instanceof Error) return e.message;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}
