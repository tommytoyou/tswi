import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';

/**
 * Fail-closed auth for /api/cron/* routes.
 *
 * Accepts only `Authorization: Bearer <CRON_SECRET>`. Returns a response to send
 * back when the request must be rejected, or null when it is authorized.
 * - CRON_SECRET unset/empty -> 503 (never compare against "undefined")
 * - header missing or wrong  -> 401
 */
export function checkCronAuth(request: Request, routeName: string): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error(`[Cron:${routeName}] CRON_SECRET is not set; refusing request`);
    return NextResponse.json({ success: false, error: 'Cron not configured' }, { status: 503 });
  }

  const authHeader = request.headers.get('authorization') ?? '';
  const expected = Buffer.from(`Bearer ${cronSecret}`);
  const actual = Buffer.from(authHeader);

  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}
