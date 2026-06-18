import { NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';
import { attachFundraisingTotals } from '@/lib/fundraising/totals';

// GET /api/fundraising/admin — admin only, returns ALL items regardless of status
export async function GET() {
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any)
    .from('fundraising_items')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const itemIds = (data ?? []).map((item: { id: string }) => item.id);
  const { data: contributions, error: contributionsError } = itemIds.length > 0
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? await (client as any)
        .from('fundraising_contributions')
        .select('fundraising_item_id, amount_cents, status')
        .in('fundraising_item_id', itemIds)
    : { data: [], error: null };

  if (contributionsError) {
    return NextResponse.json({ error: contributionsError.message }, { status: 500 });
  }

  return NextResponse.json({ items: attachFundraisingTotals(data ?? [], contributions ?? []) });
}
