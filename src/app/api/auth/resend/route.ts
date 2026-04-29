import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createRateLimiter, getClientIp } from '@/lib/rate-limit';

const resendByIp = createRateLimiter({ limit: 5, windowMs: 15 * 60 * 1000 });
const resendByEmail = createRateLimiter({ limit: 3, windowMs: 15 * 60 * 1000 });

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!resendByIp(ip).allowed) {
    return NextResponse.json(
      { error: 'Too many resend attempts. Please wait a few minutes and try again.' },
      { status: 429 }
    );
  }

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 });
  }

  if (!resendByEmail(email).allowed) {
    return NextResponse.json(
      { error: 'Too many resend attempts for this email. Please try again shortly.' },
      { status: 429 }
    );
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://budsatwork.com';
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return NextResponse.json({ error: 'Auth configuration is unavailable.' }, { status: 503 });
  }

  const anonClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await anonClient.auth.resend({
    type: 'signup',
    email,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback`,
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
