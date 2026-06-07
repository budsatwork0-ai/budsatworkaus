import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';
import { organiseJournalCapture } from '@/lib/story/journal-autofill';
import { evaluateOpportunity } from '@/lib/story/opportunity-scoring';
import { classifyOpportunityExposure } from '@/lib/story/internal-opportunity-filter';
import type { JournalEntryDraft } from '@/types/journal';
import type { StoryOpportunity } from '@/types/story-engine';

/**
 * POST /api/journal/quick-capture
 *
 * Appends a short text capture to today's journal entry (creating it if needed),
 * then runs the full post-save pipeline synchronously:
 *   1. organiseJournalCapture() — fills structured sections from raw_capture
 *   2. Opportunity creation — once per entry, only if content_potential_rating !== 'none'
 *   3. Scoring — runs evaluateOpportunity() inline (no HTTP round-trip)
 *
 * Body: { text: string; media_note?: string }
 * Returns: { id, entry_date, created, opportunity_id }
 */
export async function POST(req: NextRequest) {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (authUser.role !== 'admin') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  let body: { text?: unknown; media_note?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) return NextResponse.json({ error: 'text is required and must be a non-empty string' }, { status: 400 });
  if (text.length > 2000) return NextResponse.json({ error: 'text must be 2000 characters or fewer' }, { status: 400 });

  // media_note is a human-readable attachment summary, e.g. "🎤 Voice note (0:12) · 📷 photo.jpg"
  const mediaNote = typeof body.media_note === 'string' && body.media_note.trim()
    ? body.media_note.trim()
    : null;

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Brisbane' }).format(new Date());

  // ── Fetch today's existing entry ──────────────────────────────────────────────
  const { data: existing, error: fetchErr } = await (client as any)
    .from('founder_journal_entries')
    .select('id, raw_capture, tags, arc_connections, content_potential_rating, story_opportunity_created, media_references')
    .eq('entry_date', today)
    .maybeSingle();

  if (fetchErr) {
    console.error('[api/journal/quick-capture] fetch error:', fetchErr.message);
    return NextResponse.json({ error: 'Failed to check for existing entry' }, { status: 500 });
  }

  let entryId: string;
  let created: boolean;
  let fullRaw: string;
  let alreadyHasOpportunity: boolean;

  if (existing) {
    const priorRaw = existing.raw_capture?.trim() ?? '';
    fullRaw = priorRaw ? `${priorRaw}\n\n${text}` : text;
    alreadyHasOpportunity = !!existing.story_opportunity_created;

    const mergedMedia = mediaNote
      ? (existing.media_references ? `${existing.media_references}\n${mediaNote}` : mediaNote)
      : existing.media_references ?? null;

    const { error: updateErr } = await (client as any)
      .from('founder_journal_entries')
      .update({ raw_capture: fullRaw, media_references: mergedMedia })
      .eq('id', existing.id);

    if (updateErr) {
      console.error('[api/journal/quick-capture] update error:', updateErr.message);
      return NextResponse.json({ error: 'Failed to append capture' }, { status: 500 });
    }

    entryId = existing.id;
    created = false;
  } else {
    const { data: inserted, error: insertErr } = await (client as any)
      .from('founder_journal_entries')
      .insert({
        entry_date:               today,
        raw_capture:              text,
        tags:                     [],
        arc_connections:          [],
        content_potential_rating: 'none',
        media_references:         mediaNote,
      })
      .select('id')
      .single();

    if (insertErr) {
      if (insertErr.code === '23505') {
        return NextResponse.json({ error: 'Entry for today was just created — please retry' }, { status: 409 });
      }
      console.error('[api/journal/quick-capture] insert error:', insertErr.message);
      return NextResponse.json({ error: 'Failed to create entry' }, { status: 500 });
    }

    entryId = inserted.id;
    created = true;
    fullRaw = text;
    alreadyHasOpportunity = false;
  }

  // ── Autofill ──────────────────────────────────────────────────────────────────
  // organiseJournalCapture() is deterministic — safe to re-run on every append.
  // It classifies sentences into sections, assigns tags, arc connections, and
  // updates all four suggestion fields.
  const draft: JournalEntryDraft = {
    entry_date:                         today,
    raw_capture:                        fullRaw,
    tags:                               existing?.tags ?? [],
    arc_connections:                    existing?.arc_connections ?? [],
    content_potential_rating:           existing?.content_potential_rating ?? 'none',
    wins:                               null,
    challenges:                         null,
    customer_activity:                  null,
    silvan_updates:                     null,
    business_progress:                  null,
    bud_os_progress:                    null,
    memorable_moments:                  null,
    lessons_learned:                    null,
    content_potential_notes:            null,
    media_references:                   null,
    suggested_story_bible_note:         null,
    suggested_character_timeline_entry: null,
    suggested_arc_update:               null,
    suggested_open_thread_update:       null,
  };

  const organised = organiseJournalCapture(draft);

  const { error: autofillErr } = await (client as any)
    .from('founder_journal_entries')
    .update({
      wins:                               organised.wins,
      challenges:                         organised.challenges,
      customer_activity:                  organised.customer_activity,
      silvan_updates:                     organised.silvan_updates,
      business_progress:                  organised.business_progress,
      bud_os_progress:                    organised.bud_os_progress,
      memorable_moments:                  organised.memorable_moments,
      lessons_learned:                    organised.lessons_learned,
      content_potential_notes:            organised.content_potential_notes,
      content_potential_rating:           organised.content_potential_rating,
      tags:                               organised.tags,
      arc_connections:                    organised.arc_connections,
      suggested_story_bible_note:         organised.suggested_story_bible_note,
      suggested_character_timeline_entry: organised.suggested_character_timeline_entry,
      suggested_arc_update:               organised.suggested_arc_update,
      suggested_open_thread_update:       organised.suggested_open_thread_update,
    })
    .eq('id', entryId);

  if (autofillErr) {
    // Non-fatal — raw capture is saved; autofill failed but the entry is usable.
    console.error('[api/journal/quick-capture] autofill error:', autofillErr.message);
  }

  // ── Opportunity creation ──────────────────────────────────────────────────────
  // Guards:
  //   • story_opportunity_created prevents a second opportunity on repeated appends
  //   • content_potential_rating !== 'none' blocks junk/internal-only captures
  let opportunityId: string | null = null;

  if (!alreadyHasOpportunity && organised.content_potential_rating !== 'none') {
    const firstSentence = fullRaw.split(/[.!?\n]/)[0]?.trim() ?? '';
    const title = (firstSentence.slice(0, 120) || fullRaw.slice(0, 80)).trim();

    const { data: opp, error: oppErr } = await (client as any)
      .from('story_opportunities')
      .insert({
        title,
        source_type:        'journal',
        source_ref_id:      entryId,
        content_angle:      organised.content_potential_notes?.slice(0, 500) ?? '',
        notes:              fullRaw.slice(0, 500),
        status:             'new',
        section:            'surfaced',
        priority:           0,
        related_characters: [],
      })
      .select('id')
      .single();

    if (oppErr) {
      console.error('[api/journal/quick-capture] opportunity insert error:', oppErr.message);
    } else if (opp) {
      opportunityId = opp.id;

      // Mark entry so repeated appends don't create a second opportunity.
      await (client as any)
        .from('founder_journal_entries')
        .update({ story_opportunity_created: true })
        .eq('id', entryId);

      // ── Scoring ──────────────────────────────────────────────────────────────
      // evaluateOpportunity() is deterministic — run inline, no HTTP round-trip.
      const oppForScoring: StoryOpportunity = {
        id:                 opp.id,
        title,
        source_type:        'journal',
        source_ref_id:      entryId,
        related_arc_id:     null,
        related_characters: [],
        content_angle:      organised.content_potential_notes?.slice(0, 500) ?? '',
        suggested_format:   '',
        suggested_platform: '',
        priority:           0,
        status:             'new',
        section:            'surfaced',
        notes:              fullRaw.slice(0, 500),
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

      const { error: scoreErr } = await (client as any)
        .from('story_opportunities')
        .update({
          source_type:     exposure === 'internal_system_milestone' ? 'internal_system_milestone' : 'journal',
          story_score:     scoringResult.story_score,
          score_breakdown: scoringResult.score_breakdown,
          score_reason:    scoringResult.score_reason,
          scored_at:       new Date().toISOString(),
        })
        .eq('id', opp.id);

      if (scoreErr) {
        console.error('[api/journal/quick-capture] scoring error:', scoreErr.message);
      }

      // Return score so the widget can decide whether to trigger /suggest.
      return NextResponse.json(
        {
          id:             entryId,
          entry_date:     today,
          created,
          opportunity_id: opportunityId,
          story_score:    scoringResult.story_score,
        },
        { status: created ? 201 : 200 },
      );
    }
  }

  return NextResponse.json(
    { id: entryId, entry_date: today, created, opportunity_id: opportunityId, story_score: null },
    { status: created ? 201 : 200 },
  );
}
