import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createRateLimiter, getClientIp } from '@/lib/rate-limit';

// POST /api/auth/register
// Unified self-service sign-up for customers and employees.
// Body: { full_name, email, password, role: 'customer' | 'employee' }
// Admin accounts are provisioned exclusively via the /account/setup page or
// the Supabase dashboard — never through this endpoint.

// 5 registrations per IP per 15 minutes.
const checkIpRateLimit = createRateLimiter({ limit: 5, windowMs: 15 * 60 * 1000 });
// 3 registrations per email per hour (prevents distributed attacks on a single address).
const checkEmailRateLimit = createRateLimiter({ limit: 3, windowMs: 60 * 60 * 1000 });

export async function POST(req: NextRequest) {
  // Rate limit by IP before doing any DB work.
  const ip = getClientIp(req);
  const { allowed: ipAllowed } = checkIpRateLimit(ip);
  if (!ipAllowed) {
    return NextResponse.json(
      { error: 'Too many sign-up attempts. Please wait a few minutes and try again.' },
      { status: 429 }
    );
  }

  let body: { full_name: string; email: string; password: string; role: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { full_name, email, password, role } = body;

  if (!full_name?.trim() || !email?.trim() || !password) {
    return NextResponse.json({ error: 'full_name, email, and password are required' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }
  // Admin accounts cannot be self-registered — they are created via /account/setup
  // or provisioned directly by an existing admin.
  if (role === 'admin') {
    return NextResponse.json(
      { error: 'Admin accounts cannot be created through self-registration.' },
      { status: 403 }
    );
  }
  if (role !== 'customer' && role !== 'employee') {
    return NextResponse.json({ error: 'role must be customer or employee' }, { status: 400 });
  }

  // Rate limit by email after validating input (prevents leaking which emails are registered).
  const emailKey = email.toLowerCase().trim();
  const { allowed: emailAllowed } = checkEmailRateLimit(emailKey);
  if (!emailAllowed) {
    return NextResponse.json(
      { error: 'Too many sign-up attempts for this email. Please try again in an hour.' },
      { status: 429 }
    );
  }

  const client = createServiceClient();

  const { data: userData, error: createError } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
    app_metadata: { role },
  });

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 400 });
  }

  const userId = userData.user.id;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (client as any).from('profiles').upsert({ id: userId, full_name, email, role });

  if (role === 'customer') {
    // Create a customers row linked to the auth user so that RLS policies
    // (customer_id IN SELECT id FROM customers WHERE user_id = auth.uid())
    // can correctly scope orders, quotes, and subscriptions to this user.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (client as any).from('customers').insert({ full_name, email, user_id: userId });

    // Link any anonymous quotes submitted with this email to this new account.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: orphaned } = await (client as any)
      .from('quotes')
      .select('id')
      .ilike('customer_email', emailKey)
      .is('customer_id', null);
    if (orphaned && orphaned.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: linkError } = await (client as any)
        .from('quotes')
        .update({ customer_id: userId, updated_at: new Date().toISOString() })
        .in('id', orphaned.map((q: { id: string }) => q.id));
      if (linkError) {
        console.error('[auth/register] Failed to link orphaned quotes for', emailKey, linkError.message);
      }
    }
  }

  if (role === 'employee') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: employee } = await (client as any)
      .from('employees')
      .insert({ user_id: userId, full_name, email, status: 'active', onboarding_complete: false })
      .select()
      .single();

    if (employee?.id) {
      const sections = ['personal', 'availability', 'services', 'emergency', 'documents'];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (client as any).from('employee_onboarding').upsert(
        sections.map((section) => ({ employee_id: employee.id, section, completed: false, responses: {} })),
        { onConflict: 'employee_id,section' }
      );
    }
  }

  // Audit log — awaited so failures are visible server-side, but never surfaced to caller.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: auditError } = await (client as any).from('audit_log').insert([{
    entity_type: 'auth',
    entity_id: userId,
    action: 'register',
    new_value: { role, email },
    source: 'auth',
    user_email: email,
  }]);
  if (auditError) {
    console.error('[auth] Failed to write registration audit log for', email, auditError.message);
  }

  return NextResponse.json({ success: true, email });
}
