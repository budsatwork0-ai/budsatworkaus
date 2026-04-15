import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';
import { getResendClient, FROM_ADDRESS } from '@/lib/email/resend';
import { serviceScheduledEmail } from '@/lib/email/templates';

// POST /api/orders/[id]/assign - Assign order to employee(s)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (authUser.role === 'customer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: orderId } = await params;

  const client = createServiceClientSafe();
  if (!client) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  let body: {
    employee_ids: string[];
    scheduled_date?: string; // ISO date string e.g. "2026-04-21"
    scheduled_time?: string; // human-readable e.g. "9:00 AM – 11:00 AM"
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!Array.isArray(body.employee_ids) || body.employee_ids.length === 0) {
    return NextResponse.json({ error: 'employee_ids must be a non-empty array' }, { status: 400 });
  }

  // Fetch order with customer details for scheduling email
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: order } = await (client as any)
    .from('orders')
    .select('id, status, customer_name, customer_email, service_type, notes, final_price')
    .eq('id', orderId)
    .single();

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  // Build updates — set scheduled_date/time if provided
  const orderUpdates: Record<string, unknown> = {};
  if (body.scheduled_date) orderUpdates.scheduled_date = body.scheduled_date;
  if (body.scheduled_time) orderUpdates.scheduled_time = body.scheduled_time;
  if (body.scheduled_date) orderUpdates.status = 'scheduled';

  if (Object.keys(orderUpdates).length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (client as any).from('orders').update(orderUpdates).eq('id', orderId);
  }

  // Create job_assignment records for each employee
  const assignments = body.employee_ids.map((employeeId) => ({
    order_id: orderId,
    employee_id: employeeId,
    status: 'available',
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any)
    .from('job_assignments')
    .insert(assignments)
    .select('*, employees(first_name)');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Send scheduling confirmation email if we have a date and customer email
  if (body.scheduled_date && order.customer_email) {
    const resend = getResendClient();
    if (resend) {
      const SERVICE_LABELS: Record<string, string> = {
        windows: 'Window Cleaning',
        cleaning: 'Home/Commercial Cleaning',
        yard: 'Yard Care',
        dump: 'Dump Runs',
        auto: 'Auto Detailing',
        laundry_sneakers: 'Laundry & Sneaker Care',
      };

      // Extract service address from notes ("Address: ..." prepended at quote submission)
      const addressMatch = (order.notes as string | null)?.match(/^Address:\s*(.+)/m);
      const serviceAddress = addressMatch?.[1]?.trim() ?? 'your property';

      // Format scheduled date for display
      const dateObj = new Date(body.scheduled_date);
      const scheduledDateLabel = dateObj.toLocaleDateString('en-AU', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      });

      // Use first assigned crew member's first name if available
      const crewFirstName =
        (data?.[0] as Record<string, unknown> & { employees?: { first_name?: string } })
          ?.employees?.first_name ?? 'your crew member';

      const { subject, html } = serviceScheduledEmail({
        customerName: order.customer_name ?? 'there',
        serviceLabel: SERVICE_LABELS[order.service_type] ?? order.service_type,
        scheduledDate: scheduledDateLabel,
        scheduledTime: body.scheduled_time ?? 'Time TBC — we\'ll confirm via SMS',
        crewFirstName,
        serviceAddress,
        orderId,
      });

      resend.emails.send({ from: FROM_ADDRESS, to: order.customer_email, subject, html }).catch((err) => {
        console.error('[email] service_scheduled send failed:', err);
      });
    }
  }

  return NextResponse.json({ assignments: data }, { status: 201 });
}
