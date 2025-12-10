import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

// POST - Accept invite and create user account
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const body = await request.json();
    const { password } = body;

    if (!code || code.length !== 12) {
      return NextResponse.json(
        { success: false, error: 'Invalid invite code' },
        { status: 400 }
      );
    }

    if (!password || password.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    const db = await getDb();
    const invitesCollection = db.collection('invites');
    const usersCollection = db.collection('users');

    const invite = await invitesCollection.findOne({ inviteCode: code });

    if (!invite) {
      return NextResponse.json(
        { success: false, error: 'Invite not found' },
        { status: 404 }
      );
    }

    // Check if expired
    if (new Date() > new Date(invite.expiresAt)) {
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

    // Check if user already exists
    const existingUser = await usersCollection.findOne({
      email: invite.email.toLowerCase(),
    });

    if (existingUser) {
      // User already exists, just mark invite as accepted
      await invitesCollection.updateOne(
        { inviteCode: code },
        {
          $set: {
            status: 'accepted',
            acceptedAt: new Date(),
          }
        }
      );
      return NextResponse.json({
        success: true,
        message: 'Account already exists. Please sign in.',
        userExists: true,
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    const now = new Date();

    // Create user account
    const newUser = {
      email: invite.email.toLowerCase(),
      name: invite.name,
      company: invite.organization,
      role: 'user',
      password_hash: passwordHash,
      created_at: now,
      last_login: now,
    };

    await usersCollection.insertOne(newUser);

    // Mark invite as accepted
    await invitesCollection.updateOne(
      { inviteCode: code },
      {
        $set: {
          status: 'accepted',
          acceptedAt: now,
        }
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Account created successfully',
      userExists: false,
    });
  } catch (error) {
    console.error('Error accepting invite:', error);
    return NextResponse.json(
      { success: false, error: 'An error occurred' },
      { status: 500 }
    );
  }
}
