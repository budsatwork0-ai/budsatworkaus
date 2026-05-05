import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

// GET /api/ndis/organisations — list all NDIS orgs (admin only)
export async function GET() {
  const auth = await getAuthUser();
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const client = createServiceClientSafe() as AnyClient;
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const { data: orgs, error } = await client
    .from('ndis_organisations')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Attach participant counts
  const orgIds = (orgs || []).map((o: AnyClient) => o.id);
  let countMap: Record<string, number> = {};
  if (orgIds.length > 0) {
    const { data: parts } = await client
      .from('ndis_participants')
      .select('organisation_id')
      .in('organisation_id', orgIds)
      .eq('status', 'active');
    for (const p of parts || []) {
      countMap[p.organisation_id] = (countMap[p.organisation_id] || 0) + 1;
    }
  }

  const enriched = (orgs || []).map((o: AnyClient) => ({
    ...o,
    participant_count: countMap[o.id] || 0,
  }));

  return NextResponse.json({ organisations: enriched });
}

// POST /api/ndis/organisations — create a new NDIS org (admin only)
export async function POST(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const client = createServiceClientSafe() as AnyClient;
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const { name, abn, contact_name, contact_email, contact_phone, website, notes } = body;

  if (!name || !contact_name || !contact_email) {
    return NextResponse.json({ error: 'name, contact_name and contact_email are required' }, { status: 400 });
  }

  const { data: org, error } = await client
    .from('ndis_organisations')
    .insert([{ name, abn, contact_name, contact_email, contact_phone, website, notes }])
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ organisation: org }, { status: 201 });
}
