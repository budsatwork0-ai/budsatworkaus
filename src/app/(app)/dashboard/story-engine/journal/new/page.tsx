'use client';

import Link from 'next/link';
import { WorkbenchHeader } from '../../../components/Workbench';
import JournalEntryForm from '../_components/JournalEntryForm';

export default function NewJournalEntryPage() {
  return (
    <div className="flex flex-col gap-5">
      <WorkbenchHeader
        eyebrow="Founder Journal"
        title="New Entry"
        description="Write today. The Story Engine reads from here."
        actions={
          <Link
            href="/dashboard/story-engine/journal"
            className="rounded-xl px-4 py-2 text-sm font-medium"
            style={{ background: '#F1F5F9', color: '#64748B' }}
          >
            ← All entries
          </Link>
        }
      />
      <JournalEntryForm mode="new" />
    </div>
  );
}
