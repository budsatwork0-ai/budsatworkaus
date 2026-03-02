// src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createMiddlewareClient } from '@/lib/supabase/middleware';
import { resolveUserRole } from '@/types/roles';

export async function middleware(req: NextRequest) {
  const { supabase, response } = createMiddlewareClient(req);
  const { pathname } = req.nextUrl;

  // Webhook routes use their own signature verification — skip auth
  if (pathname.startsWith('/api/webhooks')) return response();

  const isDashboard = pathname.startsWith('/dashboard');
  const isCrew = pathname.startsWith('/crew');
  const isPortal = pathname.startsWith('/portal');
  const isProtected = isDashboard || isCrew || isPortal;

  // Always call getUser() so Supabase can refresh the session cookie on every request.
  const { data: { user } } = await supabase.auth.getUser();

  if (!isProtected) return response();

  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = '/account';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  let role = resolveUserRole(user.app_metadata?.role);

  // Keep routing resilient when JWT metadata is stale or missing.
  if (!user.app_metadata?.role) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    role = resolveUserRole(profile?.role);
  }

  // Strict role-based routing — redirect to wrong-portal so users understand what happened.
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

  // Employees are redirected away from the customer portal; admins are allowed through
  // (they may need to inspect the customer experience).
  if (isPortal && role === 'employee') {
    const url = req.nextUrl.clone();
    url.pathname = '/account/wrong-portal';
    url.searchParams.set('from', 'portal');
    return NextResponse.redirect(url);
  }

  return response();
}

// Match all routes except static files/_next
export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
};
