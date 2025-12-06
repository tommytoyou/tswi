import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAdminSession } from '@/lib/auth/admin';
import { ObjectId } from 'mongodb';

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

    // Send approval email
    let emailSent = false;
    try {
      const emailUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:5000'}/api/admin/send-approval-email`;
      console.log(`[Approve] Sending approval email to ${accessRequest.email} via ${emailUrl}`);

      const emailResponse = await fetch(emailUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: accessRequest.email,
          name: accessRequest.name,
        }),
      });

      const emailResult = await emailResponse.json();
      console.log('[Approve] Email API response:', emailResult);

      if (!emailResponse.ok) {
        console.error('[Approve] Email API returned error status:', emailResponse.status);
      } else if (!emailResult.emailSent) {
        console.warn('[Approve] Email was not sent - check email service configuration');
      } else {
        emailSent = true;
        console.log('[Approve] Approval email sent successfully');
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
