import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET - Validate invite code
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;

    if (!code || code.length !== 12) {
      return NextResponse.json(
        { success: false, error: 'Invalid invite code' },
        { status: 400 }
      );
    }

    const db = await getDb();
    const invitesCollection = db.collection('invites');

    const invite = await invitesCollection.findOne({ inviteCode: code });

    if (!invite) {
      return NextResponse.json(
        { success: false, error: 'Invite not found' },
        { status: 404 }
      );
    }

    // Check if expired
    if (new Date() > new Date(invite.expiresAt)) {
      // Update status to expired if not already
      if (invite.status !== 'expired') {
        await invitesCollection.updateOne(
          { inviteCode: code },
          { $set: { status: 'expired' } }
        );
      }
      return NextResponse.json(
        { success: false, error: 'This invitation has expired' },
        { status: 410 }
      );
    }

    // Check if already accepted
    if (invite.status === 'accepted') {
      return NextResponse.json(
        { success: false, error: 'This invitation has already been used' },
        { status: 410 }
      );
    }

    // Return invite info (limited for security)
    return NextResponse.json({
      success: true,
      invite: {
        name: invite.name,
        email: invite.email,
        organization: invite.organization,
        expiresAt: invite.expiresAt,
      },
    });
  } catch (error) {
    console.error('Error validating invite:', error);
    return NextResponse.json(
      { success: false, error: 'An error occurred' },
      { status: 500 }
    );
  }
}
