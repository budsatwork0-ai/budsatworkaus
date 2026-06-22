import { NextResponse } from 'next/server';
import { createStructuredArtifact, requireAdmin } from '@/lib/artifacts/server';
import {
  buildCampaignArtifact,
  buildResearchServiceOutput,
  buildStrategyOutput,
} from '@/lib/campaign-factory/mvp';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { buildStoryIntelligenceRecommendations } from '@/lib/story-intelligence/recommendations';
import { CAMPAIGN_FACTORY_GOALS, type CampaignFactoryGoal } from '@/types/campaign-factory-mvp';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: RouteParams) {
  const { id } = await params;
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const loaded = await loadRunAndRecommendation(client as any, id);
  if ('error' in loaded) return loaded.error;

  const research = await buildResearchServiceOutput(client as any, loaded.goal, loaded.recommendation);
  const strategy = buildStrategyOutput(loaded.goal, loaded.recommendation, research);
  const artifact = buildCampaignArtifact(loaded.recommendation, strategy, research);

  const created = await createStructuredArtifact({
    client: client as any,
    type: 'campaign',
    title: artifact.title,
    summary: artifact.summary,
    status: 'in_review',
    score: loaded.recommendation.score,
    metadata: {
      campaign_factory: true,
      step: 'campaign_artifact',
      goal: loaded.goal,
      supported_deliverables: ['Facebook Post', 'Instagram Post', 'TikTok Script', 'Email'],
    },
    sourceContext: {
      run_id: id,
      recommendation: loaded.recommendation,
      research,
      strategy,
      automation_boundary: 'artifact_generation_only',
    },
    content: artifact.content,
    plainText: artifact.plainText,
    generationInput: { goal: loaded.goal, recommendation: loaded.recommendation, research, strategy },
    generationModel: 'deterministic-campaign-factory-v1',
    createdBy: auth.authUser.id,
    campaignFactoryRunId: id,
    campaignFactoryRole: 'primary',
    tags: ['campaign-factory', 'campaign', loaded.goal.toLowerCase().replace(/\s+/g, '-')],
  });

  if (created.error) {
    console.error('[api/campaign-factory/runs/[id]/campaign-artifact] artifact:', created.error.message);
    return NextResponse.json({ error: 'Failed to create campaign artifact' }, { status: 500 });
  }

  const { data: run, error: updateError } = await (client as any)
    .from('campaign_factory_runs')
    .update({
      status: 'artifact_review',
      current_step: 'campaign_artifact',
      research_summary: research,
      strategy,
      approval_state: {
        pending_artifact_id: created.artifact.id,
        boundary: 'approval_stops_at_artifact',
      },
    })
    .eq('id', id)
    .select()
    .single();

  if (updateError) {
    console.error('[api/campaign-factory/runs/[id]/campaign-artifact] run:', updateError.message);
    return NextResponse.json({ error: 'Campaign artifact created but run update failed' }, { status: 500 });
  }

  return NextResponse.json({ run, artifact: created.artifact, research, strategy });
}

async function loadRunAndRecommendation(client: any, id: string) {
  const { data: run, error } = await client.from('campaign_factory_runs').select('*').eq('id', id).single();
  if (error) {
    return {
      error: NextResponse.json(
        { error: error.code === 'PGRST116' ? 'Campaign Factory run not found' : 'Failed to fetch Campaign Factory run' },
        { status: error.code === 'PGRST116' ? 404 : 500 },
      ),
    };
  }

  const goal = normaliseGoal(run.goal);
  if (!goal) return { error: NextResponse.json({ error: 'Run has an unsupported Campaign Factory goal' }, { status: 400 }) };
  if (!run.selected_story_opportunity_id) {
    return { error: NextResponse.json({ error: 'Run does not have a selected story recommendation' }, { status: 400 }) };
  }

  const recommendations = await buildStoryIntelligenceRecommendations(client);
  const recommendation = recommendations.recommendations.find((item) => item.opportunityId === run.selected_story_opportunity_id);
  if (!recommendation) {
    return { error: NextResponse.json({ error: 'Selected Story Intelligence recommendation is no longer available' }, { status: 404 }) };
  }

  return { run, goal, recommendation };
}

function normaliseGoal(value: string): CampaignFactoryGoal | null {
  return (CAMPAIGN_FACTORY_GOALS as readonly string[]).includes(value) ? value as CampaignFactoryGoal : null;
}
