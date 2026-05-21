/**
 * GET /api/pipeline/runs?surface=admin&limit=20
 *
 * Returns the most recent N runs for a surface. The dashboard uses this for
 * the run history drawer. Auth: relies on RLS (admin/owner only).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { PipelineSurface } from '@/lib/pipeline/types';

const VALID_SURFACES: PipelineSurface[] = ['public', 'admin', 'crew', 'customer'];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const surface = searchParams.get('surface') as PipelineSurface | null;
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10) || 20, 100);

  if (!surface || !VALID_SURFACES.includes(surface)) {
    return NextResponse.json({ error: 'invalid surface' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    },
  );

  const { data, error } = await supabase
    .from('pipeline_runs')
    .select('*')
    .eq('surface', surface)
    .order('started_at', { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ runs: data ?? [] });
}
