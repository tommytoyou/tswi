import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { sendEmail } from '@/lib/notifications';
import {
  createPasswordToken,
  hasRecentPasswordToken,
  buildSetPasswordUrl,
} from '@/lib/auth/password-tokens';

export const dynamic = 'force-dynamic';

const GENERIC_RESPONSE = {
  success: true,
  message: 'If that email is registered, a link has been sent.',
};

const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

/**
 * POST /api/auth/password-reset/request  { email }
 *
 * Always returns the same 200 response so it cannot be used to discover
 * which emails are registered.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!email || email.length > 254) {
      return NextResponse.json(GENERIC_RESPONSE);
    }

    const db = await getDb();
    const user = await db.collection('users').findOne({ email });

    if (user && !(await hasRecentPasswordToken(email, RATE_LIMIT_WINDOW_MS))) {
      const token = await createPasswordToken(email);
      const link = buildSetPasswordUrl(token);

      await sendEmail({
        to: email,
        subject: 'Set your TSWI password',
        html: generateResetEmail(link),
        text: `Use this link to set your TSWI password: ${link}\n\nThe link expires in 60 minutes and can be used once. If you didn't request this, you can ignore this email.`,
      });
    }
  } catch (error) {
    // Log server-side; never reveal anything to the caller
    console.error('[PasswordReset] Request error:', error);
  }

  return NextResponse.json(GENERIC_RESPONSE);
}

function generateResetEmail(link: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Set your TSWI password</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8fafc;">
  <div style="background: #0f172a; color: white; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="margin: 0; font-size: 24px;">TSWI</h1>
  </div>
  <div style="background: white; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; padding: 30px;">
    <p style="color: #374151; margin: 0 0 20px;">Use the button below to set your TSWI password.</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${link}"
         style="display: inline-block; background: #3b82f6; color: white; padding: 14px 40px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
        Set Password
      </a>
    </div>
    <p style="color: #6b7280; font-size: 13px; margin: 0;">
      This link expires in 60 minutes and can be used once. If you didn't request it, you can ignore this email.
    </p>
  </div>
</body>
</html>
  `.trim();
}
