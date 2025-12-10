import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAdminSession } from '@/lib/auth/admin';
import { InviteSchema } from '@/lib/types';
import { nanoid } from 'nanoid';

export const dynamic = 'force-dynamic';

// Generate a 12-character alphanumeric invite code
function generateInviteCode(): string {
  return nanoid(12);
}

// GET - List all invites
export async function GET(request: NextRequest) {
  try {
    const adminSession = await getAdminSession();
    if (!adminSession) {
      return NextResponse.json(
        { success: false, error: 'Admin authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'all';

    const db = await getDb();
    const invitesCollection = db.collection('invites');

    const query = status === 'all' ? {} : { status };
    const invites = await invitesCollection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({
      success: true,
      invites,
    });
  } catch (error) {
    console.error('Error fetching invites:', error);
    return NextResponse.json(
      { success: false, error: 'An error occurred' },
      { status: 500 }
    );
  }
}

// POST - Create new invite
export async function POST(request: NextRequest) {
  try {
    const adminSession = await getAdminSession();
    if (!adminSession) {
      return NextResponse.json(
        { success: false, error: 'Admin authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { email, name, title, organization, notes, channel } = body;

    // Validate required fields
    if (!email || !name || !organization) {
      return NextResponse.json(
        { success: false, error: 'Email, name, and organization are required' },
        { status: 400 }
      );
    }

    const db = await getDb();
    const invitesCollection = db.collection('invites');

    // Check if an active invite already exists for this email
    const existingInvite = await invitesCollection.findOne({
      email: email.toLowerCase(),
      status: { $in: ['pending', 'sent'] },
    });

    if (existingInvite) {
      return NextResponse.json(
        { success: false, error: 'An active invite already exists for this email' },
        { status: 400 }
      );
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    const invite = {
      email: email.toLowerCase(),
      name,
      title: title || '',
      organization,
      inviteCode: generateInviteCode(),
      status: 'pending' as const,
      channel: channel || 'email',
      notes: notes || '',
      createdAt: now,
      sentAt: null,
      acceptedAt: null,
      expiresAt,
    };

    // Validate with schema
    const validated = InviteSchema.omit({ _id: true }).parse(invite);

    const result = await invitesCollection.insertOne(validated);

    return NextResponse.json({
      success: true,
      invite: {
        _id: result.insertedId,
        ...validated,
      },
    });
  } catch (error) {
    console.error('Error creating invite:', error);
    return NextResponse.json(
      { success: false, error: 'An error occurred' },
      { status: 500 }
    );
  }
}
