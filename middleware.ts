import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Routes that don't require authentication
const PUBLIC_ROUTES = ['/login', '/api/health', '/api/auth/login', '/api/test-login']

// Routes that should redirect to dashboard if authenticated
const AUTH_ROUTES = ['/login']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Handle CORS preflight for API routes
  if (pathname.startsWith('/api/') && request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }

  // Allow public routes, API routes, and static assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.startsWith('/api/') || // Allow all API routes (they handle their own auth)
    pathname.includes('.') ||
    PUBLIC_ROUTES.some(route => pathname === route)
  ) {
    const response = NextResponse.next()
    // Add CORS headers for API routes
    if (pathname.startsWith('/api/')) {
      response.headers.set('Access-Control-Allow-Origin', '*')
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    }
    return response
  }

  // Check for session cookie
  const session = request.cookies.get('tswi_session')
  const isAuthenticated = !!session?.value

  // Redirect to login if trying to access protected route without auth
  if (!isAuthenticated && !pathname.startsWith('/login')) {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  // Redirect to dashboard if trying to access login while authenticated
  if (isAuthenticated && AUTH_ROUTES.includes(pathname)) {
    const dashboardUrl = new URL('/dashboard', request.url)
    return NextResponse.redirect(dashboardUrl)
  }

  const response = NextResponse.next()
  // Add CORS headers for API routes
  if (pathname.startsWith('/api/')) {
    response.headers.set('Access-Control-Allow-Origin', '*')
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  }
  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*|public).*)',
  ],
}
