import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase/server';
import { ipRatelimit, emailRatelimit, checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { normalizeEmail } from '@/lib/auth/normalize-email';

// POST /api/auth/register
// Unified self-service sign-up for customers and employees.
// Body: { full_name, email, password, role: 'customer' | 'employee', turnstileToken }
// Admin accounts are provisioned exclusively via the /account/setup page or
// the Supabase dashboard — never through this endpoint.

export async function POST(req: NextRequest) {
  // Rate limit by IP before doing any DB work.
  const ip = getClientIp(req);
  const { allowed: ipAllowed } = await checkRateLimit(ipRatelimit, ip);
  if (!ipAllowed) {
    return NextResponse.json(
      { error: 'Too many sign-up attempts. Please wait a few minutes and try again.' },
      { status: 429 }
    );
  }

  let body: { full_name: string; email: string; password: string; role: string; turnstileToken?: string; phone?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { full_name, email, password, role, turnstileToken } = body;

  // Verify Cloudflare Turnstile token before any account creation.
  if (process.env.TURNSTILE_SECRET_KEY) {
    if (!turnstileToken) {
      return NextResponse.json({ error: 'Bot verification required.' }, { status: 400 });
    }
    const tsRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: process.env.TURNSTILE_SECRET_KEY, response: turnstileToken }),
    });
    const tsData = await tsRes.json() as { success: boolean };
    if (!tsData.success) {
      return NextResponse.json({ error: 'Bot verification failed. Please try again.' }, { status: 403 });
    }
  }

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

  // Normalize the address up front so duplicate detection (b.o.b+test@gmail.com
  // vs bob@gmail.com) works before we hit Supabase. Display form is what we
  // actually pass to signUp / store on profile rows so the user sees their own
  // typed email back, but the canonical form drives uniqueness.
  const { display: emailDisplay, canonical: emailCanonical, valid: emailValid } =
    normalizeEmail(email);
  if (!emailValid) {
    return NextResponse.json({ error: 'That email address looks invalid.' }, { status: 400 });
  }
  const emailKey = emailCanonical;

  const { allowed: emailAllowed } = await checkRateLimit(emailRatelimit, emailKey);
  if (!emailAllowed) {
    return NextResponse.json(
      { error: 'Too many sign-up attempts for this email. Please try again in an hour.' },
      { status: 429 }
    );
  }

  // ── Pre-flight duplicate check ────────────────────────────────────────────
  // Catches:
  //   1. Exact email already in profiles (case-insensitive via lower() index)
  //   2. Canonical email collisions — different alias of the same inbox
  //      (e.g. bob+anything@gmail.com when bob@gmail.com is already taken)
  // We do this BEFORE auth.signUp so we can return a helpful, branded error
  // pointing the user back to sign-in instead of leaking Supabase's internals.
  {
    const adminClient = createServiceClient();
    // Run both lookups in parallel; either match is a duplicate.
    const [byNormalized, byEmail] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (adminClient as any)
        .from('profiles')
        .select('id')
        .eq('normalized_email', emailCanonical)
        .limit(1)
        .maybeSingle(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (adminClient as any)
        .from('profiles')
        .select('id')
        .ilike('email', emailDisplay)
        .limit(1)
        .maybeSingle(),
    ]);

    if (byNormalized?.data?.id || byEmail?.data?.id) {
      return NextResponse.json(
        {
          error:
            'Looks like you already have an account with that email. Try signing in, or use “Continue with Google” if you signed up that way.',
          code: 'email_already_registered',
        },
        { status: 409 }
      );
    }
  }

  // Use the anon client for signUp so Supabase sends its configured confirmation email.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://budsatwork.com';
  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: signUpData, error: signUpError } = await anonClient.auth.signUp({
    email: emailDisplay,
    password,
    options: {
      data: { full_name },
      emailRedirectTo: `${siteUrl}/auth/callback`,
    },
  });

  if (signUpError) {
    // Translate the generic "already registered" message into the same friendly
    // 409 response shape so the client never has to parse Supabase strings.
    const lower = signUpError.message.toLowerCase();
    if (lower.includes('already registered') || lower.includes('already exists') || lower.includes('user already')) {
      return NextResponse.json(
        {
          error:
            'Looks like you already have an account with that email. Try signing in, or use “Continue with Google” if you signed up that way.',
          code: 'email_already_registered',
        },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: signUpError.message }, { status: 400 });
  }

  const userId = signUpData.user?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Account creation failed.' }, { status: 500 });
  }

  // Set role in app_metadata via service client (signUp only allows user_metadata).
  const client = createServiceClient();
  await client.auth.admin.updateUserById(userId, { app_metadata: { role } });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (client as any).from('profiles').upsert({
    id: userId,
    full_name,
    email: emailDisplay,
    normalized_email: emailCanonical,
    role,
  });

  if (role === 'customer') {
    // Upsert the customers row linked to this auth user. The DB trigger
    // (handle_new_auth_user) may have already inserted a row during signUp,
    // so we use upsert to avoid a unique-constraint failure and to ensure
    // any extra fields (e.g. phone) are persisted correctly.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (client as any).from('customers').upsert(
      {
        full_name,
        email: emailDisplay,
        normalized_email: emailCanonical,
        user_id: userId,
        ...(body.phone?.trim() ? { phone: body.phone.trim() } : {}),
      },
      { onConflict: 'user_id' }
    );

    // Claim any anonymous quotes submitted with this email via Postgres RPC.
    // We pass the canonical form so the RPC can match across alias variants
    // (relies on the matching index added in migration 035).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (client as any).rpc('claim_anonymous_quotes', { p_user_id: userId, p_email: emailCanonical });
  }

  if (role === 'employee') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: employee } = await (client as any)
      .from('employees')
      .insert({
        user_id: userId,
        full_name,
        email: emailDisplay,
        status: 'inactive',
        onboarding_complete: false,
        crew_access_approved: false,
      })
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
    new_value: { role, email: emailDisplay, normalized_email: emailCanonical },
    source: 'auth',
    user_email: emailDisplay,
  }]);
  if (auditError) {
    console.error('[auth] Failed to write registration audit log for', emailDisplay, auditError.message);
  }

  return NextResponse.json({ success: true, email: emailDisplay });
}
