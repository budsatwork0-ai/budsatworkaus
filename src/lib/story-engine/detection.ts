// Story Opportunity Detection Service — Phase 2E
//
// Scans real Bud OS tables and creates story_opportunities where genuine
// business events have narrative value. Each rule has a unique source_hash
// so the same event cannot create two opportunities.
//
// Server-only: must only be imported from API routes or server components.

import { createServiceClientSafe } from '@/lib/supabase/server';
import type { DetectionSummary, OpportunitySection } from '@/types/story-engine';

// ─── Internal insert shape ────────────────────────────────────────────────────

type OppInsert = {
  title: string;
  source_type: string;
  source_ref_id: string | null;
  related_arc_id: string | null;
  related_characters: string[];
  content_angle: string;
  suggested_format: string;
  suggested_platform: string;
  priority: number;
  status: 'new';
  section: OpportunitySection;
  notes: string;
  is_auto_detected: true;
  detection_rule: string;
  detection_reason: string;
  confidence_score: number;
  source_hash: string;
};

type RuleResult = {
  opps: OppInsert[];
  journalIdsToMark: string[];
  errors: string[];
};

function emptyResult(): RuleResult {
  return { opps: [], journalIdsToMark: [], errors: [] };
}

// ─── Rule helpers ─────────────────────────────────────────────────────────────

function formatDateAU(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-AU', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

// ─── Rule 1: High-potential journal entries ───────────────────────────────────
// Scans founder_journal_entries WHERE content_potential_rating = 'high'
// AND story_opportunity_created = false. One opportunity per entry.

async function detectJournalHighPotential(
  client: ReturnType<typeof createServiceClientSafe>,
  existingHashes: Set<string>,
): Promise<RuleResult> {
  const result = emptyResult();
  try {
    const { data: entries, error } = await (client as any)
      .from('founder_journal_entries')
      .select('id, entry_date, wins, content_potential_notes, tags')
      .eq('content_potential_rating', 'high')
      .eq('story_opportunity_created', false);

    if (error) { result.errors.push(`journal_high: ${error.message}`); return result; }

    for (const entry of entries ?? []) {
      const hash = `journal_high:${entry.id}`;
      if (existingHashes.has(hash)) continue;

      const angle = entry.content_potential_notes?.trim()
        || entry.wins?.trim()?.slice(0, 300)
        || 'See journal entry for full context.';

      result.opps.push({
        title:              `Journal ${formatDateAU(entry.entry_date)} — High potential`,
        source_type:        'journal',
        source_ref_id:      entry.id,
        related_arc_id:     null,
        related_characters: ['Jackson Taylor'],
        content_angle:      angle,
        suggested_format:   'Reel',
        suggested_platform: 'Instagram',
        priority:           1,
        status:             'new',
        section:            'surfaced',
        notes:              entry.tags?.length ? `Tags: ${entry.tags.join(', ')}` : '',
        is_auto_detected:   true,
        detection_rule:     'journal_high_potential',
        detection_reason:   `Journal entry from ${entry.entry_date} rated High content potential`,
        confidence_score:   0.9,
        source_hash:        hash,
      });
      result.journalIdsToMark.push(entry.id);
    }
  } catch (err) {
    result.errors.push(`journal_high: ${err instanceof Error ? err.message : String(err)}`);
  }
  return result;
}

// ─── Rule 2: Medium-potential journal entries ─────────────────────────────────
// Lower confidence — queued in surfaced but without format/platform suggestions.

async function detectJournalMediumPotential(
  client: ReturnType<typeof createServiceClientSafe>,
  existingHashes: Set<string>,
): Promise<RuleResult> {
  const result = emptyResult();
  try {
    const { data: entries, error } = await (client as any)
      .from('founder_journal_entries')
      .select('id, entry_date, wins, content_potential_notes, tags')
      .eq('content_potential_rating', 'medium')
      .eq('story_opportunity_created', false);

    if (error) { result.errors.push(`journal_medium: ${error.message}`); return result; }

    for (const entry of entries ?? []) {
      const hash = `journal_medium:${entry.id}`;
      if (existingHashes.has(hash)) continue;

      const angle = entry.content_potential_notes?.trim()
        || entry.wins?.trim()?.slice(0, 300)
        || 'See journal entry for full context.';

      result.opps.push({
        title:              `Journal ${formatDateAU(entry.entry_date)} — Medium potential`,
        source_type:        'journal',
        source_ref_id:      entry.id,
        related_arc_id:     null,
        related_characters: ['Jackson Taylor'],
        content_angle:      angle,
        suggested_format:   '',
        suggested_platform: '',
        priority:           3,
        status:             'new',
        section:            'surfaced',
        notes:              entry.tags?.length ? `Tags: ${entry.tags.join(', ')}` : '',
        is_auto_detected:   true,
        detection_rule:     'journal_medium_potential',
        detection_reason:   `Journal entry from ${entry.entry_date} rated Medium content potential`,
        confidence_score:   0.65,
        source_hash:        hash,
      });
      result.journalIdsToMark.push(entry.id);
    }
  } catch (err) {
    result.errors.push(`journal_medium: ${err instanceof Error ? err.message : String(err)}`);
  }
  return result;
}

// ─── Rule 3: First completed order ───────────────────────────────────────────
// Fires once when the first order reaches status = 'completed'.

async function detectFirstCompletedOrder(
  client: ReturnType<typeof createServiceClientSafe>,
  existingHashes: Set<string>,
): Promise<RuleResult> {
  const result = emptyResult();
  const hash = 'milestone:first_completed_order';
  if (existingHashes.has(hash)) return result;

  try {
    const { count, error } = await (client as any)
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'completed');

    if (error) { result.errors.push(`first_completed_order: ${error.message}`); return result; }
    if (!count || count === 0) return result;

    result.opps.push({
      title:              'First job completed',
      source_type:        'milestone',
      source_ref_id:      null,
      related_arc_id:     null,
      related_characters: ['Jackson Taylor', 'Buds At Work'],
      content_angle:      'The first Buds At Work job has been completed. A real customer, real work done, real outcome delivered. This is the beginning of the proof.',
      suggested_format:   'Story',
      suggested_platform: 'Instagram',
      priority:           1,
      status:             'new',
      section:            'surfaced',
      notes:              `Detected from orders table: ${count} completed order(s) found`,
      is_auto_detected:   true,
      detection_rule:     'first_completed_order',
      detection_reason:   `First completed order found in orders table (${count} total)`,
      confidence_score:   0.85,
      source_hash:        hash,
    });
  } catch (err) {
    result.errors.push(`first_completed_order: ${err instanceof Error ? err.message : String(err)}`);
  }
  return result;
}

// ─── Rule 4: First 5-star review ─────────────────────────────────────────────
// Fires once when the first rating with rating = 5 exists.

async function detectFirstFiveStarReview(
  client: ReturnType<typeof createServiceClientSafe>,
  existingHashes: Set<string>,
): Promise<RuleResult> {
  const result = emptyResult();
  const hash = 'milestone:first_five_star_review';
  if (existingHashes.has(hash)) return result;

  try {
    const { data, error } = await (client as any)
      .from('ratings')
      .select('id, comment, created_at')
      .eq('rating', 5)
      .order('created_at')
      .limit(1);

    if (error) { result.errors.push(`first_five_star_review: ${error.message}`); return result; }
    if (!data?.length) return result;

    const review = data[0];
    const angle = review.comment?.trim()
      ? `First 5-star review received: "${review.comment.trim().slice(0, 200)}"`
      : 'First 5-star customer review received. The quality is being noticed.';

    result.opps.push({
      title:              'First 5-star review',
      source_type:        'milestone',
      source_ref_id:      review.id,
      related_arc_id:     null,
      related_characters: ['Jackson Taylor', 'Buds At Work'],
      content_angle:      angle,
      suggested_format:   'Story',
      suggested_platform: 'Instagram',
      priority:           1,
      status:             'new',
      section:            'surfaced',
      notes:              '',
      is_auto_detected:   true,
      detection_rule:     'first_five_star_review',
      detection_reason:   `First 5-star rating found in ratings table (rating id: ${review.id})`,
      confidence_score:   0.9,
      source_hash:        hash,
    });
  } catch (err) {
    result.errors.push(`first_five_star_review: ${err instanceof Error ? err.message : String(err)}`);
  }
  return result;
}

// ─── Rule 5: First recurring customer ────────────────────────────────────────
// Fires when any customer has 2+ completed orders.

async function detectFirstRecurringCustomer(
  client: ReturnType<typeof createServiceClientSafe>,
  existingHashes: Set<string>,
): Promise<RuleResult> {
  const result = emptyResult();
  const hash = 'milestone:first_recurring_customer';
  if (existingHashes.has(hash)) return result;

  try {
    // Get completed orders grouped by customer to find anyone with 2+
    const { data, error } = await (client as any)
      .from('orders')
      .select('customer_id, customer_name')
      .eq('status', 'completed');

    if (error) { result.errors.push(`first_recurring_customer: ${error.message}`); return result; }

    const counts = new Map<string, { name: string; count: number }>();
    for (const row of data ?? []) {
      const existing = counts.get(row.customer_id) ?? { name: row.customer_name ?? 'Customer', count: 0 };
      counts.set(row.customer_id, { name: existing.name, count: existing.count + 1 });
    }

    const recurring = Array.from(counts.entries()).find(([, v]) => v.count >= 2);
    if (!recurring) return result;

    result.opps.push({
      title:              'First recurring customer',
      source_type:        'milestone',
      source_ref_id:      null,
      related_arc_id:     null,
      related_characters: ['Jackson Taylor', 'Buds At Work'],
      content_angle:      'The first customer who came back without being asked. Repeat business is the real signal — someone trusted Buds At Work enough to return.',
      suggested_format:   'Reel',
      suggested_platform: 'Instagram',
      priority:           1,
      status:             'new',
      section:            'surfaced',
      notes:              `Detected: customer has ${recurring[1].count} completed orders`,
      is_auto_detected:   true,
      detection_rule:     'first_recurring_customer',
      detection_reason:   `Customer with ${recurring[1].count} completed orders found in orders table`,
      confidence_score:   0.85,
      source_hash:        hash,
    });
  } catch (err) {
    result.errors.push(`first_recurring_customer: ${err instanceof Error ? err.message : String(err)}`);
  }
  return result;
}

// ─── Rule 6: First active subscription ───────────────────────────────────────
// Fires when the first subscription with status = 'active' exists.

async function detectFirstSubscription(
  client: ReturnType<typeof createServiceClientSafe>,
  existingHashes: Set<string>,
): Promise<RuleResult> {
  const result = emptyResult();
  const hash = 'milestone:first_subscription';
  if (existingHashes.has(hash)) return result;

  try {
    const { data, error } = await (client as any)
      .from('subscriptions')
      .select('id, service_type, frequency, customer_name')
      .eq('status', 'active')
      .order('created_at')
      .limit(1);

    if (error) { result.errors.push(`first_subscription: ${error.message}`); return result; }
    if (!data?.length) return result;

    const sub = data[0];

    result.opps.push({
      title:              'First recurring subscription',
      source_type:        'milestone',
      source_ref_id:      sub.id,
      related_arc_id:     null,
      related_characters: ['Jackson Taylor', 'Buds At Work'],
      content_angle:      `First customer on a recurring plan (${sub.frequency ?? 'regular'} ${sub.service_type ?? 'service'}). From one-off jobs to predictable recurring income — the model is working.`,
      suggested_format:   'Story',
      suggested_platform: 'Instagram',
      priority:           1,
      status:             'new',
      section:            'surfaced',
      notes:              `Service: ${sub.service_type ?? 'unknown'}, frequency: ${sub.frequency ?? 'unknown'}`,
      is_auto_detected:   true,
      detection_rule:     'first_subscription',
      detection_reason:   `First active subscription found in subscriptions table (id: ${sub.id})`,
      confidence_score:   0.8,
      source_hash:        hash,
    });
  } catch (err) {
    result.errors.push(`first_subscription: ${err instanceof Error ? err.message : String(err)}`);
  }
  return result;
}

// ─── Rule 7: First Bud OS executed action ────────────────────────────────────
// Fires when any agent_action reaches status = 'executed'.
// This is the "Bud OS generates a customer" thread marker.

async function detectBudOsFirstAction(
  client: ReturnType<typeof createServiceClientSafe>,
  existingHashes: Set<string>,
): Promise<RuleResult> {
  const result = emptyResult();
  const hash = 'milestone:bud_os_first_action';
  if (existingHashes.has(hash)) return result;

  try {
    const { data, error } = await (client as any)
      .from('agent_actions')
      .select('id, agent_id, action_type, preview, executed_at')
      .eq('status', 'executed')
      .order('executed_at')
      .limit(1);

    if (error) { result.errors.push(`bud_os_first_action: ${error.message}`); return result; }
    if (!data?.length) return result;

    const action = data[0];
    const preview = action.preview?.trim()?.slice(0, 200) ?? 'An automated action was executed in the real world.';

    result.opps.push({
      title:              'Bud OS first real-world action executed',
      source_type:        'milestone',
      source_ref_id:      action.id,
      related_arc_id:     null,
      related_characters: ['Buds At Work'],
      content_angle:      `The automation layer did something real. Agent: ${action.agent_id ?? 'unknown'}, action: ${action.action_type ?? 'unknown'}. Preview: "${preview}". This is the moment the system stopped being a prototype.`,
      suggested_format:   'Long-form video',
      suggested_platform: 'LinkedIn',
      priority:           2,
      status:             'new',
      section:            'tension_map',
      notes:              `Agent: ${action.agent_id ?? 'unknown'}, type: ${action.action_type ?? 'unknown'}`,
      is_auto_detected:   true,
      detection_rule:     'bud_os_first_action',
      detection_reason:   `First executed agent_action found (agent: ${action.agent_id ?? 'unknown'}, action: ${action.action_type ?? 'unknown'})`,
      confidence_score:   0.8,
      source_hash:        hash,
    });
  } catch (err) {
    result.errors.push(`bud_os_first_action: ${err instanceof Error ? err.message : String(err)}`);
  }
  return result;
}

// ─── Rule 8: First lead from each notable channel ────────────────────────────
// Fires once per channel when the first lead from messenger, instagram, or sms appears.

const NOTABLE_CHANNELS = ['messenger', 'instagram', 'sms'] as const;
const CHANNEL_LABELS: Record<string, string> = {
  messenger:  'Facebook Messenger',
  instagram:  'Instagram',
  sms:        'SMS',
};

async function detectFirstLeadByChannel(
  client: ReturnType<typeof createServiceClientSafe>,
  existingHashes: Set<string>,
): Promise<RuleResult> {
  const result = emptyResult();
  try {
    const { data, error } = await (client as any)
      .from('leads')
      .select('id, source, customer_name, created_at')
      .in('source', NOTABLE_CHANNELS)
      .order('created_at');

    if (error) { result.errors.push(`first_lead_channel: ${error.message}`); return result; }

    // Find first lead per channel
    const seen = new Set<string>();
    for (const lead of data ?? []) {
      if (seen.has(lead.source)) continue;
      seen.add(lead.source);

      const hash = `milestone:first_lead_${lead.source}`;
      if (existingHashes.has(hash)) continue;

      const channelLabel = CHANNEL_LABELS[lead.source] ?? lead.source;

      result.opps.push({
        title:              `First lead via ${channelLabel}`,
        source_type:        'milestone',
        source_ref_id:      lead.id,
        related_arc_id:     null,
        related_characters: ['Jackson Taylor', 'Buds At Work'],
        content_angle:      `The first lead from ${channelLabel} arrived. A new acquisition channel opened. Someone found Buds At Work through a channel that wasn't there before.`,
        suggested_format:   'Story',
        suggested_platform: lead.source === 'instagram' ? 'Instagram' : 'Facebook',
        priority:           2,
        status:             'new',
        section:            'surfaced',
        notes:              `Lead source: ${lead.source}`,
        is_auto_detected:   true,
        detection_rule:     `first_lead_channel`,
        detection_reason:   `First ${lead.source} lead found in leads table (id: ${lead.id})`,
        confidence_score:   0.75,
        source_hash:        hash,
      });
    }
  } catch (err) {
    result.errors.push(`first_lead_channel: ${err instanceof Error ? err.message : String(err)}`);
  }
  return result;
}

// ─── Main detection runner ────────────────────────────────────────────────────

export async function runOpportunityDetection(): Promise<DetectionSummary> {
  const client = createServiceClientSafe();
  if (!client) {
    return { created: 0, skipped: 0, errors: ['Database unavailable'], breakdown: {} };
  }

  // Load all existing source_hashes once for efficient dedup
  const { data: existing } = await (client as any)
    .from('story_opportunities')
    .select('source_hash')
    .not('source_hash', 'is', null);

  const existingHashes = new Set<string>(
    (existing ?? []).map((r: { source_hash: string }) => r.source_hash).filter(Boolean),
  );

  const summary: DetectionSummary = { created: 0, skipped: 0, errors: [], breakdown: {} };
  // Only populated after confirmed successful inserts — not before.
  const confirmedJournalIdsToMark: string[] = [];

  const rules = [
    detectJournalHighPotential,
    detectJournalMediumPotential,
    detectFirstCompletedOrder,
    detectFirstFiveStarReview,
    detectFirstRecurringCustomer,
    detectFirstSubscription,
    detectBudOsFirstAction,
    detectFirstLeadByChannel,
  ];

  for (const rule of rules) {
    let result: RuleResult;
    try {
      result = await rule(client, existingHashes);
    } catch (err) {
      summary.errors.push(`Rule crashed: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }

    summary.errors.push(...result.errors);

    if (result.opps.length === 0) continue;

    // Filter against freshly-loaded hashes (rules may have added some)
    const newOpps = result.opps.filter((o) => !existingHashes.has(o.source_hash));
    const skippedCount = result.opps.length - newOpps.length;

    if (newOpps.length > 0) {
      // Build source_hash → journal_entry_id map for journal-derived opps,
      // so we can mark entries only after confirmed insert success.
      const journalHashToEntryId = new Map<string, string>();
      for (const opp of newOpps) {
        if (opp.source_type === 'journal' && opp.source_ref_id) {
          journalHashToEntryId.set(opp.source_hash, opp.source_ref_id);
        }
      }

      const { data: inserted, error: insertErr } = await (client as any)
        .from('story_opportunities')
        .insert(newOpps)
        .select('id, source_hash, detection_rule');

      if (insertErr) {
        // Unique constraint violation is acceptable (race condition) — don't surface as error
        if (!insertErr.code?.includes('23505')) {
          summary.errors.push(`Insert error (${newOpps[0].detection_rule}): ${insertErr.message}`);
        }
        // Do NOT mark journal entries — opportunity was not created.
      } else {
        const createdCount = (inserted ?? []).length;
        summary.created += createdCount;

        for (const row of inserted ?? []) {
          if (row.source_hash) {
            // Update local hash set so subsequent rules see freshly created entries
            existingHashes.add(row.source_hash);
            // Only mark journal entries whose opportunity was actually inserted
            const journalId = journalHashToEntryId.get(row.source_hash);
            if (journalId) confirmedJournalIdsToMark.push(journalId);
          }
        }

        const ruleId = newOpps[0].detection_rule;
        if (!summary.breakdown[ruleId]) summary.breakdown[ruleId] = { created: 0, skipped: 0 };
        summary.breakdown[ruleId].created += createdCount;
      }
    }

    if (skippedCount > 0) {
      summary.skipped += skippedCount;
      const ruleId = result.opps[0].detection_rule;
      if (!summary.breakdown[ruleId]) summary.breakdown[ruleId] = { created: 0, skipped: 0 };
      summary.breakdown[ruleId].skipped += skippedCount;
    }
  }

  // Mark journal entries only where the corresponding opportunity was successfully inserted.
  if (confirmedJournalIdsToMark.length > 0) {
    await (client as any)
      .from('founder_journal_entries')
      .update({ story_opportunity_created: true })
      .in('id', confirmedJournalIdsToMark);
  }

  return summary;
}
