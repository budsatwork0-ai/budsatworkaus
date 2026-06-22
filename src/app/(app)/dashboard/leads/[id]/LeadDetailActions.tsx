'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { brand } from '@/app/ui/theme';

type Props = {
  leadId: string;
  responseStatus: string;
  hasQuote: boolean;
};

export function LeadDetailActions({ leadId, responseStatus, hasQuote }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [localStatus, setLocalStatus] = useState(responseStatus);

  async function patchStatus(status: 'in_conversation' | 'lost') {
    setPending(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/status`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(await res.text());
      setLocalStatus(status);
      toast.success(status === 'in_conversation' ? 'Marked as contacted' : 'Archived');
      router.refresh();
    } catch {
      toast.error('Action failed — try again');
    } finally {
      setPending(false);
    }
  }

  const canMarkContacted = localStatus === 'awaiting_response' || localStatus === 'no_response';
  const canConvert = !hasQuote && localStatus !== 'lost' && localStatus !== 'completed';
  const canArchive = localStatus !== 'lost' && localStatus !== 'completed';

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canMarkContacted && (
        <button
          type="button"
          disabled={pending}
          onClick={() => void patchStatus('in_conversation')}
          className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          style={{ background: brand.accent }}
        >
          {pending ? 'Updating…' : 'Mark Contacted'}
        </button>
      )}
      {canConvert && (
        <Link
          href={`/services?lead_id=${leadId}`}
          className="rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-semibold transition hover:bg-slate-50"
          style={{ color: brand.text }}
        >
          Convert to Quote
        </Link>
      )}
      {canArchive && (
        <button
          type="button"
          disabled={pending}
          onClick={() => void patchStatus('lost')}
          className="rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
        >
          Archive
        </button>
      )}
    </div>
  );
}
