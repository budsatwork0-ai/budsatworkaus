import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  checkRateLimit,
  createRateLimiter,
  getClientIp,
  resendEmailRatelimit,
  resendIpRatelimit,
  verifyTurnstile,
} from '@/lib/rate-limit';

// In-memory fallback for local dev (Upstash env vars unset). Production MUST
// run on Upstash — see resendIpRatelimit / resendEmailRatelimit in lib/rate-limit.
const fallbackResendByIp = createRateLimiter({ limit: 5, windowMs: 15 * 60 * 1000 });
const fallbackResendByEmail = createRateLimiter({ limit: 3, windowMs: 15 * 60 * 1000 });

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const ipResult = resendIpRatelimit
    ? await checkRateLimit(resendIpRatelimit, ip)
    : fallbackResendByIp(ip);
  if (!ipResult.allowed) {
    return NextResponse.json(
      { error: 'Too many resend attempts. Please wait a few minutes and try again.' },
      { status: 429 }
    );
  }

  let body: { email?: string; turnstileToken?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Cloudflare Turnstile — gates against scripted enumeration of valid emails
  // and stops attackers using budsatwork.com as a relay for confirmation
  // emails to arbitrary recipients. No-op when TURNSTILE_SECRET_KEY is unset.
  const tsCheck = await verifyTurnstile(body.turnstileToken);
  if (!tsCheck.ok) {
    return NextResponse.json({ error: tsCheck.error }, { status: tsCheck.status });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 });
  }

  const emailResult = resendEmailRatelimit
    ? await checkRateLimit(resendEmailRatelimit, email)
    : fallbackResendByEmail(email);
  if (!emailResult.allowed) {
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
