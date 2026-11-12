import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

/**
 * Simple fixed-window rate limiter backed by MongoDB.
 *
 * One document per (route, IP, window). A TTL index on `expiresAt` removes
 * old windows automatically. If MongoDB is unreachable the request is allowed
 * (fail open) so an outage does not lock everyone out; the error is logged.
 */

const COLLECTION = 'rate_limits';

export interface RateLimitRule {
  /** Short route key, e.g. 'login' */
  route: string;
  /** Max requests per window */
  limit: number;
  /** Window length in seconds */
  windowSeconds: number;
}

export const RATE_LIMITS = {
  accessRequests: { route: 'access-requests', limit: 5, windowSeconds: 60 * 60 },
  inviteAccept: { route: 'invite-accept', limit: 10, windowSeconds: 60 * 60 },
  // NextAuth credentials sign-in: per IP+email, and per IP across all emails
  credentialsIpEmail: { route: 'login-ip-email', limit: 10, windowSeconds: 15 * 60 },
  credentialsIp: { route: 'login-ip', limit: 30, windowSeconds: 15 * 60 },
} satisfies Record<string, RateLimitRule>;

let indexReady: Promise<unknown> | null = null;

function ensureIndex() {
  if (!indexReady) {
    indexReady = getDb()
      .then((db) => db.collection(COLLECTION).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }))
      .catch((err) => {
        indexReady = null; // retry on the next call
        throw err;
      });
  }
  return indexReady;
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}

export interface RateLimitResult {
  limited: boolean;
  /** Seconds until the current window resets (only meaningful when limited) */
  retryAfter: number;
}

/**
 * Count one attempt for `key` against `rule`. Fails open (limited: false)
 * when MongoDB is unreachable.
 */
export async function consumeRateLimit(key: string, rule: RateLimitRule): Promise<RateLimitResult> {
  const windowMs = rule.windowSeconds * 1000;
  const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
  const expiresAt = new Date(windowStart + windowMs);

  try {
    await ensureIndex();
    const db = await getDb();
    const doc = await db.collection(COLLECTION).findOneAndUpdate(
      { _id: `${rule.route}:${key}:${windowStart}` as any },
      { $inc: { count: 1 }, $setOnInsert: { route: rule.route, key, expiresAt } },
      { upsert: true, returnDocument: 'after' }
    );

    const count = (doc?.count as number) ?? 1;
    const retryAfter = Math.max(1, Math.ceil((expiresAt.getTime() - Date.now()) / 1000));
    if (count > rule.limit) {
      console.warn(`[RateLimit] ${rule.route} limit exceeded for ${key} (${count}/${rule.limit})`);
      return { limited: true, retryAfter };
    }
    return { limited: false, retryAfter };
  } catch (err) {
    console.error(`[RateLimit] ${rule.route} check failed; allowing request:`, err);
    return { limited: false, retryAfter: 0 };
  }
}

/**
 * Count this request against the limit, keyed by client IP. Returns a 429
 * response when the caller is over the limit, or null when it may proceed.
 */
export async function checkRateLimit(request: Request, rule: RateLimitRule): Promise<NextResponse | null> {
  const { limited, retryAfter } = await consumeRateLimit(getClientIp(request), rule);
  if (!limited) return null;
  return NextResponse.json(
    { success: false, error: 'Too many requests. Please try again later.' },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } }
  );
}
