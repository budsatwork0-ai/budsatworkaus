// Shared helper for writing Growth Department pipeline activity log entries.
// Never throws — event logging failures must not break the primary user action.

export type PipelineEventType =
  | 'opportunity_detected'
  | 'opportunity_scored'
  | 'idea_created'
  | 'idea_scored'
  | 'script_generated'
  | 'queue_item_created'
  | 'trend_scouted'
  | 'trend_adapted'
  | 'arc_stale_flag'
  | 'thread_stale_flag'
  | 'production_card_stale_flag'
  | 'asset_match_suggested'
  | 'consent_unresolved_flag'
  | 'campaign_kpi_report'
  | 'cadence_behind_flag'
  | 'format_learning_report'
  | 'format_learning_insight';

export type PipelineSourceType =
  | 'journal_entry'
  | 'opportunity'
  | 'idea'
  | 'production_card'
  | 'story_arc'
  | 'open_thread'
  | 'content_asset'
  | 'marketing_campaign'
  | 'social_channel'
  | 'publishing_queue';

export type PipelineResultType =
  | 'story_opportunity'
  | 'content_idea'
  | 'content_script'
  | 'publishing_queue_item';

export interface PipelineEventPayload {
  event_type:        PipelineEventType;
  source_type?:      PipelineSourceType;
  source_id?:        string;
  result_type?:      PipelineResultType;
  result_id?:        string;
  journal_entry_id?: string;
  metadata?:         Record<string, unknown>;
}

export async function logPipelineEvent(
  client: any,
  payload: PipelineEventPayload,
): Promise<void> {
  try {
    await client.from('growth_pipeline_events').insert({
      event_type:       payload.event_type,
      source_type:      payload.source_type ?? null,
      source_id:        payload.source_id ?? null,
      result_type:      payload.result_type ?? null,
      result_id:        payload.result_id ?? null,
      journal_entry_id: payload.journal_entry_id ?? null,
      metadata:         payload.metadata ?? null,
    });
  } catch (err) {
    console.error('[growth/pipeline-events] Failed to log event:', payload.event_type, err);
  }
}
