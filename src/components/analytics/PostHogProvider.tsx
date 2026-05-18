'use client';

import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, Suspense } from 'react';

// Paths excluded from PostHog tracking — same exclusion list as the custom analytics layer
const EXCLUDED_PATHS = ['/dashboard', '/crew', '/portal', '/api'];

function isExcluded(path: string) {
  return EXCLUDED_PATHS.some((p) => path.startsWith(p));
}

function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (pathname && !isExcluded(pathname)) {
      posthog.capture('$pageview', {
        $current_url: window.location.href,
      });
    }
  }, [pathname, searchParams]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

  useEffect(() => {
    if (!key) return;

    posthog.init(key, {
      api_host: host,
      capture_pageview: false, // Handled by PageViewTracker
      capture_pageleave: true,
      persistence: 'localStorage+cookie',
      session_recording: {
        maskAllInputs: false,
        maskInputOptions: { password: true, email: true, tel: true },
      },
      loaded: (ph) => {
        if (isExcluded(window.location.pathname)) {
          ph.opt_out_capturing();
        }
        if (process.env.NODE_ENV === 'development') {
          ph.debug();
        }
      },
    });
  }, [key, host]);

  if (!key) return <>{children}</>;

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PageViewTracker />
      </Suspense>
      {children}
    </PHProvider>
  );
}
