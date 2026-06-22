// PATCH /api/leads/[id]/status — admin-only. Updates response_status on a lead.
// Used by the Mission Control Open Enquiries panel for quick triage actions.

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const ALLOWED_STATUSES = new Set(['in_conversation', 'lost', 'quoted', 'booked']);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authUser = await getAuthUser();
  if (!authUser || authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  let body: { status?: string };
  try {
    body = (await req.json()) as { status?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.status || !ALLOWED_STATUSES.has(body.status)) {
    return NextResponse.json(
      { error: `status must be one of: ${[...ALLOWED_STATUSES].join(', ')}` },
      { status: 400 },
    );
  }

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client as any)
    .from('leads')
    .update({
      response_status: body.status,
      ...(body.status === 'in_conversation' ? { first_response_at: new Date().toISOString() } : {}),
    })
    .eq('id', id);

  if (error) {
    console.error('[api/leads/[id]/status] update failed:', error.message);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
