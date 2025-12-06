import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  console.log('[SendApprovalEmail] Received request');

  try {
    const body = await request.json();
    const { email, name } = body;
    console.log(`[SendApprovalEmail] Processing for: ${email}, name: ${name}`);

    if (!email || !name) {
      console.error('[SendApprovalEmail] Missing required fields');
      return NextResponse.json(
        { success: false, error: 'Email and name are required' },
        { status: 400 }
      );
    }

    // Check if Resend API key is configured
    if (!process.env.RESEND_API_KEY) {
      console.error('[SendApprovalEmail] RESEND_API_KEY is not configured');
      return NextResponse.json({
        success: true,
        emailSent: false,
        reason: 'RESEND_API_KEY not configured',
      });
    }

    console.log('[SendApprovalEmail] RESEND_API_KEY is configured');

    const appUrl = process.env.NEXTAUTH_URL || 'https://www.tswi-ai.com';
    console.log(`[SendApprovalEmail] Using app URL: ${appUrl}`);

    const html = generateApprovalEmail(name, appUrl);

    console.log(`[SendApprovalEmail] Calling sendEmail to: ${email}`);
    const success = await sendEmail({
      to: email,
      subject: 'Your TSWI Access Has Been Approved',
      html,
      text: `Hi ${name}, Your TSWI access has been approved! Sign in at ${appUrl}/login`,
    });

    if (!success) {
      console.warn('[SendApprovalEmail] sendEmail returned false - email not sent');
    } else {
      console.log('[SendApprovalEmail] Email sent successfully');
    }

    return NextResponse.json({
      success: true,
      emailSent: success,
    });
  } catch (error) {
    console.error('[SendApprovalEmail] Error:', error);
    return NextResponse.json(
      { success: false, error: 'An error occurred' },
      { status: 500 }
    );
  }
}

function generateApprovalEmail(name: string, appUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TSWI Access Approved</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8fafc;">

  <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="margin: 0; font-size: 28px;">Welcome to TSWI</h1>
    <p style="margin: 10px 0 0; opacity: 0.9;">Tactical Space Weather Intelligence</p>
  </div>

  <div style="background: white; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; padding: 30px;">

    <div style="margin-bottom: 20px;">
      <span style="background: #22c55e; color: white; padding: 8px 16px; border-radius: 20px; font-weight: bold; text-transform: uppercase; font-size: 12px; letter-spacing: 1px;">
        ACCESS APPROVED
      </span>
    </div>

    <h2 style="color: #111827; margin: 20px 0 10px;">Hi ${name}!</h2>

    <p style="color: #374151; margin: 20px 0;">
      Great news! Your request to access TSWI has been approved. You can now sign in using your Google account to access the space weather monitoring dashboard.
    </p>

    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin: 25px 0;">
      <h3 style="color: #166534; margin: 0 0 10px; font-size: 16px;">What you can do:</h3>
      <ul style="color: #166534; margin: 0; padding-left: 20px;">
        <li>Monitor real-time solar wind conditions</li>
        <li>Track geomagnetic storm indicators</li>
        <li>View solar flare and CME events</li>
        <li>Set up custom alert notifications</li>
        <li>Explore 3D space weather visualizations</li>
      </ul>
    </div>

    <div style="margin-top: 30px; text-align: center;">
      <a href="${appUrl}/login"
         style="display: inline-block; background: #3b82f6; color: white; padding: 14px 40px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
        Sign In Now
      </a>
    </div>

    <p style="color: #9ca3af; font-size: 13px; margin: 30px 0 0; text-align: center;">
      Sign in with the same Google account you used to request access.
    </p>

  </div>

  <div style="text-align: center; margin-top: 30px; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p>Questions? Reply to this email and we'll help you get started.</p>
    <p style="margin: 10px 0 0;">TSWI - Space Weather Intelligence Platform</p>
  </div>

</body>
</html>
  `.trim();
}
