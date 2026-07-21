import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';
import {
  checkRateLimit,
  createRateLimiter,
  getClientIp,
  quoteSubmitRatelimit,
  verifyTurnstile,
} from '@/lib/rate-limit';
import { getResendClient, FROM_ADDRESS } from '@/lib/email/resend';
import { quoteReceivedEmail, ndisForwardQuoteEmail, adminNewQuoteEmail } from '@/lib/email/templates';
import { createQuoteRepository } from '@/lib/quotes/repository';
import { quoteWorkspace, resolveQuoteWorkspace } from '@/lib/quotes/workspace';
import { assertWorkspaceCompatibility, withWorkspaceContext } from '@/lib/workspace/server';

const ADMIN_EMAIL = 'admin@budsatwork.com';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://budsatwork.com';
import { recordAnalyticsEvent } from '@/lib/analytics/server';
import { resolveLeadSource, coerceLeadSource } from '@/lib/leads/source';

const SERVICE_LABELS: Record<string, string> = {
  windows: 'Window Cleaning',
  cleaning: 'Home/Commercial Cleaning',
  yard: 'Yard Care',
  dump: 'Dump Runs',
  auto: 'Auto Detailing',
  laundry_sneakers: 'Laundry & Sneaker Care',
};

// 10 quote submissions per IP per 15 minutes (production only).
// Production prefers Upstash (durable + shared across serverless instances).
// Falls back to in-memory if Upstash env vars aren't set.
// In dev the limiter is bypassed entirely — getClientIp() returns 'unknown' on
// localhost, so a single tester would otherwise lock out every submitter on the
// same process.
const fallbackQuotePostLimit = createRateLimiter({ limit: 10, windowMs: 15 * 60 * 1000 });
const RATE_LIMIT_QUOTES = process.env.NODE_ENV === 'production';

export async function GET(request: NextRequest) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const limit = parseInt(searchParams.get('limit') || '50');
  const workspace = resolveQuoteWorkspace(searchParams, authUser.role);

  return withWorkspaceContext(workspace, async () => {
    const repository = createQuoteRepository({ client });

    if (authUser.role === 'customer') {
      // Best-effort: permanently link orphaned quotes via Postgres function.
      if (authUser.email) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (client as any).rpc('claim_anonymous_quotes', {
          p_user_id: authUser.id,
          p_email: authUser.email,
        });
      }
    }

    const { data, error } = await repository.list({
      status,
      limit,
      customerId: authUser.role === 'customer' ? authUser.id : undefined,
    });

    if (error) {
      console.error('[api/quotes] GET list failed:', error);
      return NextResponse.json({ error: 'Failed to fetch quotes' }, { status: 500 });
    }

    let quotes = data;

    // Fallback: also include any still-orphaned quotes matching by email,
    // scoped to this same workspace. This ensures quotes are visible
    // immediately even if the RPC link hasn't run yet or the DB function is
    // not yet applied.
    if (authUser.role === 'customer' && authUser.email) {
      const { data: orphaned } = await repository.listOrphanedByEmail(authUser.email, limit);
      if (orphaned.length > 0) {
        const seen = new Set(quotes.map((q) => q.id));
        quotes = [...quotes, ...orphaned.filter((q) => !seen.has(q.id))];
      }
    }

    return NextResponse.json({ quotes });
  });
}

export async function POST(request: NextRequest) {
  if (RATE_LIMIT_QUOTES) {
    const ip = getClientIp(request);
    const { allowed } = quoteSubmitRatelimit
      ? await checkRateLimit(quoteSubmitRatelimit, ip)
      : fallbackQuotePostLimit(ip);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many quote submissions. Please wait a few minutes and try again.' },
        { status: 429 }
      );
    }
  }

  // Auth is optional — anonymous visitors can submit quotes.
  // If they are logged in we link the quote to their account.
  let authUser: Awaited<ReturnType<typeof getAuthUser>> = null;
  try {
    authUser = await getAuthUser();
  } catch {
    // Non-critical — proceed as anonymous if auth check fails
  }

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Cloudflare Turnstile check for anonymous submissions. Authenticated users
  // skip the captcha — they've already cleared one at sign-up. No-op when
  // TURNSTILE_SECRET_KEY isn't configured (local dev).
  if (!authUser) {
    const tsCheck = await verifyTurnstile(
      typeof body.turnstileToken === 'string' ? body.turnstileToken : null
    );
    if (!tsCheck.ok) {
      return NextResponse.json({ error: tsCheck.error }, { status: tsCheck.status });
    }
  }

  if (!body.customer_name || !body.service_type || !body.context) {
    return NextResponse.json(
      { error: 'Missing required fields: customer_name, service_type, context' },
      { status: 400 }
    );
  }

  const ALLOWED_SERVICE_TYPES = Object.keys(SERVICE_LABELS);
  if (!ALLOWED_SERVICE_TYPES.includes(body.service_type as string)) {
    return NextResponse.json({ error: 'Invalid service_type' }, { status: 400 });
  }

  if (!['home', 'commercial', 'ndis'].includes(body.context as string)) {
    return NextResponse.json({ error: 'Invalid context' }, { status: 400 });
  }

  // Guard against context/service mismatch (e.g. auto detailing is home-only)
  const SERVICES_BY_CONTEXT: Record<string, string[]> = {
    home: ['windows', 'cleaning', 'yard', 'dump', 'auto', 'laundry_sneakers'],
    commercial: ['windows', 'cleaning', 'yard'],
    ndis: ['cleaning', 'yard'],
  };
  if (!SERVICES_BY_CONTEXT[body.context as string]?.includes(body.service_type as string)) {
    return NextResponse.json({ error: 'Service not available for this context' }, { status: 400 });
  }

  if (body.customer_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.customer_email as string)) {
    return NextResponse.json({ error: 'Invalid customer_email format' }, { status: 400 });
  }

  const submittedTotal = Number(body.submitted_total ?? body.total ?? body.final_price ?? 0);
  if (!Number.isFinite(submittedTotal) || submittedTotal <= 0) {
    return NextResponse.json({ error: 'Invalid quote total' }, { status: 400 });
  }

  const analyticsSessionId =
    typeof body.analytics_session_id === 'string' && body.analytics_session_id.trim().length > 0
      ? body.analytics_session_id.trim()
      : null;

  // NDIS routing fields — only accepted when context === 'ndis'. Values are
  // validated; unknown management types fall back to NULL so the DB CHECK
  // constraint is never violated.
  const NDIS_MGMT_VALUES = new Set(['plan_managed', 'self_managed', 'agency_managed']);
  const isNdis = body.context === 'ndis';
  const ndisManagementType =
    isNdis && typeof body.ndis_management_type === 'string' &&
    NDIS_MGMT_VALUES.has(body.ndis_management_type)
      ? body.ndis_management_type
      : null;
  const ndisForwardContact =
    isNdis && typeof body.ndis_forward_contact === 'string' && body.ndis_forward_contact.trim().length > 0
      ? body.ndis_forward_contact.trim()
      : null;
  const ndisForwardEmailRaw =
    isNdis && typeof body.ndis_forward_email === 'string' ? body.ndis_forward_email.trim().toLowerCase() : '';
  const ndisForwardEmail =
    ndisForwardEmailRaw && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ndisForwardEmailRaw)
      ? ndisForwardEmailRaw
      : null;
  const ndisEstimatedHoursNum =
    isNdis && Number.isFinite(Number(body.ndis_estimated_hours))
      ? Math.max(0, Number(body.ndis_estimated_hours))
      : null;
  const ndisHourlyRateNum =
    isNdis && Number.isFinite(Number(body.ndis_hourly_rate))
      ? Math.max(0, Number(body.ndis_hourly_rate))
      : null;

  // Combine address + notes into a single field — quotes table has no
  // dedicated service_address column, so we prepend it to notes.
  const combinedNotes = [
    body.service_address ? `Address: ${body.service_address}` : '',
    typeof body.notes === 'string' ? body.notes : '',
  ].filter(Boolean).join('\n') || null;

  // Extract lead_id for post-insert linkage. UUID format validated here so the
  // INSERT never fails due to a malformed value arriving from the client.
  const QUOTE_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const rawLeadId = typeof body.lead_id === 'string' ? body.lead_id.trim() : null;
  const validLeadId = rawLeadId && QUOTE_UUID_RE.test(rawLeadId) ? rawLeadId : null;

  // Resolve the lead source (module 9 attribution). When the quote originates
  // from a known lead (admin converting via Mission Control), use that lead's
  // source directly so Messenger/phone attribution is not overwritten by the
  // 'website' default. Falls back to UTM/referrer resolution for all other paths.
  const referrerHeader = request.headers.get('referer') || request.headers.get('referrer');
  const providedLeadSrc = typeof body.lead_src === 'string' ? coerceLeadSource(body.lead_src) : null;
  const leadSource = providedLeadSrc ?? resolveLeadSource({
    source: typeof body.source === 'string' ? body.source : null,
    utm_source: typeof body.utm_source === 'string' ? body.utm_source : null,
    utm_medium: typeof body.utm_medium === 'string' ? body.utm_medium : null,
    referrer:
      typeof body.referrer === 'string' && body.referrer.length > 0
        ? body.referrer
        : referrerHeader,
  });

  // Public/customer submissions default to production; sandbox creation
  // requires both an explicit `?workspace=sandbox` request AND admin auth
  // (resolveQuoteWorkspace treats a null authUser, i.e. an anonymous public
  // submission, the same as any non-admin — sandbox is never granted).
  const { searchParams } = new URL(request.url);
  const workspace = resolveQuoteWorkspace(searchParams, authUser?.role ?? null);

  return withWorkspaceContext(workspace, async () => {
    const repository = createQuoteRepository({ client });
    const { data, error } = await repository.create({
      customer_id: authUser?.role === 'customer' ? authUser.id : null,
      customer_name: body.customer_name as string,
      customer_email: body.customer_email as string | null | undefined,
      customer_phone: body.customer_phone as string | null | undefined,
      service_type: body.service_type as string,
      context: (body.context as string) || 'home',
      scope: body.scope as string | null | undefined,
      frequency: (body.frequency as string) || 'none',
      analytics_session_id: analyticsSessionId,
      total: submittedTotal,
      submitted_total: submittedTotal,
      reviewed_total: null,
      status: 'submitted',
      payment_status: 'not_requested',
      service_address: typeof body.service_address === 'string' ? body.service_address.trim() : null,
      notes: combinedNotes,
      source: leadSource,
      // NDIS-specific routing + pricing (null for non-NDIS quotes).
      ndis_management_type: ndisManagementType,
      ndis_forward_contact: ndisForwardContact,
      ndis_forward_email: ndisForwardEmail,
      ndis_estimated_hours: ndisEstimatedHoursNum,
      ndis_hourly_rate: ndisHourlyRateNum,
    });

    if (error || !data) {
      console.error('[api/quotes] POST failed:', error);
      return NextResponse.json({ error: 'Failed to submit quote' }, { status: 500 });
    }

    // Link lead → quote. Best-effort: a failure here must not fail the quote
    // response. Also skipped (not silently forced) if the lead belongs to a
    // different workspace than the quote just created — a sandbox lead must
    // never end up linked to a production quote, or vice versa.
    if (validLeadId) {
      void (async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: lead } = await (client as any)
          .from('leads')
          .select('id, environment')
          .eq('id', validLeadId)
          .maybeSingle();
        if (!lead) return;

        try {
          assertWorkspaceCompatibility(quoteWorkspace(lead), quoteWorkspace(data));
        } catch (compatErr) {
          console.warn('[api/quotes] Skipped lead link — workspace mismatch:', compatErr);
          return;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: linkErr } = await (client as any)
          .from('leads')
          .update({ quote_id: data.id, response_status: 'quoted' })
          .eq('id', validLeadId);
        if (linkErr) console.error('[api/quotes] lead link failed:', linkErr.message);
      })();
    }

    void recordAnalyticsEvent({
      sessionId: analyticsSessionId,
      eventName: 'quote_created',
      page: '/services',
      source: 'server',
      quoteId: data.id,
      eventValue: submittedTotal,
      eventData: {
        service: String(body.service_type),
        context: String(body.context),
        scope: typeof body.scope === 'string' ? body.scope : null,
        frequency: typeof body.frequency === 'string' ? body.frequency : 'none',
        has_address: Boolean(typeof body.service_address === 'string' && body.service_address.trim()),
        customer_type: authUser?.role ?? 'anonymous',
        source: leadSource,
        utm_source: typeof body.utm_source === 'string' ? body.utm_source : null,
        utm_medium: typeof body.utm_medium === 'string' ? body.utm_medium : null,
      },
    });

    // Send "quote received" confirmation email — fire and forget
    const customerEmail = body.customer_email as string | undefined;
    if (customerEmail && data) {
      const resend = getResendClient();
      if (resend) {
        const { subject, html } = quoteReceivedEmail({
          customerName: body.customer_name as string,
          serviceLabel: SERVICE_LABELS[body.service_type as string] ?? String(body.service_type),
          total: submittedTotal,
          quoteId: data.id,
        });
        resend.emails.send({ from: FROM_ADDRESS, to: customerEmail, subject, html }).catch((err) => {
          console.error('[email] quote_received send failed:', err);
        });
      }
    }

    // Notify admin a new quote landed — fire and forget
    if (data) {
      const resend = getResendClient();
      if (resend) {
        const { subject, html } = adminNewQuoteEmail({
          customerName: body.customer_name as string,
          customerEmail: body.customer_email as string | null ?? null,
          customerPhone: body.customer_phone as string | null ?? null,
          serviceLabel: SERVICE_LABELS[body.service_type as string] ?? String(body.service_type),
          total: submittedTotal,
          quoteId: data.id,
          serviceAddress: typeof body.service_address === 'string' ? body.service_address.trim() : null,
          dashboardUrl: `${SITE_URL}/dashboard/quotes`,
        });
        resend.emails.send({ from: FROM_ADDRESS, to: ADMIN_EMAIL, subject, html }).catch((err) => {
          console.error('[email] admin_new_quote send failed:', err);
        });
      }
    }

    // Auto-forward NDIS quotes to the plan manager / participant nominee / NDIA
    // billing contact so funding can be confirmed without manual steps.
    if (
      isNdis &&
      ndisForwardEmail &&
      ndisManagementType &&
      data
    ) {
      const resend = getResendClient();
      if (resend) {
        const { subject, html } = ndisForwardQuoteEmail({
          participantName: body.customer_name as string,
          forwardContactName: ndisForwardContact,
          managementType: ndisManagementType as 'plan_managed' | 'self_managed' | 'agency_managed',
          serviceLabel: SERVICE_LABELS[body.service_type as string] ?? String(body.service_type),
          estimatedHours: ndisEstimatedHoursNum,
          hourlyRate: ndisHourlyRateNum,
          total: submittedTotal,
          serviceAddress: typeof body.service_address === 'string' ? body.service_address.trim() : null,
          quoteId: data.id,
          notes: typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null,
        });
        resend.emails
          .send({ from: FROM_ADDRESS, to: ndisForwardEmail, subject, html })
          .then(() => {
            // Mark as forwarded; best-effort, don't block the response.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (client as any)
              .from('quotes')
              .update({ ndis_forwarded_at: new Date().toISOString() })
              .eq('id', data.id)
              .then(() => {})
              .catch((err: unknown) => console.error('[ndis] forwarded_at stamp failed:', err));
          })
          .catch((err) => {
            console.error('[email] ndis_forward send failed:', err);
          });
      }
    }

    return NextResponse.json({ quote: data });
  });
}
