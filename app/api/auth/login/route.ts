import { NextRequest, NextResponse } from 'next/server';
import { validateCredentials, AUTHENTICATED_USER } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const text = await request.text();
    const body = JSON.parse(text);
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    const isValid = validateCredentials(username, password);

    if (isValid) {
      // Serialize user object for JSON response
      const userForResponse = {
        ...AUTHENTICATED_USER,
        created_at: AUTHENTICATED_USER.created_at.toISOString(),
      };

      // Create session data
      const sessionData = {
        user: userForResponse,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      };

      // Create response with session cookie
      const response = NextResponse.json({
        success: true,
        user: userForResponse,
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
