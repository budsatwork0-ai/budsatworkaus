import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getAuthUser } from '@/lib/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { WorkbenchHeader } from '../components/Workbench';
import { ContentPackageClient } from './ContentPackageClient';

export default async function ContentHomePage() {
  const authUser = await getAuthUser();
  if (!authUser || authUser.role !== 'admin') notFound();

  const client = createServiceClientSafe();
  if (!client) notFound();

  // Fetch 3 most recently approved learnings for the "What worked before" strip
  const { data: learnings } = await (client as any)
    .from('content_learning_records')
    .select('id, goal, campaign_title, what_worked')
    .eq('status', 'approved')
    .order('updated_at', { ascending: false })
    .limit(3);

  return (
    <div className="flex flex-col gap-5">
      <WorkbenchHeader
        eyebrow="Content"
        title="Create"
        description="Turn an idea into a full content package — story brief, hooks, script, caption, CTA, and teleprompter. Powered by approved learnings."
      />
      <Suspense fallback={null}>
        <ContentPackageClient initialLearnings={learnings ?? []} />
      </Suspense>
    </div>
  );
}
