import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getAuthUser } from '@/lib/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { WorkbenchHeader } from '../../components/Workbench';
import { LearnClient } from './LearnClient';

export default async function ContentLearnPage() {
  const authUser = await getAuthUser();
  if (!authUser || authUser.role !== 'admin') notFound();

  const client = createServiceClientSafe();
  if (!client) notFound();

  const { data: records } = await (client as any)
    .from('content_learning_records')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(100);

  return (
    <div className="flex flex-col gap-5">
      <WorkbenchHeader
        eyebrow="Content"
        title="Learn"
        description="Log what worked, what failed, and the lesson. Approved learnings feed back into your next Create session."
      />
      <Suspense fallback={null}>
        <LearnClient initialRecords={records ?? []} />
      </Suspense>
    </div>
  );
}
