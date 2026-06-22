// GET /api/leads/[id] — admin-only. Returns safe lead fields for quote wizard prefill.
// Only exposes the minimum needed: name, email, phone, service_type, source.
// PII never touches a URL query string — the client fetches via this route using
// the admin session cookie after receiving only the lead UUID from the URL.

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authUser = await getAuthUser();
  if (!authUser || authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any)
    .from('leads')
    .select('id, customer_name, customer_email, customer_phone, service_type, source')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('[api/leads/[id]] fetch failed:', error.message);
    return NextResponse.json({ error: 'Failed to fetch lead' }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({
    lead: {
      id: data.id as string,
      customer_name: (data.customer_name as string | null) ?? null,
      customer_email: (data.customer_email as string | null) ?? null,
      customer_phone: (data.customer_phone as string | null) ?? null,
      service_type: (data.service_type as string | null) ?? null,
      source: (data.source as string) ?? 'unknown',
    },
  });
}
