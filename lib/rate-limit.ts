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

/**
 * Count this request against the limit. Returns a 429 response when the
 * caller is over the limit, or null when the request may proceed.
 */
export async function checkRateLimit(request: Request, rule: RateLimitRule): Promise<NextResponse | null> {
  const ip = getClientIp(request);
  const windowMs = rule.windowSeconds * 1000;
  const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
  const expiresAt = new Date(windowStart + windowMs);

  try {
    await ensureIndex();
    const db = await getDb();
    const doc = await db.collection(COLLECTION).findOneAndUpdate(
      { _id: `${rule.route}:${ip}:${windowStart}` as any },
      { $inc: { count: 1 }, $setOnInsert: { route: rule.route, ip, expiresAt } },
      { upsert: true, returnDocument: 'after' }
    );

    const count = (doc?.count as number) ?? 1;
    if (count > rule.limit) {
      const retryAfter = Math.max(1, Math.ceil((expiresAt.getTime() - Date.now()) / 1000));
      console.warn(`[RateLimit] ${rule.route} limit exceeded for ${ip} (${count}/${rule.limit})`);
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      );
    }
    return null;
  } catch (err) {
    console.error(`[RateLimit] ${rule.route} check failed; allowing request:`, err);
    return null;
  }
}
