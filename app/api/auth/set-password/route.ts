import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDb } from '@/lib/db';
import type { User } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    const db = await getDb();
    const usersCollection = db.collection<User>('users');

    // Find approved user by email
    const user = await usersCollection.findOne({ email: email.toLowerCase() });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Email not found. You must be an approved user to set a password.' },
        { status: 404 }
      );
    }

    // Hash the password
    const passwordHash = await bcrypt.hash(password, 12);

    // Update user with password hash
    await usersCollection.updateOne(
      { email: email.toLowerCase() },
      { $set: { password_hash: passwordHash } }
    );

    return NextResponse.json({
      success: true,
      message: 'Password set successfully. You can now sign in with email and password.',
    });
  } catch (error) {
    console.error('Error setting password:', error);
    return NextResponse.json(
      { success: false, error: 'An error occurred while setting your password' },
      { status: 500 }
    );
  }
}
