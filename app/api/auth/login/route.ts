import { NextRequest, NextResponse } from 'next/server';
import { validateCredentials, AUTHENTICATED_USER } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    if (validateCredentials(username, password)) {
      // Create session data
      const sessionData = {
        user: AUTHENTICATED_USER,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      };

      // Create response with session cookie
      const response = NextResponse.json({
        success: true,
        user: AUTHENTICATED_USER,
      });

      // Set HTTP-only cookie
      response.cookies.set('tswi_session', JSON.stringify(sessionData), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24, // 24 hours
        path: '/',
      });

      return response;
    } else {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'An error occurred during login' },
      { status: 500 }
    );
  }
}
