'use client';

import { useCallback, useEffect, useState } from 'react';

const BRIDGE_URL = 'http://localhost:3747';

type Status = 'checking' | 'live' | 'offline';

export function BridgeStatus() {
  const [status, setStatus] = useState<Status>('checking');

  const check = useCallback(async () => {
    try {
      const res = await fetch(`${BRIDGE_URL}/health`, { signal: AbortSignal.timeout(1500) });
      setStatus(res.ok ? 'live' : 'offline');
    } catch {
      setStatus('offline');
    }
  }, []);

  useEffect(() => {
    // Only matters when on a remote origin (Vercel) — localhost already has full access
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') return;
    void check();
    const id = setInterval(() => void check(), 15_000);
    return () => clearInterval(id);
  }, [check]);

  // Don't render on localhost — commands work directly there
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') return null;
  if (status === 'checking') return null;

  if (status === 'live') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-500/[0.08] px-2.5 py-1 text-[11px] font-medium text-emerald-300">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        bridge live
      </span>
    );
  }

  return (
    <span
      title="node scripts/bud-bridge.js"
      className="inline-flex cursor-help items-center gap-1.5 rounded-full border border-white/[0.10] bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-white/40"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
      no bridge
    </span>
  );
}

/** React context so GraphifyTab can read bridge status without re-fetching */
export const BRIDGE_BASE = BRIDGE_URL;
