import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public paths that don't require auth
  const publicPaths = ['/', '/favicon.ico'];
  const isPublicPath = publicPaths.some(p => pathname === p);
  const isStaticAsset = pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname.includes('.');

  if (isPublicPath || isStaticAsset) {
    return NextResponse.next();
  }

  // Check for auth token in cookie or header
  // Since we use localStorage on the client, we rely on client-side auth checks
  // The middleware only handles basic route structure protection
  // Actual auth validation happens in the layout components

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
