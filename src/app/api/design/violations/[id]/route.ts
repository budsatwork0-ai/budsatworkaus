import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';

const VALID_STATUSES = ['open', 'in_progress', 'resolved', 'wont_fix', 'accepted'] as const;
type ViolationStatus = (typeof VALID_STATUSES)[number];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authUser = await getAuthUser();
  if (!authUser || authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { id } = await params;
  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });

  const body = (await req.json()) as { status: string; resolution_note?: string };
  const { status, resolution_note } = body;

  if (!VALID_STATUSES.includes(status as ViolationStatus)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const update: Record<string, unknown> = { status };
  if (resolution_note !== undefined) update.resolution_note = resolution_note;
  if (status === 'resolved' || status === 'wont_fix') {
    update.resolved_at = new Date().toISOString();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client as any)
    .from('design_violations')
    .update(update)
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
