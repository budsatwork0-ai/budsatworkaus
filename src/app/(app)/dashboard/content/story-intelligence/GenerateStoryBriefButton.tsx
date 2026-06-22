'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export function GenerateStoryBriefButton({ opportunityId }: { opportunityId: string }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  async function createBrief() {
    setCreating(true);
    try {
      const res = await fetch('/api/story-intelligence/brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunity_id: opportunityId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to create Story Brief');
        return;
      }
      toast.success('Story Brief Artifact created');
      router.push(`/dashboard/content/artifacts/${data.artifact.id}`);
    } catch {
      toast.error('Failed to create Story Brief');
    } finally {
      setCreating(false);
    }
  }

  return (
    <button
      type="button"
      onClick={createBrief}
      disabled={creating}
      className="rounded-xl bg-emerald-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {creating ? 'Creating brief...' : 'Generate Story Brief'}
    </button>
  );
}
