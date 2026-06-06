// src/app/(app)/dashboard/hooks/useMessagingHub.ts
// Small cross-component messaging bridge.
// Entity pages dispatch a CustomEvent; DashboardLayout listens and opens the hub.

'use client';

import { useCallback, useEffect } from 'react';
import type { EntityContext } from '@/types/messaging';

const EVENT_NAME = 'bud:open-messaging';

/** Called from entity pages (Customers, Crew, Leads, Applicants) to open the MessagingHub. */
export function useOpenMessaging() {
  return useCallback((entityContext?: EntityContext) => {
    window.dispatchEvent(
      new CustomEvent<{ entityContext?: EntityContext }>(EVENT_NAME, {
        detail: { entityContext },
      }),
    );
  }, []);
}

/** Called from DashboardLayout to listen for open requests. */
export function useMessagingHubListener(
  onOpen: (entityContext?: EntityContext) => void,
) {
  useEffect(() => {
    const handler = (e: Event) => {
      const ev = e as CustomEvent<{ entityContext?: EntityContext }>;
      onOpen(ev.detail?.entityContext);
    };
    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
  }, [onOpen]);
}
