// src/middleware.ts
import { NextResponse } from 'next/server';
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isProtectedRoute = createRouteMatcher(['/dashboard(.*)']);

const hasClerkKeys = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);

const middleware = hasClerkKeys
  ? clerkMiddleware((auth, req) => {
      if (isProtectedRoute(req)) auth.protect();
    })
  : () => {
      // Allows local/dev usage without Clerk configured.
      // Note: protected routes will not be enforced until Clerk keys are set.
      return NextResponse.next();
    };

export default middleware;

// Match all routes except static files/_next
export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
};
