/**
 * Next.js proxy middleware
 * Auth disabled for dev - will be replaced with Clerk when implemented
 */

import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  // Auth disabled for dev - just pass through all requests
  // TODO: Replace with Clerk auth middleware when implemented
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
     * - api routes (handled separately)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
