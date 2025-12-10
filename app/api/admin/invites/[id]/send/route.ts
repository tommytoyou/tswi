import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAdminSession } from '@/lib/auth/admin';
import { ObjectId } from 'mongodb';
import { sendEmail } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

// POST - Send invite email
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminSession = await getAdminSession();
    if (!adminSession) {
      return NextResponse.json(
        { success: false, error: 'Admin authentication required' },
        { status: 401 }
      );
    }

    const { id } = await params;

    const db = await getDb();
    const invitesCollection = db.collection('invites');

    // Find the invite
    let invite;
    try {
      invite = await invitesCollection.findOne({ _id: new ObjectId(id) });
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid invite ID' },
        { status: 400 }
      );
    }

    if (!invite) {
      return NextResponse.json(
        { success: false, error: 'Invite not found' },
        { status: 404 }
      );
    }

    // Check if invite is expired
    if (new Date() > new Date(invite.expiresAt)) {
      await invitesCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: 'expired' } }
      );
      return NextResponse.json(
        { success: false, error: 'Invite has expired' },
        { status: 400 }
      );
    }

    // Check if already accepted
    if (invite.status === 'accepted') {
      return NextResponse.json(
        { success: false, error: 'Invite has already been accepted' },
        { status: 400 }
      );
    }

    const appUrl = process.env.NEXTAUTH_URL || 'https://www.tswi-ai.com';
    const inviteUrl = `${appUrl}/invite/${invite.inviteCode}`;

    // Generate and send the email
    const html = generateInviteEmail(invite.name, inviteUrl);
    const text = generateInviteText(invite.name, inviteUrl);

    const emailSent = await sendEmail({
      to: invite.email,
      subject: 'TSWI Platform Access',
      html,
      text,
    });

    if (!emailSent) {
      return NextResponse.json({
        success: false,
        error: 'Failed to send email. Check RESEND_API_KEY configuration.',
      }, { status: 500 });
    }

    // Update invite status
    await invitesCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: 'sent',
          sentAt: new Date(),
        }
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Invite email sent successfully',
    });
  } catch (error) {
    console.error('Error sending invite:', error);
    return NextResponse.json(
      { success: false, error: 'An error occurred' },
      { status: 500 }
    );
  }
}

function generateInviteEmail(name: string, inviteUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TSWI Platform Access</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 40px 20px; background: #f8f9fa;">

  <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 4px; padding: 40px;">

    <p style="margin: 0 0 24px; color: #1a1a1a; font-size: 15px;">
      ${name},
    </p>

    <p style="margin: 0 0 24px; color: #374151; font-size: 15px;">
      You have been granted early access to TSWI - Tactical Space Weather Intelligence.
    </p>

    <p style="margin: 0 0 32px; color: #374151; font-size: 15px;">
      TSWI provides real-time space weather monitoring for satellite operations, including solar wind, CME tracking, and aurora forecasts.
    </p>

    <div style="margin: 32px 0;">
      <a href="${inviteUrl}"
         style="display: inline-block; background: #1a1a1a; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 4px; font-weight: 500; font-size: 14px;">
        Access TSWI
      </a>
    </div>

    <p style="margin: 32px 0 0; color: #6b7280; font-size: 13px;">
      This invitation expires in 30 days.
    </p>

  </div>

  <div style="margin-top: 32px; padding: 0 20px; color: #6b7280; font-size: 13px;">
    <p style="margin: 0;">Deep Space Dynamics</p>
    <p style="margin: 4px 0 0;">tswi-ai.com</p>
  </div>

</body>
</html>
  `.trim();
}

function generateInviteText(name: string, inviteUrl: string): string {
  return `${name},

You have been granted early access to TSWI - Tactical Space Weather Intelligence.

TSWI provides real-time space weather monitoring for satellite operations, including solar wind, CME tracking, and aurora forecasts.

Access your account: ${inviteUrl}

This invitation expires in 30 days.

Deep Space Dynamics
tswi-ai.com`;
}
