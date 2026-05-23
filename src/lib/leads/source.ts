// -----------------------------------------------------------------------------
// Lead source resolution — server-side
// -----------------------------------------------------------------------------
// Single source of truth for "where did this lead come from?" attribution.
//
// Used by:
//   - /api/quotes POST (sets quotes.source on insert)
//   - /api/leads/messenger POST (sets leads.source on insert)
//   - lib/agents/runtime.ts createQuoteEffect (agent-created quotes)
//
// Why a helper instead of inlining: keeping the mapping in one place means the
// Bud Leads adapter and the quote-insert routes can't drift. When the funnel
// shows a Google-Ads-attributed conversion, it's because *this* function
// returned 'website' + utmSource='google' was captured upstream.
// -----------------------------------------------------------------------------

/**
 * The canonical set of lead source channels. Must stay in sync with:
 *   - the CHECK constraint on quotes.source and leads.source (070_bud_leads.sql)
 *   - the LeadSource type in src/app/(app)/dashboard/insights/leads/lib/types.ts
 */
export const LEAD_SOURCES = [
  'website',
  'messenger',
  'sms',
  'instagram',
  'email',
  'phone',
  'referral',
  'unknown',
] as const;

export type LeadSource = (typeof LEAD_SOURCES)[number];

const LEAD_SOURCE_SET: ReadonlySet<string> = new Set<string>(LEAD_SOURCES);

/**
 * Input bag for resolveLeadSource. Every field is optional — anything missing
 * is ignored and we fall back through the precedence order.
 *
 * Precedence (highest first):
 *   1. Explicit `source` on the payload (already a valid LeadSource)
 *   2. `utm_source` (mapped via UTM_SOURCE_MAP)
 *   3. `referrer` host (mapped via REFERRER_HOST_MAP)
 *   4. Default 'website'
 */
export type LeadSourceInput = {
  source?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  referrer?: string | null;
};

/**
 * utm_source → LeadSource. Lowercased before lookup. Anything not listed
 * falls through to the referrer check, then to 'website'.
 *
 * Conservative on purpose — we'd rather attribute to 'website' than guess
 * wrong and pollute the funnel-by-channel panel.
 */
const UTM_SOURCE_MAP: Record<string, LeadSource> = {
  // Meta / Instagram surfaces
  facebook: 'messenger',
  'facebook-messenger': 'messenger',
  fb: 'messenger',
  messenger: 'messenger',
  m_messenger: 'messenger',
  instagram: 'instagram',
  ig: 'instagram',

  // Email campaigns
  email: 'email',
  mailchimp: 'email',
  resend: 'email',
  newsletter: 'email',

  // SMS
  sms: 'sms',
  twilio: 'sms',

  // Referral programs
  referral: 'referral',
  partner: 'referral',
};

/**
 * referrer host → LeadSource. Compared case-insensitively against the host
 * (and lightly normalised — `www.` and the TLD don't matter).
 */
const REFERRER_HOST_PATTERNS: ReadonlyArray<{ test: RegExp; source: LeadSource }> = [
  { test: /(?:^|\.)m\.me$/i, source: 'messenger' },
  { test: /(?:^|\.)messenger\.com$/i, source: 'messenger' },
  { test: /(?:^|\.)facebook\.com$/i, source: 'messenger' },
  { test: /(?:^|\.)fb\.com$/i, source: 'messenger' },
  { test: /(?:^|\.)instagram\.com$/i, source: 'instagram' },
  { test: /(?:^|\.)ig\.me$/i, source: 'instagram' },
];

function normalize(value: string | null | undefined): string {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
}

function hostFromReferrer(referrer: string | null | undefined): string | null {
  const trimmed = (referrer ?? '').trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed).host.toLowerCase();
  } catch {
    // Some referrer headers arrive as a bare host. Accept those too.
    if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(trimmed)) return trimmed.toLowerCase();
    return null;
  }
}

/**
 * Resolve a LeadSource from a lead-creation payload. Always returns a valid
 * LeadSource — never throws, never returns null. Default is 'website' (since
 * every other ingest channel writes through its own dedicated route).
 *
 * Tested in: src/lib/leads/__tests__/source.test.ts
 */
export function resolveLeadSource(input: LeadSourceInput): LeadSource {
  // 1. Explicit source wins, if it's already a valid value.
  const explicit = normalize(input.source);
  if (explicit && LEAD_SOURCE_SET.has(explicit)) {
    return explicit as LeadSource;
  }

  // 2. utm_source mapping.
  const utm = normalize(input.utm_source);
  if (utm) {
    const mapped = UTM_SOURCE_MAP[utm];
    if (mapped) return mapped;
    // utm_source present but unmapped — still meaningful: any paid/social
    // traffic surfaces as 'website' since the quote landed on our site.
  }

  // 3. Referrer host mapping.
  const host = hostFromReferrer(input.referrer);
  if (host) {
    for (const pattern of REFERRER_HOST_PATTERNS) {
      if (pattern.test.test(host)) return pattern.source;
    }
  }

  // 4. Default.
  return 'website';
}

/**
 * Coerce an arbitrary value to a LeadSource, or null if it's not recognised.
 * Used at API boundaries when we receive `source` from a trusted caller
 * (e.g. the Messenger ingest route which knows it's writing a messenger lead).
 */
export function coerceLeadSource(value: unknown): LeadSource | null {
  if (typeof value !== 'string') return null;
  const lower = value.trim().toLowerCase();
  return LEAD_SOURCE_SET.has(lower) ? (lower as LeadSource) : null;
}
