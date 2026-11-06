import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { jwtVerify } from 'jose';

// Public routes - no auth required
const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/invite',
  '/request-access',
  '/access-denied',
  '/set-password',
  '/api/health',
  '/api/auth',
  '/api/access-requests',
  '/api/invite',
];

// Admin routes - require a verified admin JWT
const ADMIN_ROUTES = ['/admin'];

// Admin API routes that don't need admin auth (like login)
const ADMIN_PUBLIC_API = ['/api/admin/login'];

const ADMIN_SESSION_COOKIE = 'tswi_admin_session';

/**
 * Verify the admin session cookie. Fails closed: returns false when the
 * cookie is missing, the signature/expiry is invalid, isAdmin is not true,
 * or NEXTAUTH_SECRET is unset.
 */
async function isVerifiedAdmin(request: NextRequest): Promise<boolean> {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return false;

  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) return false;

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    return payload.isAdmin === true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // API routes
  if (pathname.startsWith('/api/')) {
    // Admin API routes - require verified admin JWT
    if (pathname.startsWith('/api/admin/') && !ADMIN_PUBLIC_API.includes(pathname)) {
      if (!(await isVerifiedAdmin(request))) {
        return NextResponse.json(
          { success: false, error: 'Admin authentication required' },
          { status: 401 }
        );
      }
    }

    return NextResponse.next();
  }

  // Check if route is public
  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  );

  // Check if route is admin route
  const isAdminRoute = ADMIN_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  );

  // Handle admin routes
  if (isAdminRoute) {
    // Admin login page doesn't need auth; skip it if already verified
    if (pathname === '/admin/login') {
      if (await isVerifiedAdmin(request)) {
        return NextResponse.redirect(new URL('/admin', request.url));
      }
      return NextResponse.next();
    }

    // All other admin routes require a verified admin session
    if (!(await isVerifiedAdmin(request))) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }

    return NextResponse.next();
  }

  // Public routes - allow access
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Protected routes - require NextAuth session
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*|public).*)',
  ],
};
