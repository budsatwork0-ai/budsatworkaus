/**
 * POST /api/memory/graph/build
 *
 * Triggers a knowledge graph rebuild.
 *
 * Body (all optional):
 *   { documentId?: string, runLLM?: boolean, checkContradictions?: boolean }
 *
 * If documentId is provided → incremental rebuild for that document.
 * Otherwise → full rebuild for all active documents.
 *
 * Full rebuild with runLLM=true can be very slow and expensive.
 * Admin-only.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { buildDocumentGraph, buildFullGraph } from '@/lib/memory/graph/builder';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  );
  const { data: { session } } = await supabaseAuth.auth.getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', session.user.id).single();
  if (!profile || !['admin', 'owner'].includes(profile.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: {
    documentId?: string;
    runLLM?: boolean;
    checkContradictions?: boolean;
  } = {};

  try {
    body = await req.json();
  } catch {
    // empty body — use defaults
  }

  try {
    if (body.documentId) {
      const result = await buildDocumentGraph({
        documentId:          body.documentId,
        runLLM:              body.runLLM ?? false,
        checkContradictions: body.checkContradictions ?? false,
        supabase,
      });
      return NextResponse.json({ mode: 'incremental', documentId: body.documentId, ...result });
    }

    const result = await buildFullGraph({
      runLLM:              body.runLLM ?? false,
      checkContradictions: body.checkContradictions ?? false,
      supabase,
    });
    return NextResponse.json({ mode: 'full', ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
