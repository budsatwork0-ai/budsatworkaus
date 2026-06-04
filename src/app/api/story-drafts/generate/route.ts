import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';

const GENERATION_MODEL = 'claude-haiku-4-5-20251001';

interface GeneratedDraft {
  hook: string;
  body: string;
  close: string;
  hashtags: string[];
}

export async function POST(req: NextRequest) {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (authUser.role !== 'admin') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const apiKey = process.env.ANTHROPIC_API_KEY ?? '';
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Draft generation is not available — ANTHROPIC_API_KEY is not configured.' },
      { status: 503 },
    );
  }

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const opportunityId = typeof body.opportunity_id === 'string' ? body.opportunity_id.trim() : '';
  const format = typeof body.format === 'string' ? body.format.trim() : '';
  const platform = typeof body.platform === 'string' ? body.platform.trim() : '';

  if (!opportunityId) return NextResponse.json({ error: 'opportunity_id is required' }, { status: 400 });
  if (!format) return NextResponse.json({ error: 'format is required' }, { status: 400 });
  if (!platform) return NextResponse.json({ error: 'platform is required' }, { status: 400 });

  // Load opportunity
  const { data: opp, error: oppErr } = await (client as any)
    .from('story_opportunities')
    .select('*')
    .eq('id', opportunityId)
    .single();

  if (oppErr || !opp) {
    return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });
  }

  // Load linked arc
  let arc: Record<string, string> | null = null;
  if (opp.related_arc_id) {
    const { data: arcData } = await (client as any)
      .from('story_arcs')
      .select('title, description, status, progress_notes')
      .eq('id', opp.related_arc_id)
      .single();
    arc = arcData ?? null;
  }

  // Load active chapter
  const { data: chapters } = await (client as any)
    .from('story_chapters')
    .select('title, summary, goal')
    .eq('is_active', true)
    .limit(1);
  const chapter = chapters?.[0] ?? null;

  // Load relevant bible sections
  const { data: bibleSections } = await (client as any)
    .from('story_bible_sections')
    .select('section_key, content')
    .in('section_key', ['mission_purpose', 'core_tension', 'narrative_tone', 'what_we_show', 'what_we_never_do']);
  const bible: Record<string, string> = {};
  for (const s of (bibleSections ?? [])) {
    if (s.content?.trim()) bible[s.section_key] = s.content;
  }

  // Load character profiles for related characters
  let characters: Record<string, unknown>[] = [];
  if (Array.isArray(opp.related_characters) && opp.related_characters.length > 0) {
    const { data: charData } = await (client as any)
      .from('story_characters')
      .select('name, profile, voice_perspective, what_to_show')
      .in('name', opp.related_characters);
    characters = charData ?? [];
  }

  // Build prompt context
  const sections: string[] = [];

  if (bible.mission_purpose) sections.push(`=== MISSION & PURPOSE ===\n${bible.mission_purpose}`);
  if (bible.core_tension) sections.push(`=== CORE TENSION ===\n${bible.core_tension}`);
  if (bible.narrative_tone) sections.push(`=== NARRATIVE TONE ===\n${bible.narrative_tone}`);
  if (bible.what_we_show) sections.push(`=== WHAT WE SHOW ===\n${bible.what_we_show}`);
  if (bible.what_we_never_do) {
    sections.push(`=== WHAT WE NEVER DO — HARD CONSTRAINTS ===\n${bible.what_we_never_do}`);
  }
  if (chapter) {
    sections.push(
      `=== ACTIVE CHAPTER ===\nTitle: ${chapter.title}\nSummary: ${chapter.summary ?? ''}\nGoal: ${chapter.goal ?? ''}`,
    );
  }
  if (arc) {
    sections.push(
      `=== LINKED STORY ARC ===\nTitle: ${arc.title}\nDescription: ${arc.description ?? ''}\nStatus: ${arc.status ?? ''}\nProgress: ${arc.progress_notes ?? '—'}`,
    );
  }
  if (characters.length > 0) {
    const charBlock = characters.map((c: any) => {
      const lines: string[] = [`Character: ${c.name}`];
      if (c.profile) lines.push(`Profile: ${c.profile}`);
      if (c.voice_perspective) lines.push(`Voice: ${c.voice_perspective}`);
      if (c.what_to_show) lines.push(`What to show: ${c.what_to_show}`);
      return lines.join('\n');
    }).join('\n\n');
    sections.push(`=== CHARACTER CONTEXT ===\n${charBlock}`);
  }

  const promptContext = sections.join('\n\n');

  const prompt = `You are a professional content writer for Buds At Work, a local services business in Logan and South Brisbane, Australia.

You are writing a ${format} for ${platform}.

${promptContext}

=== CONTENT OPPORTUNITY ===
Title: ${opp.title}
Content angle: ${opp.content_angle || 'No specific angle — use the title and story context.'}${opp.notes ? `\nNotes: ${opp.notes}` : ''}

=== WRITING RULES ===
- Do not invent facts. Only use details present in the context above.
- Do not include private client, participant, or personal details not shown above.
- Follow the narrative tone from the Story Bible.
- Respect "WHAT WE NEVER DO" as absolute constraints — never cross these lines.
- Write for the format and platform: a ${format} on ${platform}.
- This is a draft for human review. Keep it grounded, honest, and real.
- Do not include a publishing schedule, metadata, or any text outside the JSON.

Respond with ONLY a valid JSON object — no markdown fences, no other text:
{
  "hook": "Opening line or hook (1-2 sentences)",
  "body": "Main body content appropriate for ${format} on ${platform}",
  "close": "Closing line or call to action (1 sentence)",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3"]
}`;

  // Call Anthropic
  let generated: GeneratedDraft;
  let totalTokens = 0;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: GENERATION_MODEL,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[story-drafts/generate] Anthropic error:', res.status, errText);
      return NextResponse.json(
        { error: `AI generation failed (status ${res.status}). Please try again.` },
        { status: 502 },
      );
    }

    const json = (await res.json()) as {
      content: Array<{ type: string; text?: string }>;
      usage: { input_tokens: number; output_tokens: number };
    };

    const rawText = json.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('');

    totalTokens = (json.usage?.input_tokens ?? 0) + (json.usage?.output_tokens ?? 0);

    // Strip any markdown fences that may wrap the JSON
    const cleaned = rawText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    const parsed = JSON.parse(cleaned) as GeneratedDraft;

    if (typeof parsed.hook !== 'string' || typeof parsed.body !== 'string') {
      throw new Error('Unexpected shape from AI response');
    }

    generated = {
      hook:     parsed.hook ?? '',
      body:     parsed.body ?? '',
      close:    typeof parsed.close === 'string' ? parsed.close : '',
      hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags.map(String) : [],
    };
  } catch (err) {
    console.error('[story-drafts/generate] Parse error:', err);
    return NextResponse.json(
      { error: 'AI returned an unexpected response. Please try again.' },
      { status: 502 },
    );
  }

  // Persist draft
  const { data: draft, error: insertErr } = await (client as any)
    .from('story_drafts')
    .insert({
      opportunity_id:    opportunityId,
      format,
      platform,
      hook:              generated.hook,
      body:              generated.body,
      close:             generated.close,
      hashtags:          generated.hashtags,
      prompt_context:    promptContext,
      is_ai_generated:   true,
      generation_model:  GENERATION_MODEL,
      generation_tokens: totalTokens,
      status:            'draft',
    })
    .select()
    .single();

  if (insertErr) {
    console.error('[story-drafts/generate] Insert error:', insertErr.message);
    return NextResponse.json({ error: 'Failed to save draft' }, { status: 500 });
  }

  return NextResponse.json(draft, { status: 201 });
}
