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

    let db;
    try {
      db = await getDb();
      console.log('DB connection successful');
    } catch (dbError) {
      console.error('MongoDB connection failed:', dbError);
      return NextResponse.json(
        { success: false, error: 'Database connection failed' },
        { status: 500 }
      );
    }

    const invitesCollection = db.collection('invites');

    // Check if an active invite already exists for this email
    let existingInvite;
    try {
      existingInvite = await invitesCollection.findOne({
        email: email.toLowerCase(),
        status: { $in: ['pending', 'sent'] },
      });
    } catch (findError) {
      console.error('Error checking existing invite:', findError);
      return NextResponse.json(
        { success: false, error: 'Database query failed' },
        { status: 500 }
      );
    }

    if (existingInvite) {
      return NextResponse.json(
        { success: false, error: 'An active invite already exists for this email' },
        { status: 400 }
      );
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    // Generate invite code
    let inviteCode;
    try {
      inviteCode = generateInviteCode();
      console.log('Generated invite code:', inviteCode);
    } catch (codeError) {
      console.error('Error generating invite code:', codeError);
      return NextResponse.json(
        { success: false, error: 'Failed to generate invite code' },
        { status: 500 }
      );
    }

    const invite = {
      email: email.toLowerCase(),
      name,
      title: title || undefined, // Use undefined instead of empty string for optional
      organization,
      inviteCode,
      status: 'pending' as const,
      channel: channel || 'email',
      notes: notes || undefined, // Use undefined instead of empty string for optional
      createdAt: now,
      sentAt: null,
      acceptedAt: null,
      expiresAt,
    };

    console.log('Invite object to validate:', JSON.stringify(invite, null, 2));

    // Validate with schema
    let validated;
    try {
      validated = InviteSchema.omit({ _id: true }).parse(invite);
      console.log('Validation successful');
    } catch (validationError) {
      console.error('Zod validation failed:', validationError);
      return NextResponse.json(
        { success: false, error: `Validation failed: ${validationError instanceof Error ? validationError.message : 'Unknown'}` },
        { status: 400 }
      );
    }

    let result;
    try {
      result = await invitesCollection.insertOne(validated);
      console.log('Insert successful, ID:', result.insertedId);
    } catch (insertError) {
      console.error('MongoDB insert failed:', insertError);
      return NextResponse.json(
        { success: false, error: 'Failed to save invite' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      invite: {
        _id: result.insertedId,
        ...validated,
      },
    });
  } catch (error) {
    console.error('Error creating invite:', error);

    // Log detailed error info
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      if ('errors' in error) {
        console.error('Zod errors:', JSON.stringify((error as any).errors, null, 2));
      }
    }

    // Return more detailed error for debugging
    const errorMessage = error instanceof Error ? error.message : 'An error occurred';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
