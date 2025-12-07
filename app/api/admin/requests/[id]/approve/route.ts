import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAdminSession } from '@/lib/auth/admin';
import { ObjectId } from 'mongodb';
import { sendEmail } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

// POST - Approve an access request
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
    const body = await request.json();
    const { role = 'user' } = body;

    if (!['user', 'user_ai'].includes(role)) {
      return NextResponse.json(
        { success: false, error: 'Invalid role' },
        { status: 400 }
      );
    }

    const db = await getDb();
    const accessRequestsCollection = db.collection('access_requests');
    const usersCollection = db.collection('users');

    // Find the access request
    const accessRequest = await accessRequestsCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!accessRequest) {
      return NextResponse.json(
        { success: false, error: 'Access request not found' },
        { status: 404 }
      );
    }

    if (accessRequest.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: 'This request has already been processed' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await usersCollection.findOne({
      email: accessRequest.email,
    });

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'User already exists in the system' },
        { status: 400 }
      );
    }

    // Create user in users collection
    const now = new Date();
    await usersCollection.insertOne({
      email: accessRequest.email,
      name: accessRequest.name,
      company: accessRequest.company,
      role: role as 'user' | 'user_ai',
      created_at: now,
      last_login: now,
    });

    // Update access request status
    await accessRequestsCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: 'approved',
          reviewed_at: now,
          reviewed_by: adminSession.email,
        },
      }
    );

    // Send approval email directly (not via HTTP to avoid serverless issues)
    let emailSent = false;
    try {
      console.log(`[Approve] Sending approval email to ${accessRequest.email}`);

      const appUrl = process.env.NEXTAUTH_URL || 'https://www.tswi-ai.com';
      const html = generateApprovalEmail(accessRequest.name, appUrl);

      emailSent = await sendEmail({
        to: accessRequest.email,
        subject: 'Your TSWI Access Has Been Approved',
        html,
        text: `Hi ${accessRequest.name}, Your TSWI access has been approved! Sign in at ${appUrl}/login`,
      });

      if (emailSent) {
        console.log('[Approve] Approval email sent successfully');
      } else {
        console.warn('[Approve] Email was not sent - check email service configuration');
      }
    } catch (emailError) {
      console.error('[Approve] Failed to send approval email:', emailError);
      // Continue even if email fails
    }

    return NextResponse.json({
      success: true,
      message: 'Access request approved successfully',
    });
  } catch (error) {
    console.error('Error approving access request:', error);
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
