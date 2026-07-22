import { NextResponse } from 'next/server';
import { createAuthServerClient } from '@/lib/supabase/server-client';
import { createCrewRepository } from '@/lib/crew/repository';

export async function GET() {
  const supabase = await createAuthServerClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { data: employee } = await db
    .from('employees')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!employee) {
    return NextResponse.json({ thisWeek: 0, thisFortnight: 0, thisMonth: 0, allTime: 0, jobs: [] });
  }

  const repository = createCrewRepository({ client: supabase });
  const { data: assignments, error: assignError } = await repository.listCompletedForEarnings(employee.id);

  if (assignError) {
    return NextResponse.json({ error: assignError }, { status: 500 });
  }

  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const startOfFortnight = new Date(startOfWeek);
  startOfFortnight.setDate(startOfFortnight.getDate() - 7);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  let thisWeek = 0, thisFortnight = 0, thisMonth = 0, allTime = 0;

  const jobs = assignments.map((a) => {
    const order = a.orders;
    const amount = order?.final_price || 0;
    const completedDate = a.completed_at ? new Date(a.completed_at) : null;

    allTime += amount;
    if (completedDate && completedDate >= startOfMonth) thisMonth += amount;
    if (completedDate && completedDate >= startOfFortnight) thisFortnight += amount;
    if (completedDate && completedDate >= startOfWeek) thisWeek += amount;

    return {
      id: a.id,
      orderId: a.order_id,
      serviceType: order?.service_type || 'unknown',
      customerName: order?.customer_name?.split(' ')[0] || 'Customer',
      amount,
      completedAt: a.completed_at,
      scheduledDate: order?.scheduled_date,
    };
  });

  return NextResponse.json({
    thisWeek: Math.round(thisWeek * 100) / 100,
    thisFortnight: Math.round(thisFortnight * 100) / 100,
    thisMonth: Math.round(thisMonth * 100) / 100,
    allTime: Math.round(allTime * 100) / 100,
    jobs,
  });
}
