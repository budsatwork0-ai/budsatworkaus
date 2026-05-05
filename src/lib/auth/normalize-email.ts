/**
 * Canonical email normalization.
 *
 * The goal is to collapse the many surface-level variants of the *same*
 * inbox to a single string we can use for duplicate detection and unique
 * indexes.
 *
 * Rules:
 *  - Trim & lowercase the whole address.
 *  - Strip `+aliases` from the local part for every provider that honours
 *    them (Gmail, Outlook, Fastmail, Apple, Yahoo, ProtonMail, etc.). This
 *    is the most common dodge people use to register twice.
 *  - For Gmail / Googlemail specifically, also strip dots in the local
 *    part and unify the domain. `b.o.b+test@googlemail.com` → `bob@gmail.com`.
 *
 * We deliberately do NOT mutate non-Gmail dots — some providers DO treat
 * dots as significant.
 *
 * Use `normalizeEmail` for storage and duplicate checks. Use
 * `displayEmail` (just lowercase + trim) when you need to *show* the email
 * back to the user as they typed it.
 */

const GMAIL_DOMAINS = new Set(['gmail.com', 'googlemail.com']);

const PLUS_ALIAS_PROVIDERS = new Set([
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'yahoo.com',
  'yahoo.com.au',
  'ymail.com',
  'fastmail.com',
  'fastmail.fm',
  'protonmail.com',
  'proton.me',
  'pm.me',
  'tutanota.com',
  'tuta.io',
]);

export interface NormalizedEmail {
  /** What the user typed, lowercased and trimmed — safe to display back. */
  display: string;
  /** Canonical form used for duplicate detection / unique indexes. */
  canonical: string;
  /** True if the address parsed cleanly (has a single `@` with non-empty parts). */
  valid: boolean;
}

export function displayEmail(input: string | null | undefined): string {
  return (input ?? '').trim().toLowerCase();
}

export function normalizeEmail(input: string | null | undefined): NormalizedEmail {
  const display = displayEmail(input);
  if (!display || display.indexOf('@') === -1) {
    return { display, canonical: display, valid: false };
  }

  const atIndex = display.lastIndexOf('@');
  let local = display.slice(0, atIndex);
  let domain = display.slice(atIndex + 1);

  if (!local || !domain || !domain.includes('.')) {
    return { display, canonical: display, valid: false };
  }

  // Strip +alias for providers that honour subaddressing.
  if (PLUS_ALIAS_PROVIDERS.has(domain) && local.includes('+')) {
    local = local.slice(0, local.indexOf('+'));
  }

  // Gmail-specific: ignore dots, unify domain.
  if (GMAIL_DOMAINS.has(domain)) {
    local = local.replace(/\./g, '');
    domain = 'gmail.com';
  }

  if (!local) {
    return { display, canonical: display, valid: false };
  }

  return { display, canonical: `${local}@${domain}`, valid: true };
}

/**
 * Convenience: just the canonical string, or empty string when invalid.
 * Useful when you need a single value for a DB column or RPC argument.
 */
export function canonicalEmail(input: string | null | undefined): string {
  return normalizeEmail(input).canonical;
}
