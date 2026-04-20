import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (authUser.role === 'customer') {
    return NextResponse.json({ error: 'Admin or employee access required' }, { status: 403 });
  }

  const client = createServiceClientSafe();
  if (!client) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  let body: {
    vendor_name: string;
    category: string;
    amount: number;
    due_date?: string | null;
    description?: string | null;
    notes?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.vendor_name || !body.category || body.amount == null) {
    return NextResponse.json(
      { error: 'Missing required fields: vendor_name, category, amount' },
      { status: 400 }
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any)
    .from('payables')
    .insert([
      {
        vendor_name: body.vendor_name,
        category: body.category,
        amount: body.amount,
        due_date: body.due_date || null,
        description: body.description || null,
        notes: body.notes || null,
        status: 'pending',
      },
    ])
    .select()
    .single();

  if (error) {
    console.error('[api/payables] POST failed:', error.message);
    return NextResponse.json({ error: 'Failed to record expense' }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
