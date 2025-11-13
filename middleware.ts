import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Routes that don't require authentication
const PUBLIC_ROUTES = ['/login', '/api/health']

// Routes that should redirect to dashboard if authenticated
const AUTH_ROUTES = ['/login']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public routes and static assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') ||
    PUBLIC_ROUTES.some(route => pathname === route)
  ) {
    return NextResponse.next()
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

  return NextResponse.next()
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
