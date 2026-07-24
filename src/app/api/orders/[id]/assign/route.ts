import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';
import { getResendClient, FROM_ADDRESS } from '@/lib/email/resend';
import { serviceScheduledEmail } from '@/lib/email/templates';
import { createOrderRepository } from '@/lib/orders/repository';
import { orderWorkspace } from '@/lib/orders/workspace';
import { LIVE_WORKSPACE, withWorkspaceContext } from '@/lib/workspace/server';

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

  const repository = createOrderRepository({ client });
  const { data: order, error: orderError } = await repository.getById(orderId);

  if (orderError || !order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  // Sandbox orders may only be assigned by an admin — mirrors the [id] gate.
  const workspace = orderWorkspace(order);
  if (workspace !== LIVE_WORKSPACE && authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return withWorkspaceContext(workspace, async () => {
    // Build updates — set scheduled_date/time if provided
    const orderUpdates: Record<string, unknown> = {};
    if (body.scheduled_date) orderUpdates.scheduled_date = body.scheduled_date;
    if (body.scheduled_time) orderUpdates.scheduled_time = body.scheduled_time;
    if (body.scheduled_date) orderUpdates.status = 'scheduled';

    if (Object.keys(orderUpdates).length > 0) {
      await repository.update(orderId, orderUpdates);
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

    const isSandbox = workspace !== LIVE_WORKSPACE;

    // Send scheduling confirmation email if we have a date and customer
    // email — never for a sandbox order, since there is no real customer
    // behind it. The scheduling/assignment write above still persists
    // (database-only, no further uncontrolled side effect); only the real
    // email send is blocked.
    if (!isSandbox && body.scheduled_date && order.customer_email) {
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

    if (isSandbox) {
      return NextResponse.json({ assignments: data, email_blocked: true }, { status: 201 });
    }

    return NextResponse.json({ assignments: data }, { status: 201 });
  });
}
