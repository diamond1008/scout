/**
 * Token-bucket rate limiter for X API v2 endpoints.
 * Each endpoint gets its own bucket with independent refill rates.
 */

interface Bucket {
  tokens: number;
  maxTokens: number;
  refillRatePerSecond: number;
  lastRefill: number; // timestamp ms
  serverResetAt: number | null; // from x-rate-limit-reset header (epoch seconds)
}

const FIFTEEN_MINUTES = 15 * 60; // seconds

const DEFAULT_BUCKETS: Record<string, { max: number; windowSeconds: number }> = {
  dm_send: { max: 15, windowSeconds: FIFTEEN_MINUTES },
  tweets_search: { max: 450, windowSeconds: FIFTEEN_MINUTES },
  users_lookup: { max: 300, windowSeconds: FIFTEEN_MINUTES },
  user_tweets: { max: 1500, windowSeconds: FIFTEEN_MINUTES },
  dm_events: { max: 300, windowSeconds: FIFTEEN_MINUTES },
};

export class TokenBucketRateLimiter {
  private buckets: Map<string, Bucket> = new Map();

  constructor() {
    const now = Date.now();
    for (const [key, config] of Object.entries(DEFAULT_BUCKETS)) {
      this.buckets.set(key, {
        tokens: config.max,
        maxTokens: config.max,
        refillRatePerSecond: config.max / config.windowSeconds,
        lastRefill: now,
        serverResetAt: null,
      });
    }
  }

  /**
   * Acquire a token for the given endpoint.
   * Waits (via delay) if no tokens are available.
   */
  async acquire(endpoint: string): Promise<void> {
    const bucket = this.buckets.get(endpoint);
    if (!bucket) return; // unknown endpoint → no limiting

    this.refill(bucket);

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return;
    }

    // Need to wait — calculate wait time
    const waitMs = this.getWaitMs(bucket);
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      this.refill(bucket);
    }

    bucket.tokens = Math.max(0, bucket.tokens - 1);
  }

  /**
   * Update bucket state from X API response headers.
   */
  updateFromHeaders(endpoint: string, headers: Headers): void {
    const bucket = this.buckets.get(endpoint);
    if (!bucket) return;

    const remaining = headers.get("x-rate-limit-remaining");
    const reset = headers.get("x-rate-limit-reset");
    const limit = headers.get("x-rate-limit-limit");

    if (remaining !== null) {
      bucket.tokens = Math.min(parseInt(remaining, 10), bucket.maxTokens);
    }
    if (limit !== null) {
      bucket.maxTokens = parseInt(limit, 10);
    }
    if (reset !== null) {
      bucket.serverResetAt = parseInt(reset, 10);
    }
    bucket.lastRefill = Date.now();
  }

  /**
   * Get the current status of all rate limit buckets (for UI display).
   */
  getStatus(): Record<string, { remaining: number; limit: number; reset_at: string; resetAt: string | null }> {
    const status: Record<string, { remaining: number; limit: number; reset_at: string; resetAt: string | null }> = {};
    for (const [key, bucket] of this.buckets) {
      this.refill(bucket);
      const resetIso = bucket.serverResetAt
        ? new Date(bucket.serverResetAt * 1000).toISOString()
        : new Date(Date.now() + 900_000).toISOString();
      status[key] = {
        remaining: Math.floor(bucket.tokens),
        limit: bucket.maxTokens,
        reset_at: resetIso,
        resetAt: bucket.serverResetAt ? resetIso : null,
      };
    }
    return status;
  }

  private refill(bucket: Bucket): void {
    const now = Date.now();
    const elapsed = (now - bucket.lastRefill) / 1000;
    bucket.tokens = Math.min(bucket.maxTokens, bucket.tokens + elapsed * bucket.refillRatePerSecond);
    bucket.lastRefill = now;
  }

  private getWaitMs(bucket: Bucket): number {
    // If server told us when it resets, use that
    if (bucket.serverResetAt) {
      const resetMs = bucket.serverResetAt * 1000;
      const now = Date.now();
      if (resetMs > now) return resetMs - now + 500; // add small buffer
    }
    // Otherwise calculate from refill rate
    const tokensNeeded = 1 - bucket.tokens;
    return Math.ceil((tokensNeeded / bucket.refillRatePerSecond) * 1000) + 100;
  }
}
