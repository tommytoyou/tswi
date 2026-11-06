import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDb } from '@/lib/db';
import { consumePasswordToken } from '@/lib/auth/password-tokens';
import type { User } from '@/lib/types';

export const dynamic = 'force-dynamic';

const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 72; // bcrypt ignores bytes beyond 72

/**
 * POST /api/auth/set-password  { token, password }
 *
 * The email comes only from the single-use token, never from the client.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
    }

    if ('email' in body) {
      return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
    }

    const { token, password } = body as { token?: unknown; password?: unknown };

    if (typeof token !== 'string' || typeof password !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Token and password are required' },
        { status: 400 }
      );
    }

    // Validate the password before consuming the token so a typo doesn't burn the link
    if (password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { success: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` },
        { status: 400 }
      );
    }
    if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_LENGTH) {
      return NextResponse.json(
        { success: false, error: `Password must be at most ${MAX_PASSWORD_LENGTH} bytes` },
        { status: 400 }
      );
    }

    const email = await consumePasswordToken(token);
    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Link invalid or expired' },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const db = await getDb();
    const result = await db
      .collection<User>('users')
      .updateOne({ email }, { $set: { password_hash: passwordHash } });

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Link invalid or expired' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Password set successfully. You can now sign in with email and password.',
    });
  } catch (error) {
    console.error('Error setting password:', error);
    return NextResponse.json(
      { success: false, error: 'An error occurred while setting your password' },
      { status: 500 }
    );
  }
}
