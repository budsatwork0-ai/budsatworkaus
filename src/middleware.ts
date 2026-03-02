// src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function runMiddleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  // Webhook routes bypass auth entirely
  if (pathname.startsWith('/api/webhooks')) return NextResponse.next();

  const isDashboard = pathname.startsWith('/dashboard');
  const isCrew = pathname.startsWith('/crew');
  const isPortal = pathname.startsWith('/portal');
  const isProtected = isDashboard || isCrew || isPortal;

  // If Supabase env vars aren't configured, fail open on public routes
  // and redirect unauthenticated on protected routes rather than crashing.
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    if (isProtected) {
      const url = req.nextUrl.clone();
      url.pathname = '/account';
      url.searchParams.set('redirect', pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Lazy-import so a missing/broken module never crashes the middleware at load time.
  const { createMiddlewareClient } = await import('@/lib/supabase/middleware');
  const { resolveUserRole } = await import('@/types/roles');

  const { supabase, response } = createMiddlewareClient(req);

  // Refresh the session cookie on every request.
  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user'] = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    if (isProtected) {
      const url = req.nextUrl.clone();
      url.pathname = '/account';
      url.searchParams.set('redirect', pathname);
      return NextResponse.redirect(url);
    }
    return response();
  }

  if (!isProtected) return response();

  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = '/account';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  // Always read role from the profiles table so that admin-applied role
  // changes take effect immediately at the routing layer (not just in API routes).
  // JWT app_metadata is used only as a final fallback if the DB query fails.
  let role = resolveUserRole(user.app_metadata?.role);
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    if (profile?.role) role = resolveUserRole(profile.role);
  } catch {
    // Keep the JWT-based role resolved above.
  }

  if (isDashboard && role !== 'admin') {
    const url = req.nextUrl.clone();
    url.pathname = '/account/wrong-portal';
    url.searchParams.set('from', 'dashboard');
    return NextResponse.redirect(url);
  }

  if (isCrew && role === 'customer') {
    const url = req.nextUrl.clone();
    url.pathname = '/account/wrong-portal';
    url.searchParams.set('from', 'crew');
    return NextResponse.redirect(url);
  }

  if (isPortal && role === 'employee') {
    const url = req.nextUrl.clone();
    url.pathname = '/account/wrong-portal';
    url.searchParams.set('from', 'portal');
    return NextResponse.redirect(url);
  }

  return response();
}

export async function middleware(req: NextRequest) {
  try {
    return await runMiddleware(req);
  } catch (err) {
    console.error('[middleware] Unhandled error:', err);
    const { pathname } = req.nextUrl;
    const isProtected =
      pathname.startsWith('/dashboard') ||
      pathname.startsWith('/crew') ||
      pathname.startsWith('/portal');
    if (isProtected) {
      return NextResponse.redirect(new URL('/account', req.url));
    }
    return NextResponse.next();
  }
}

// Match all routes except static files/_next
export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
};
