import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';
import { attachFundraisingTotals } from '@/lib/fundraising/totals';

export interface FundraisingItem {
  id: string;
  title: string;
  slug: string;
  category: string;
  status: 'draft' | 'live' | 'funded' | 'archived';
  image_url: string | null;
  goal_amount_cents: number;
  raised_amount_cents: number;
  verified_raised_amount_cents: number;
  manual_adjustment_cents: number;
  contribution_count: number;
  progress_percentage: number;
  remaining_amount_cents: number;
  is_funded: boolean;
  short_reason: string | null;
  who_it_helps: string | null;
  employment_impact: string | null;
  cta_label: string;
  payment_url: string | null;
  supplier_url: string | null;
  stripe_payment_link_id: string | null;
  stripe_price_id: string | null;
  sort_order: number;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
}

// GET /api/fundraising — public, returns live items ordered by sort_order
export async function GET() {
  const client = createServiceClientSafe();
  if (!client) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any)
    .from('fundraising_items')
    .select('*')
    .eq('status', 'live')
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

  // Never expose contribution/payment private fields from the public API.
  const items = attachFundraisingTotals(data ?? [], contributions ?? []);

  return NextResponse.json({ items });
}

// POST /api/fundraising — admin only, creates a new fundraising item
export async function POST(req: NextRequest) {
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

  let body: Partial<FundraisingItem>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.title || !body.slug) {
    return NextResponse.json({ error: 'title and slug are required' }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any)
    .from('fundraising_items')
    .insert({
      title: body.title,
      slug: body.slug,
      category: body.category ?? 'general',
      status: body.status ?? 'draft',
      image_url: body.image_url ?? null,
      goal_amount_cents: body.goal_amount_cents ?? 0,
      raised_amount_cents: 0,
      manual_adjustment_cents: body.manual_adjustment_cents ?? 0,
      short_reason: body.short_reason ?? null,
      who_it_helps: body.who_it_helps ?? null,
      employment_impact: body.employment_impact ?? null,
      cta_label: body.cta_label ?? 'Fund This',
      payment_url: body.payment_url ?? null,
      supplier_url: body.supplier_url ?? null,
      stripe_payment_link_id: body.stripe_payment_link_id ?? null,
      stripe_price_id: body.stripe_price_id ?? null,
      sort_order: body.sort_order ?? 0,
      is_featured: body.is_featured ?? false,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ item: data }, { status: 201 });
}
