import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const EDITABLE = ['price', 'minimum', 'market_low', 'market_high', 'source', 'checked_at', 'note', 'active'] as const;

function db(service = false) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    service ? process.env.SUPABASE_SERVICE_ROLE_KEY! : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
}

// Public: active prices for a service (used by /services). Anon key + RLS (active rows only).
export async function GET(req: Request) {
  const service = new URL(req.url).searchParams.get('service');
  let q = db().from('price_list').select('service,item,label,unit,price,minimum,active').eq('active', true);
  if (service) q = q.eq('service', service);
  const { data, error } = await q.order('sort_order');
  if (error) return NextResponse.json({ rows: [] }, { status: 200 });
  return NextResponse.json({ rows: data ?? [] }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
}

// Admin: edit one row; old + new values written to price_history.
export async function PATCH(req: Request) {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  if (!b?.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const patch: Record<string, unknown> = {};
  for (const k of EDITABLE) {
    if (!(k in b)) continue;
    const v = b[k];
    if (['price', 'minimum', 'market_low', 'market_high'].includes(k)) {
      if (v === null || v === '') patch[k] = null;
      else {
        const n = Number(v);
        if (!Number.isFinite(n) || n < 0 || n > 100000) return NextResponse.json({ error: `Bad ${k}` }, { status: 400 });
        patch[k] = n;
      }
    } else if (k === 'active') patch[k] = Boolean(v);
    else if (k === 'checked_at') patch[k] = v ? String(v).slice(0, 10) : null;
    else patch[k] = v ? String(v).slice(0, 2000) : null;
  }
  const client = db(true);
  const { data: old, error: e1 } = await client.from('price_list').select('*').eq('id', b.id).single();
  if (e1 || !old) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { data: row, error } = await client.from('price_list')
    .update({ ...patch, updated_at: new Date().toISOString(), updated_by: user.id })
    .eq('id', b.id).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const oldVals: Record<string, unknown> = {};
  for (const k of Object.keys(patch)) oldVals[k] = (old as Record<string, unknown>)[k];
  await client.from('price_history').insert({ price_list_id: b.id, old_values: oldVals, new_values: patch, changed_by: user.id });
  return NextResponse.json({ row });
}
