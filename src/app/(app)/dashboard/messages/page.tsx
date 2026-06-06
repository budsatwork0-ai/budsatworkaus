'use client';

/**
 * /dashboard/messages
 * Full-page messaging view — opens the MessagingHub slide-over in global inbox
 * mode automatically on mount, then redirects back to /dashboard when closed.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOpenMessaging } from '../hooks/useMessagingHub';

export default function MessagesPage() {
  const openMessaging = useOpenMessaging();
  const router = useRouter();

  useEffect(() => {
    // Dispatch after a brief paint so the layout slide-over animates in cleanly.
    const id = setTimeout(() => openMessaging(), 80);
    return () => clearTimeout(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-[40vh] items-center justify-center px-4">
      <div className="text-center">
        <p className="text-sm text-slate-500">Opening messages&hellip;</p>
        <button
          onClick={() => router.back()}
          className="mt-4 text-xs text-slate-400 underline"
        >
          Go back
        </button>
      </div>
    </div>
  );
}
