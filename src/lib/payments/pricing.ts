export const STRIPE_PERCENT_FEE = 0.017;
export const STRIPE_FIXED_FEE_CENTS = 30;
export const MINIMUM_STRIPE_CHARGE_CENTS = 1000;

const STRIPE_FEE_PER_THOUSAND = Math.round(STRIPE_PERCENT_FEE * 1000);

export const SMALL_JOB_PAYMENT_COPY =
  'Minimum booking amount applies. Small jobs may be bundled for best value, or paid by PayID/bank transfer.';

export type StripeFeeEstimate = {
  amountCents: number;
  feeCents: number;
  netCents: number;
};

export type StripeCheckoutPolicy = {
  amountCents: number;
  allowed: boolean;
  minimumChargeCents: number;
  message?: string;
};

export function dollarsToCents(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100);
}

export function centsToDollars(cents: number): number {
  if (!Number.isFinite(cents)) return 0;
  return cents / 100;
}

export function calculateStripeFeeEstimate(amountCents: number): StripeFeeEstimate {
  const safeAmountCents = Math.max(0, Math.round(amountCents));
  const feeCents =
    safeAmountCents > 0
      ? Math.ceil((safeAmountCents * STRIPE_FEE_PER_THOUSAND) / 1000) + STRIPE_FIXED_FEE_CENTS
      : 0;

  return {
    amountCents: safeAmountCents,
    feeCents,
    netCents: Math.max(0, safeAmountCents - feeCents),
  };
}

export function getStripeCheckoutPolicy(amountCents: number): StripeCheckoutPolicy {
  const safeAmountCents = Math.max(0, Math.round(amountCents));
  const allowed = safeAmountCents >= MINIMUM_STRIPE_CHARGE_CENTS;

  return {
    amountCents: safeAmountCents,
    allowed,
    minimumChargeCents: MINIMUM_STRIPE_CHARGE_CENTS,
    ...(allowed ? {} : { message: SMALL_JOB_PAYMENT_COPY }),
  };
}
