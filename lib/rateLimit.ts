/**
 * In-memory per-IP rate limiter.
 *
 * Module-level Map singleton — entries persist for the lifetime of the Node
 * process. Cleared on server restart/cold-start (acceptable per Phase 15 D-04).
 *
 * Default threshold: 10 attempts per 10-minute window per IP (D-06).
 *
 * Usage:
 *   const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
 *     ?? request.headers.get('x-real-ip')
 *     ?? 'unknown';
 *   const rl = checkRateLimit(ip);
 *   if (rl.limited) {
 *     return NextResponse.json(
 *       { error: 'Too many attempts. Please try again later.' },
 *       { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
 *     );
 *   }
 */

interface RateLimitEntry {
  count: number;
  resetAt: number; // unix ms timestamp when this window expires
}

const store = new Map<string, RateLimitEntry>();

export interface RateLimitResult {
  limited: boolean;
  retryAfterSeconds: number;
}

/**
 * Records an attempt for the given IP and reports whether the limit has been exceeded.
 *
 * @param ip - Caller IP (callers should extract from x-forwarded-for / x-real-ip).
 * @param maxAttempts - Maximum attempts allowed per window. Default 10 (D-06).
 * @param windowMs - Window length in milliseconds. Default 10 * 60 * 1000 = 600000 (D-06).
 * @returns `{ limited, retryAfterSeconds }`. When `limited` is true, the caller
 *          should respond with HTTP 429 and a `Retry-After: <retryAfterSeconds>` header.
 */
export function checkRateLimit(
  ip: string,
  maxAttempts = 10,
  windowMs = 10 * 60 * 1000,
): RateLimitResult {
  const now = Date.now();
  const entry = store.get(ip);

  if (!entry || now > entry.resetAt) {
    store.set(ip, { count: 1, resetAt: now + windowMs });
    return { limited: false, retryAfterSeconds: 0 };
  }

  entry.count += 1;
  if (entry.count > maxAttempts) {
    const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
    return { limited: true, retryAfterSeconds };
  }

  return { limited: false, retryAfterSeconds: 0 };
}
