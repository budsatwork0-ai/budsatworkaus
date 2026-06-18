import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';
import type { FundraisingItem } from '../route';
import { attachFundraisingTotals } from '@/lib/fundraising/totals';

// GET /api/fundraising/[id] — admin only, returns any item regardless of status
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const client = createServiceClientSafe();
  if (!client) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  const { id } = await params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any)
    .from('fundraising_items')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: contributions, error: contributionsError } = await (client as any)
    .from('fundraising_contributions')
    .select('fundraising_item_id, amount_cents, status')
    .eq('fundraising_item_id', id);

  if (contributionsError) {
    return NextResponse.json({ error: contributionsError.message }, { status: 500 });
  }

  return NextResponse.json({ item: attachFundraisingTotals([data], contributions ?? [])[0] });
}

// PATCH /api/fundraising/[id] — admin only, partial update
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const client = createServiceClientSafe();
  if (!client) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  const { id } = await params;

  let body: Partial<FundraisingItem>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Strip read-only/system fields from the patch payload to prevent accidental overwrite.
  const updates = { ...body };
  delete updates.id;
  delete updates.created_at;
  delete updates.raised_amount_cents;
  delete updates.verified_raised_amount_cents;
  delete updates.contribution_count;
  delete updates.progress_percentage;
  delete updates.remaining_amount_cents;
  delete updates.is_funded;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any)
    .from('fundraising_items')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: contributions, error: contributionsError } = await (client as any)
    .from('fundraising_contributions')
    .select('fundraising_item_id, amount_cents, status')
    .eq('fundraising_item_id', id);

  if (contributionsError) {
    return NextResponse.json({ error: contributionsError.message }, { status: 500 });
  }

  return NextResponse.json({ item: attachFundraisingTotals([data], contributions ?? [])[0] });
}

// DELETE /api/fundraising/[id] — admin only, soft-deletes by archiving
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const client = createServiceClientSafe();
  if (!client) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  const { id } = await params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client as any)
    .from('fundraising_items')
    .update({ status: 'archived' })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
