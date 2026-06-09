// Generates a content_scripts record from an approved content idea.
// Uses the same Story Bible consent rules as draft-generator.ts.
// Called inline from the content-ideas PUT route — never touches story_drafts.

export const SCRIPT_GENERATION_MODEL = 'claude-haiku-4-5-20251001';

export interface GeneratedScript {
  hook:        string;
  setup:       string;
  core_moment: string;
  close_cta:   string;
}

export interface ScriptGenerationResult {
  scriptId:    string;
  ideaId:      string;
  model:       string;
  tokens:      number;
}

export async function generateScriptForIdea(
  client: any,
  ideaId: string,
  apiKey: string,
): Promise<ScriptGenerationResult> {
  // ── Load idea ─────────────────────────────────────────────────────────────────
  const { data: idea, error: ideaErr } = await client
    .from('content_ideas')
    .select('id, title, opportunity_id, related_arc_id, related_characters, platform_fit, format, hook, content_angle, notes')
    .eq('id', ideaId)
    .single();

  if (ideaErr || !idea) throw new Error('Idea not found');

  // ── Load linked opportunity (for arc/score context, optional) ─────────────────
  let arc: Record<string, string> | null = null;
  let oppScore: number | null = null;

  if (idea.opportunity_id) {
    const { data: opp } = await client
      .from('story_opportunities')
      .select('story_score, related_arc_id, content_angle, notes')
      .eq('id', idea.opportunity_id)
      .single();

    if (opp) {
      oppScore = opp.story_score;
      const arcId = idea.related_arc_id ?? opp.related_arc_id;
      if (arcId) {
        const { data: arcData } = await client
          .from('story_arcs')
          .select('title, description, status, progress_notes')
          .eq('id', arcId)
          .single();
        arc = arcData ?? null;
      }
    }
  } else if (idea.related_arc_id) {
    const { data: arcData } = await client
      .from('story_arcs')
      .select('title, description, status, progress_notes')
      .eq('id', idea.related_arc_id)
      .single();
    arc = arcData ?? null;
  }

  // ── Load Story Bible constraints ──────────────────────────────────────────────
  const { data: bibleSections } = await client
    .from('story_bible_sections')
    .select('section_key, content')
    .in('section_key', ['mission_purpose', 'narrative_tone', 'what_we_never_do']);

  const bible: Record<string, string> = {};
  for (const s of (bibleSections ?? [])) {
    if (s.content?.trim()) bible[s.section_key] = s.content;
  }

  // ── Consent-aware character context ──────────────────────────────────────────
  const characters: Array<{ name: string; what_to_protect?: string }> = [];
  const charNames: string[] = Array.isArray(idea.related_characters) ? idea.related_characters : [];

  if (charNames.length > 0) {
    const { data: charData } = await client
      .from('story_characters')
      .select('name, voice_perspective, what_to_show, what_to_protect, consent_status')
      .in('name', charNames);

    for (const char of (charData ?? [])) {
      if (char.consent_status != null && char.consent_status !== 'granted') continue;
      characters.push(char);
    }
  }

  // ── Build prompt ──────────────────────────────────────────────────────────────
  const sections: string[] = [];
  if (bible.mission_purpose)  sections.push(`=== MISSION & PURPOSE ===\n${bible.mission_purpose}`);
  if (bible.narrative_tone)   sections.push(`=== NARRATIVE TONE ===\n${bible.narrative_tone}`);
  if (bible.what_we_never_do) sections.push(`=== WHAT WE NEVER DO — HARD CONSTRAINTS ===\n${bible.what_we_never_do}`);
  if (arc) {
    sections.push(
      `=== LINKED STORY ARC ===\nTitle: ${arc.title}\nDescription: ${arc.description ?? ''}\nStatus: ${arc.status ?? ''}\nProgress: ${arc.progress_notes ?? '—'}`,
    );
  }
  if (characters.length > 0) {
    const charBlock = characters.map((c: any) => {
      const lines: string[] = [`Character: ${c.name}`];
      if (c.voice_perspective) lines.push(`Voice: ${c.voice_perspective}`);
      if (c.what_to_show)      lines.push(`What to show: ${c.what_to_show}`);
      if (c.what_to_protect)   lines.push(`NEVER INCLUDE — privacy boundary: ${c.what_to_protect}`);
      return lines.join('\n');
    }).join('\n\n');
    sections.push(`=== CHARACTER CONTEXT ===\n${charBlock}`);
  }

  const storyContext = sections.join('\n\n');
  const scoreNote = oppScore !== null ? ` (story score: ${oppScore}/100)` : '';

  const prompt = `You are writing a production script for Buds At Work — local services in Logan and South Brisbane, Australia.
Voice: warm Australian tradie. Honest. Specific. Never corporate, never generic.

${storyContext}

=== CONTENT IDEA${scoreNote} ===
Title: ${idea.title}
Format: ${idea.format || 'Not specified'}
Platform: ${idea.platform_fit || 'Not specified'}
Hook: ${idea.hook || 'Not specified'}
Content angle: ${idea.content_angle || 'Not specified'}${idea.notes ? `\nNotes: ${idea.notes}` : ''}

=== WRITING RULES ===
- Do not invent facts. Only use details present in the context above.
- Respect "WHAT WE NEVER DO" as absolute constraints.
- Respect "NEVER INCLUDE — privacy boundary" per character as absolute constraints.
- Never quote private journal entries. Write original content informed by the context.
- This script is a draft for Jackson's review. Keep it grounded and real.
- Structure: Hook (1-2 sentences, creates tension or curiosity) → Setup (context, 2-3 sentences) → Core Moment (the specific story, 3-5 sentences) → Close/CTA (one action, suburb-specific).

Respond with ONLY valid JSON — no markdown fences, no other text:
{
  "hook": "Opening 1-2 sentences that create immediate tension or curiosity",
  "setup": "2-3 sentences of context — who, what, where",
  "core_moment": "3-5 sentences — the specific moment, transformation, or observation. Concrete and real.",
  "close_cta": "One closing sentence with a call to action. Mention the suburb or service."
}`;

  // ── Call Anthropic ────────────────────────────────────────────────────────────
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type':      'application/json',
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      SCRIPT_GENERATION_MODEL,
      max_tokens: 1024,
      messages:   [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic error ${res.status}: ${errText.slice(0, 200)}`);
  }

  const json = (await res.json()) as {
    content: Array<{ type: string; text?: string }>;
    usage:   { input_tokens: number; output_tokens: number };
  };

  const rawText = json.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('');

  const totalTokens = (json.usage?.input_tokens ?? 0) + (json.usage?.output_tokens ?? 0);

  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  let parsed: GeneratedScript;
  try {
    parsed = JSON.parse(cleaned) as GeneratedScript;
  } catch {
    throw new Error('Failed to parse AI response as JSON');
  }

  if (typeof parsed.hook !== 'string' || typeof parsed.setup !== 'string') {
    throw new Error('Unexpected shape from AI response — missing hook or setup');
  }

  // ── Persist script ────────────────────────────────────────────────────────────
  const { data: script, error: insertErr } = await client
    .from('content_scripts')
    .insert({
      idea_id:          ideaId,
      hook:             parsed.hook,
      setup:            parsed.setup,
      core_moment:      typeof parsed.core_moment === 'string' ? parsed.core_moment : '',
      close_cta:        typeof parsed.close_cta === 'string' ? parsed.close_cta : '',
      platform:         idea.platform_fit ?? '',
      format:           idea.format ?? '',
      status:           'draft',
      is_ai_generated:  true,
      generation_model: SCRIPT_GENERATION_MODEL,
      notes:            'Auto-generated when idea was approved. Requires Jackson review before use.',
    })
    .select('id')
    .single();

  if (insertErr) throw new Error(`Failed to save script: ${insertErr.message}`);

  return {
    scriptId: script.id,
    ideaId,
    model:    SCRIPT_GENERATION_MODEL,
    tokens:   totalTokens,
  };
}
