// Tiny in-memory sliding-window rate limiter. Server-only, per-process.
//
// Good enough for the dev vote loop and a single-instance deployment. In a multi-instance
// production setup, swap this for a shared store (Upstash/Redis) behind the same shape.

interface Bucket {
  timestamps: number[];
}

const buckets = new Map<string, Bucket>();

export interface RateLimitOptions {
  /** Max events allowed in the window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

/**
 * Record an event for `key` and report whether it is within the limit.
 * Returns true if allowed, false if the limit is exceeded.
 */
export function rateLimit(key: string, opts: RateLimitOptions): boolean {
  const now = Date.now();
  const cutoff = now - opts.windowMs;
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { timestamps: [] };
    buckets.set(key, bucket);
  }
  // Drop expired timestamps.
  bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);

  if (bucket.timestamps.length >= opts.limit) return false;
  bucket.timestamps.push(now);
  return true;
}

/** Test/maintenance helper: clear all buckets. */
export function resetRateLimits(): void {
  buckets.clear();
}
