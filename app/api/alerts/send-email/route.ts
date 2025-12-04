import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/alerts/send-email
 *
 * Send an email notification using Resend API.
 * Requires RESEND_API_KEY environment variable.
 *
 * Body:
 * - to: string (recipient email)
 * - subject: string
 * - html: string (HTML content)
 * - text?: string (optional plain text fallback)
 */
export async function POST(request: Request) {
  try {
    // Check for API key
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: 'Email service not configured. Set RESEND_API_KEY environment variable.',
          help: 'Get a free API key at https://resend.com (100 emails/day free)'
        },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { to, subject, html, text } = body;

    // Validate required fields
    if (!to || !subject || !html) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: to, subject, html' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email address format' },
        { status: 400 }
      );
    }

    // Send email
    const success = await sendEmail({ to, subject, html, text });

    if (success) {
      return NextResponse.json({
        success: true,
        message: `Email sent to ${to}`,
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Failed to send email' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error sending email:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to send email' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/alerts/send-email
 *
 * Check email service status
 */
export async function GET() {
  const hasResendKey = !!process.env.RESEND_API_KEY;
  const hasSendGridKey = !!process.env.SENDGRID_API_KEY;
  const fromAddress = process.env.EMAIL_FROM || 'alerts@tswi.space';

  return NextResponse.json({
    success: true,
    status: {
      email_service_configured: hasResendKey || hasSendGridKey,
      provider: hasResendKey ? 'resend' : hasSendGridKey ? 'sendgrid' : null,
      from_address: fromAddress,
    },
    help: !hasResendKey && !hasSendGridKey
      ? 'Set RESEND_API_KEY (free at resend.com) or SENDGRID_API_KEY to enable email notifications'
      : 'Email service is configured and ready',
  });
}
