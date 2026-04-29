import Stripe from 'stripe';

// Server-only Stripe client.
// This should only be used in API routes and server actions.
//
// API version is pinned explicitly so a Dashboard-side bump can't change
// webhook payload shapes under us. Bump in a controlled PR after reading the
// Stripe upgrade guide for the new version.
const STRIPE_API_VERSION = '2026-01-28.clover' as const;

export function createStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      'Stripe secret key is missing. ' +
      'Ensure STRIPE_SECRET_KEY is set in environment variables.'
    );
  }
  return new Stripe(key, { apiVersion: STRIPE_API_VERSION, typescript: true });
}

// Safe version that returns null instead of throwing.
// Useful for graceful degradation when Stripe is not configured.
export function createStripeClientSafe(): Stripe | null {
  try {
    return createStripeClient();
  } catch {
    return null;
  }
}
