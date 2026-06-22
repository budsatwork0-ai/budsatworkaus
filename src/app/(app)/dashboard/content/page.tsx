import { getAuthUser } from '@/lib/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { buildStoryIntelligenceRecommendations } from '@/lib/story-intelligence/recommendations';
import { WorkbenchHeader } from '../components/Workbench';
import { CampaignFactoryClient } from './CampaignFactoryClient';

export default async function ContentHomePage() {
  const authUser = await getAuthUser();
  const client = authUser?.role === 'admin' ? createServiceClientSafe() : null;

  const [storyIntelligence, { data: runs }, { data: artifacts }] = client
    ? await Promise.all([
        buildStoryIntelligenceRecommendations(client as any),
        (client as any)
          .from('campaign_factory_runs')
          .select('*')
          .order('updated_at', { ascending: false })
          .limit(5),
        (client as any)
          .from('artifacts')
          .select('*')
          .order('updated_at', { ascending: false })
          .limit(5),
      ])
    : [{ recommendations: [] }, { data: [] }, { data: [] }];

  return (
    <div className="flex flex-col gap-5">
      <WorkbenchHeader
        eyebrow="Content"
        title="Campaign Factory"
        description="Start with the outcome. Campaign Factory turns an explainable Story Intelligence recommendation into research, strategy, and a narrow campaign artifact for review."
      />
      <CampaignFactoryClient
        initialRecommendations={storyIntelligence.recommendations}
        initialRuns={runs ?? []}
        initialArtifacts={artifacts ?? []}
      />
    </div>
  );
}
