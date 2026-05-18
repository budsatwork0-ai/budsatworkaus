/**
 * POST /api/memory/write
 *
 * Write a new memory document from an admin or agent.
 * Admin-only. Agents use ctx.memory.write() via the runtime instead.
 *
 * Body:
 *   {
 *     category: MemoryCategory
 *     title: string
 *     body: string
 *     tags?: string[]
 *     agentScope?: string | null
 *     source?: MemorySource
 *     allowDuplicate?: boolean
 *   }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { writeMemory } from '@/lib/memory/write';
import { MEMORY_CATEGORIES } from '@/lib/memory/types';
import type { MemoryCategory } from '@/lib/memory/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // Auth
  const cookieStore = await cookies();
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  );
  const { data: { session } } = await supabaseAuth.auth.getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { data: profile } = await supabaseAdmin
    .from('profiles').select('role').eq('id', session.user.id).single();
  if (!profile || !['admin', 'owner'].includes(profile.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  const { category, title, content, tags, agentScope, source, allowDuplicate } = body as {
    category: string;
    title: string;
    content: string;
    tags?: string[];
    agentScope?: string | null;
    source?: string;
    allowDuplicate?: boolean;
  };

  if (!MEMORY_CATEGORIES.includes(category as MemoryCategory)) {
    return NextResponse.json({ error: `Invalid category. Must be one of: ${MEMORY_CATEGORIES.join(', ')}` }, { status: 400 });
  }
  if (!title?.trim())   return NextResponse.json({ error: 'title required' }, { status: 400 });
  if (!content?.trim()) return NextResponse.json({ error: 'body/content required' }, { status: 400 });

  try {
    const result = await writeMemory(
      supabaseAdmin,
      {
        category:   category as MemoryCategory,
        title:      title.trim(),
        body:       content.trim(),
        tags:       Array.isArray(tags) ? tags : [],
        agentScope: agentScope ?? null,
        source:     (source as 'human' | 'import') ?? 'human',
      },
      {
        allowSoftDuplicate: allowDuplicate ?? false,
        status: 'active',
      },
    );

    if (!result.ok) {
      return NextResponse.json(
        { error: 'duplicate_detected', ...result },
        { status: 409 },
      );
    }

    return NextResponse.json({ doc: result.doc }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
