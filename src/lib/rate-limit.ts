import "server-only";

/**
 * Small in-process fixed-window limiter. Adequate for a single-node deployment;
 * swap the store for Redis when running more than one instance.
 */
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
): { ok: boolean; remaining: number; retryAfterSeconds: number } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }
  return { ok: true, remaining: limit - bucket.count, retryAfterSeconds: 0 };
}

// Opportunistic cleanup so the map cannot grow without bound.
if (typeof setInterval !== "undefined") {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
  }, 60_000);
  // Do not keep the process alive for cleanup.
  (timer as unknown as { unref?: () => void }).unref?.();
}
