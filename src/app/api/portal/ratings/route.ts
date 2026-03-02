import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get('order_id');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (client as any).from('ratings').select('*').order('created_at', { ascending: false });

  if (orderId) {
    query = query.eq('order_id', orderId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ratings: data || [] });
}

export async function POST(request: NextRequest) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.order_id || !body.rating) {
    return NextResponse.json({ error: 'order_id and rating are required' }, { status: 400 });
  }

  if (Number(body.rating) < 1 || Number(body.rating) > 5) {
    return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any)
    .from('ratings')
    .upsert(
      {
        order_id: body.order_id,
        customer_id: authUser.role === 'customer' ? authUser.id : (body.customer_id || null),
        rating: Number(body.rating),
        comment: body.comment || null,
      },
      { onConflict: 'order_id' }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rating: data });
}
