import type { ContentPotentialRating, JournalEntryDraft } from '@/types/journal';

type SectionKey =
  | 'wins'
  | 'challenges'
  | 'customer_activity'
  | 'silvan_updates'
  | 'business_progress'
  | 'bud_os_progress'
  | 'memorable_moments'
  | 'lessons_learned';

const SECTION_RULES: Array<{ key: SectionKey; patterns: RegExp[] }> = [
  { key: 'customer_activity', patterns: [/\b(customer|client|quote|booking|booked|job|review|testimonial|feedback|lead|enquiry|inquiry|dm|message)\b/i] },
  { key: 'silvan_updates', patterns: [/\b(silvan|training|shift|solo|crew)\b/i] },
  { key: 'business_progress', patterns: [/\b(revenue|paid|payment|invoice|sale|contract|subscription|recurring|pipeline|commercial|hired|hire|employee)\b/i] },
  { key: 'bud_os_progress', patterns: [/\b(bud os|automation|agent|dashboard|code|component|theme|colour|color|design system|api|migration|database|deploy|build|system)\b/i] },
  { key: 'challenges', patterns: [/\b(hard|challenge|blocked|failed|broke|problem|issue|bug|risk|worry|behind|stuck|confusing)\b/i] },
  { key: 'wins', patterns: [/\b(win|finished|completed|shipped|fixed|launched|confirmed|got|first|finally|worked|progress)\b/i] },
  { key: 'memorable_moments', patterns: [/\b(funny|memorable|laughed|unexpected|wild|weird|surprised|moment)\b/i] },
  { key: 'lessons_learned', patterns: [/\b(learned|lesson|realised|realized|next time|should|would|taught)\b/i] },
];

const TAG_RULES: Array<{ tag: string; pattern: RegExp }> = [
  { tag: 'customer', pattern: /\b(customer|client|booking|job|review|testimonial)\b/i },
  { tag: 'leads', pattern: /\b(lead|enquiry|inquiry|dm|message|quote)\b/i },
  { tag: 'silvan', pattern: /\bsilvan\b/i },
  { tag: 'bud-os', pattern: /\b(bud os|automation|agent|dashboard|system)\b/i },
  { tag: 'business-progress', pattern: /\b(revenue|paid|sale|contract|subscription|recurring|pipeline)\b/i },
  { tag: 'lesson', pattern: /\b(learned|lesson|realised|realized)\b/i },
];

const ARC_RULES: Array<{ arc: string; pattern: RegExp }> = [
  { arc: 'Bud OS becoming useful in the real business', pattern: /\b(bud os|automation|agent|system|dashboard)\b/i },
  { arc: 'From idea to paying customers', pattern: /\b(customer|client|booking|paid|revenue|first sale|lead)\b/i },
  { arc: 'Silvan capability and confidence', pattern: /\bsilvan\b/i },
  { arc: 'Building a visible public business', pattern: /\b(public|launch|posted|community|milestone|visible)\b/i },
];

const PUBLIC_IMPACT = /\b(customer|client|lead|revenue|paid|sale|booking|participant|ndis|employment|employee|hire|community|public|visible|review|testimonial|contract|subscription|recurring)\b/i;
const STRONG_PUBLIC_SIGNAL = /\b(first|breakthrough|life[-\s]?changing|testimonial|five[-\s]?star|5[-\s]?star|recurring|subscription|contract|employment|participant|customer|client|revenue|paid|public launch)\b/i;
const INTERNAL_SYSTEM_SIGNAL = /\b(theme|colour|color|code|component|agent action|write_theme_file|design system|dashboard ui|automation layer|migration|database|api|config|configuration)\b/i;

function splitSentences(raw: string): string[] {
  return raw
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function appendLine(existing: string | null | undefined, line: string): string {
  const current = existing?.trim();
  if (!current) return line;
  if (current.includes(line)) return current;
  return `${current}\n${line}`;
}

function compactTags(tags: string[]): string[] {
  return Array.from(new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean))).slice(0, 10);
}

function suggestPotential(raw: string): ContentPotentialRating {
  if (STRONG_PUBLIC_SIGNAL.test(raw) && PUBLIC_IMPACT.test(raw)) return 'high';
  if (PUBLIC_IMPACT.test(raw)) return 'medium';
  if (INTERNAL_SYSTEM_SIGNAL.test(raw)) return 'none';
  if (raw.trim().length > 80) return 'low';
  return 'none';
}

export function organiseJournalCapture(draft: JournalEntryDraft): JournalEntryDraft {
  const raw = draft.raw_capture?.trim() ?? '';
  if (!raw) return draft;

  const next: JournalEntryDraft = { ...draft, raw_capture: raw };
  const sentences = splitSentences(raw);
  const unmatched: string[] = [];

  for (const sentence of sentences) {
    const matches = SECTION_RULES.filter((rule) => rule.patterns.some((pattern) => pattern.test(sentence)));
    if (matches.length === 0) {
      unmatched.push(sentence);
      continue;
    }
    for (const match of matches.slice(0, 2)) {
      next[match.key] = appendLine(next[match.key], sentence);
    }
  }

  if (unmatched.length > 0 && !next.wins?.trim()) {
    next.wins = appendLine(next.wins, unmatched.slice(0, 2).join(' '));
  }

  const tags = [...next.tags];
  for (const rule of TAG_RULES) {
    if (rule.pattern.test(raw)) tags.push(rule.tag);
  }
  next.tags = compactTags(tags);

  const arcs = [...next.arc_connections];
  for (const rule of ARC_RULES) {
    if (rule.pattern.test(raw)) arcs.push(rule.arc);
  }
  next.arc_connections = Array.from(new Set(arcs)).slice(0, 6);

  next.content_potential_rating = suggestPotential(raw);
  if (!next.content_potential_notes?.trim()) {
    if (next.content_potential_rating === 'none') {
      next.content_potential_notes = INTERNAL_SYSTEM_SIGNAL.test(raw)
        ? 'Private/internal system record. Do not treat as a public content angle unless it connects to a customer, lead, revenue, participant, employment, community, or visible public milestone.'
        : 'Useful private record. No clear public content angle yet.';
    } else {
      next.content_potential_notes = raw.slice(0, 500);
    }
  }

  const publicContext = PUBLIC_IMPACT.test(raw);
  next.suggested_story_bible_note = publicContext
    ? `Potential Story Bible note: ${raw.slice(0, 400)}`
    : null;
  next.suggested_character_timeline_entry = /\bsilvan\b/i.test(raw)
    ? `Suggested Silvan timeline entry: ${raw.slice(0, 350)}`
    : null;
  next.suggested_arc_update = next.arc_connections.length > 0
    ? `Suggested arc update for review: ${next.arc_connections.join(', ')}. Evidence: ${raw.slice(0, 350)}`
    : null;
  next.suggested_open_thread_update = /\b(test|testing|question|whether|uncertain|risk|trying)\b/i.test(raw)
    ? `Suggested open thread: ${raw.slice(0, 350)}`
    : null;

  return next;
}
