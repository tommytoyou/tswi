import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Public routes - no auth required
const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/request-access',
  '/access-denied',
  '/api/health',
  '/api/auth',
  '/api/access-requests',
];

// Admin routes - require admin cookie
const ADMIN_ROUTES = ['/admin'];

// Admin API routes that don't need admin auth (like login)
const ADMIN_PUBLIC_API = ['/api/admin/login'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Handle CORS preflight for API routes
  if (pathname.startsWith('/api/') && request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  // Allow static assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Check if this is an API route
  if (pathname.startsWith('/api/')) {
    const response = NextResponse.next();
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Admin API routes - check admin session
    if (pathname.startsWith('/api/admin/') && !ADMIN_PUBLIC_API.includes(pathname)) {
      const adminSession = request.cookies.get('tswi_admin_session');
      if (!adminSession?.value) {
        return NextResponse.json(
          { success: false, error: 'Admin authentication required' },
          { status: 401 }
        );
      }
    }

    return response;
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
    // Admin login page doesn't need auth
    if (pathname === '/admin/login') {
      const adminSession = request.cookies.get('tswi_admin_session');
      if (adminSession?.value) {
        // Already logged in, redirect to admin dashboard
        return NextResponse.redirect(new URL('/admin', request.url));
      }
      return NextResponse.next();
    }

    // All other admin routes require admin session
    const adminSession = request.cookies.get('tswi_admin_session');
    if (!adminSession?.value) {
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
    // Not authenticated - redirect to login
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // User is authenticated - allow access to protected routes
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
