/**
 * Human-review-required file classifier.
 *
 * `CLAUDE.md` mandates explicit human approval before any pricing formula,
 * Stripe/payments, or auth/session change reaches production. The autonomous
 * improvement pipeline can otherwise auto-merge a patch once CI + taste + browser
 * gates pass — which must NEVER apply to these files. This module is the single
 * source of truth for "which paths force a change to human review".
 *
 * A match does not block the change; it forces the PR to open as a draft and
 * disables auto-merge, so a human makes the call. Bias is intentionally toward
 * over-flagging money/auth code — a false positive just means a human reviews.
 */

export type SensitiveCategory = 'pricing' | 'payments' | 'auth';

const RULES: Array<{ category: SensitiveCategory; test: (p: string) => boolean }> = [
  {
    category: 'pricing',
    test: (p) =>
      p.includes('pricing') ||            // src/lib/pricing, services/lib/pricing, payments/pricing.ts, rego/pricing.ts
      p.includes('ndis-pricing') ||
      p.includes('yardpricing') ||
      p.includes('yard-pricing') ||
      p.endsWith('/pricing.ts'),
  },
  {
    category: 'payments',
    test: (p) =>
      p.includes('/payments/') ||
      p.includes('stripe') ||
      p.includes('/checkout') ||
      p.includes('/webhooks/stripe'),
  },
  {
    category: 'auth',
    test: (p) =>
      p.includes('/middleware') ||
      p.includes('/lib/auth/') ||
      p.includes('supabase/server') ||
      p.includes('supabase/middleware'),
  },
];

/** Returns the sensitivity category for a path, or null if it is not sensitive. */
export function classifySensitiveFile(path: string): SensitiveCategory | null {
  if (!path) return null;
  const p = path.toLowerCase();
  for (const rule of RULES) {
    if (rule.test(p)) return rule.category;
  }
  return null;
}

/** Filters a set of paths down to the sensitive ones, tagged with their category. */
export function sensitiveFilesIn(
  paths: readonly string[],
): Array<{ file: string; category: SensitiveCategory }> {
  return paths.flatMap((file) => {
    const category = classifySensitiveFile(file);
    return category ? [{ file, category }] : [];
  });
}
