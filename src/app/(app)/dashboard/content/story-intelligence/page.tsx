import { notFound } from 'next/navigation';
import { getAuthUser } from '@/lib/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { WorkbenchHeader } from '../../components/Workbench';
import { IdeasInboxClient } from './IdeasInboxClient';

export default async function IdeasPage() {
  const authUser = await getAuthUser();
  if (!authUser || authUser.role !== 'admin') notFound();

  const client = createServiceClientSafe();
  if (!client) notFound();

  const [ideasResult, oppsResult] = await Promise.all([
    (client as any)
      .from('content_ideas')
      .select('*')
      .order('priority')
      .order('created_at', { ascending: false }),
    (client as any)
      .from('story_opportunities')
      .select('id, title, story_score, source_type')
      .order('story_score', { ascending: false })
      .limit(5),
  ]);

  const ideas = ideasResult.data ?? [];
  const opportunities = oppsResult.data ?? [];

  return (
    <div className="flex flex-col gap-5">
      <WorkbenchHeader
        eyebrow="Content"
        title="Ideas"
        description="Capture and develop content ideas. Pull from story opportunities or add your own, then send them to Create."
      />
      <IdeasInboxClient
        initialIdeas={ideas}
        initialOpportunities={opportunities}
      />
    </div>
  );
}
