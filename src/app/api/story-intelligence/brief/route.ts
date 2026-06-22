import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  buildArtifactLibraryItem,
  buildVersionInsert,
  requireAdmin,
  upsertArtifactLibraryItem,
} from '@/lib/artifacts/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import {
  buildStoryBriefArtifact,
  buildStoryIntelligenceRecommendations,
} from '@/lib/story-intelligence/recommendations';

const storyBriefRequestSchema = z.object({
  opportunity_id: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  let parsed: ReturnType<typeof storyBriefRequestSchema.parse>;
  try {
    parsed = storyBriefRequestSchema.parse(await req.json());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid request body' }, { status: 400 });
  }

  const recommendations = await buildStoryIntelligenceRecommendations(client as any);
  const recommendation = recommendations.recommendations.find((item) => item.opportunityId === parsed.opportunity_id);
  if (!recommendation) {
    return NextResponse.json({ error: 'Story recommendation not found' }, { status: 404 });
  }

  const brief = buildStoryBriefArtifact(recommendation);
  const title = `Story Brief: ${recommendation.recommendedStory}`;
  const summary = `Explainable Story Intelligence brief for "${recommendation.recommendedStory}" supporting ${recommendation.businessGoal}.`;

  const { data: artifact, error } = await (client as any)
    .from('artifacts')
    .insert({
      type: 'story',
      title,
      summary,
      status: 'draft',
      score: recommendation.score,
      metadata: {
        story_intelligence: true,
        business_goal: recommendation.businessGoal,
        score_formula: recommendation.scoreFormula,
      },
      source_context: {
        recommendation,
        source: 'story_intelligence',
        opportunity_id: recommendation.opportunityId,
      },
      created_by: auth.authUser.id,
    })
    .select()
    .single();

  if (error) {
    console.error('[api/story-intelligence/brief] artifact:', error.message);
    return NextResponse.json({ error: 'Failed to create Story Brief Artifact' }, { status: 500 });
  }

  const { data: version, error: versionError } = await (client as any)
    .from('artifact_versions')
    .insert(buildVersionInsert({
      artifactId: artifact.id,
      versionNumber: 1,
      title,
      summary,
      content: brief.artifactContent,
      plainText: brief.plainText,
      generationInput: { recommendation },
      generationModel: 'deterministic-story-intelligence-v1',
      createdBy: auth.authUser.id,
    }))
    .select()
    .single();

  if (versionError) {
    console.error('[api/story-intelligence/brief] version:', versionError.message);
    await (client as any).from('artifacts').delete().eq('id', artifact.id);
    return NextResponse.json({ error: 'Failed to create Story Brief version' }, { status: 500 });
  }

  const { data: updatedArtifact, error: updateError } = await (client as any)
    .from('artifacts')
    .update({ latest_version_id: version.id })
    .eq('id', artifact.id)
    .select()
    .single();

  if (updateError) {
    console.error('[api/story-intelligence/brief] latest:', updateError.message);
    await (client as any).from('artifacts').delete().eq('id', artifact.id);
    return NextResponse.json({ error: 'Failed to attach Story Brief version' }, { status: 500 });
  }

  const { error: libraryError } = await upsertArtifactLibraryItem(
    client as any,
    buildArtifactLibraryItem({
      artifactId: artifact.id,
      type: 'story',
      title,
      summary,
      status: 'draft',
      tags: ['story-intelligence', recommendation.businessGoal.toLowerCase().replace(/\s+/g, '-')],
    }),
  );

  if (libraryError) {
    console.error('[api/story-intelligence/brief] library:', libraryError.message);
  }

  return NextResponse.json({ artifact: { ...updatedArtifact, latest_version: version } }, { status: 201 });
}
