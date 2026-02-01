import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  
  // College routes that require authentication
  const protectedCollegeRoutes = [
    '/college/dashboard',
    '/college/students',
    '/college/jobs',
  ];

  const isProtectedRoute = protectedCollegeRoutes.some(route => 
    path.startsWith(route)
  );

  // Check if accessing college protected routes
  if (isProtectedRoute) {
    const session = request.cookies.get('college_session');
    
    if (!session) {
      // Redirect to login
      const loginUrl = new URL('/college/login', request.url);
      loginUrl.searchParams.set('redirect', path);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/college/dashboard/:path*',
    '/college/students/:path*',
    '/college/jobs/:path*',
  ],
};

