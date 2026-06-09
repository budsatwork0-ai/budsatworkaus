import { evaluateOpportunity } from '@/lib/story/opportunity-scoring';
import { classifyOpportunityExposure } from '@/lib/story/internal-opportunity-filter';
import { logPipelineEvent } from '@/lib/growth/pipeline-events';
import type { StoryOpportunity } from '@/types/story-engine';

// Creates one story opportunity from a full-form journal entry, then scores it.
// Idempotent: protected by story_opportunity_created flag on the entry.
// Never throws — wrap call sites in try/catch so journal saves never fail.
export async function runJournalOpportunityPipeline(client: any, entry: any): Promise<void> {
  const contentText = [
    entry.content_potential_notes,
    entry.wins,
    entry.customer_activity,
    entry.business_progress,
  ].filter(Boolean).join(' ');

  const firstLine = contentText.split(/[.!?\n]/)[0]?.trim() ?? '';
  const title = (firstLine.slice(0, 120) || entry.entry_date).trim();

  const { data: opp, error: oppErr } = await client
    .from('story_opportunities')
    .insert({
      title,
      source_type:        'journal',
      source_ref_id:      entry.id,
      content_angle:      (entry.content_potential_notes ?? '').slice(0, 500),
      notes:              contentText.slice(0, 500),
      status:             'new',
      section:            'surfaced',
      priority:           0,
      related_characters: [],
    })
    .select('id')
    .single();

  if (oppErr) {
    console.error('[lib/journal/pipeline] opportunity insert error:', oppErr.message);
    return;
  }

  // Mark entry so the gate prevents a second opportunity on any future PUT.
  await client
    .from('founder_journal_entries')
    .update({ story_opportunity_created: true })
    .eq('id', entry.id);

  await logPipelineEvent(client, {
    event_type:      'opportunity_detected',
    source_type:     'journal_entry',
    source_id:       entry.id,
    result_type:     'story_opportunity',
    result_id:       opp.id,
    journal_entry_id: entry.id,
    metadata:        { trigger: 'full_journal_form', rating: entry.content_potential_rating },
  });

  // Score inline — deterministic, no LLM.
  const oppForScoring: StoryOpportunity = {
    id:                 opp.id,
    title,
    source_type:        'journal',
    source_ref_id:      entry.id,
    related_arc_id:     null,
    related_characters: [],
    content_angle:      (entry.content_potential_notes ?? '').slice(0, 500),
    suggested_format:   '',
    suggested_platform: '',
    priority:           0,
    status:             'new',
    section:            'surfaced',
    notes:              contentText.slice(0, 500),
    is_auto_detected:   false,
    detection_rule:     null,
    detection_reason:   null,
    confidence_score:   null,
    source_hash:        null,
    story_score:        null,
    score_breakdown:    null,
    score_reason:       null,
    scored_at:          null,
    created_at:         new Date().toISOString(),
    updated_at:         new Date().toISOString(),
  };

  const scoringResult = evaluateOpportunity(oppForScoring);
  const exposure      = classifyOpportunityExposure(oppForScoring);

  await client
    .from('story_opportunities')
    .update({
      source_type:     exposure === 'internal_system_milestone' ? 'internal_system_milestone' : 'journal',
      story_score:     scoringResult.story_score,
      score_breakdown: scoringResult.score_breakdown,
      score_reason:    scoringResult.score_reason,
      scored_at:       new Date().toISOString(),
    })
    .eq('id', opp.id);

  await logPipelineEvent(client, {
    event_type:       'opportunity_scored',
    source_type:      'opportunity',
    source_id:        opp.id,
    result_type:      'story_opportunity',
    result_id:        opp.id,
    journal_entry_id: entry.id,
    metadata:         { story_score: scoringResult.story_score, exposure },
  });
}
