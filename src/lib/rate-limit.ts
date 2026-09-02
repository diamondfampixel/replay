import "server-only";

/**
 * Fixed-window rate limiter.
 *
 * With UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN set, windows live in
 * Redis and hold across every serverless instance. Without them, an in-process
 * map is used — correct on a single node, per-instance on serverless (each
 * warm instance counts separately), which the deployment docs call out.
 *
 * A Redis outage falls back to the in-process window rather than failing the
 * request: rate limiting protects capacity, and refusing all traffic because
 * the limiter's store blinked would invert that purpose.
 */
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export type RateLimitResult = { ok: boolean; remaining: number; retryAfterSeconds: number };

function localLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return { ok: false, remaining: 0, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  return { ok: true, remaining: limit - bucket.count, retryAfterSeconds: 0 };
}

async function redisLimit(
  key: string,
  limit: number,
  windowMs: number,
  url: string,
  token: string,
): Promise<RateLimitResult> {
  const window = Math.floor(Date.now() / windowMs);
  const redisKey = `rl:${key}:${window}`;

  const response = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify([
      ["INCR", redisKey],
      ["PEXPIRE", redisKey, String(windowMs), "NX"],
    ]),
    signal: AbortSignal.timeout(2000),
  });
  if (!response.ok) throw new Error(`Upstash ${response.status}`);

  const [incr] = (await response.json()) as Array<{ result: number }>;
  const count = incr.result;
  const resetAt = (window + 1) * windowMs;

  if (count > limit) {
    return { ok: false, remaining: 0, retryAfterSeconds: Math.ceil((resetAt - Date.now()) / 1000) };
  }
  return { ok: true, remaining: limit - count, retryAfterSeconds: 0 };
}

export async function rateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
): Promise<RateLimitResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (url && token) {
    try {
      return await redisLimit(key, limit, windowMs, url, token);
    } catch {
      // Fall through to the local window.
    }
  }
  return localLimit(key, limit, windowMs);
}
