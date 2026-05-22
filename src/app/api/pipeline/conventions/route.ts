/**
 * GET  /api/pipeline/conventions?limit=20
 * POST /api/pipeline/conventions
 *
 * Convention learnings — coding rules discovered during dev sessions.
 * Feeds the same Continuous Learning Loop as improvement and repair learnings.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

async function makeClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );
}

export async function GET(req: NextRequest) {
  const limit = Math.min(
    parseInt(new URL(req.url).searchParams.get('limit') ?? '20', 10) || 20,
    100,
  );

  const supabase = await makeClient();
  const { data, error } = await supabase
    .from('bud_convention_learnings')
    .select('id, title, rule, category, source, severity, example_wrong, example_correct, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ conventions: data ?? [] });
}

export async function POST(req: NextRequest) {
  let body: {
    title?: string;
    rule?: string;
    category?: string;
    source?: string;
    severity?: string;
    example_wrong?: string;
    example_correct?: string;
    session_id?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.title?.trim() || !body.rule?.trim()) {
    return NextResponse.json({ error: 'title and rule are required' }, { status: 422 });
  }

  const supabase = await makeClient();
  const { data, error } = await supabase
    .from('bud_convention_learnings')
    .insert({
      title: body.title.trim(),
      rule: body.rule.trim(),
      category: body.category ?? 'pattern',
      source: body.source ?? 'manual',
      severity: body.severity ?? 'error',
      example_wrong: body.example_wrong?.trim() || null,
      example_correct: body.example_correct?.trim() || null,
      session_id: body.session_id || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ convention: data }, { status: 201 });
}
