export type ContributionStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export interface FundraisingContribution {
  id: string;
  fundraising_item_id: string;
  amount_cents: number;
  gross_amount_cents: number;
  stripe_fee_cents: number;
  net_amount_cents: number;
  currency: string;
  payment_provider: string | null;
  payment_reference: string | null;
  payer_name: string | null;
  payer_email?: string | null;
  status: ContributionStatus;
  paid_at: string | null;
  created_at: string;
}

export interface FundraisingTotalsInput {
  id: string;
  goal_amount_cents: number;
  manual_adjustment_cents?: number | null;
}

export interface FundraisingTotals {
  // Gross (donor-facing) — used for public progress bar
  verified_raised_amount_cents: number;
  manual_adjustment_cents: number;
  raised_amount_cents: number;
  contribution_count: number;
  progress_percentage: number;
  remaining_amount_cents: number;
  is_funded: boolean;
  // Fee breakdown — admin only
  verified_stripe_fees_cents: number;
  verified_net_amount_cents: number;
  net_remaining_amount_cents: number;
}

export function calculateFundraisingTotals(
  item: FundraisingTotalsInput,
  contributions: Pick<FundraisingContribution, 'fundraising_item_id' | 'amount_cents' | 'gross_amount_cents' | 'stripe_fee_cents' | 'net_amount_cents' | 'status'>[]
): FundraisingTotals {
  const paidContributions = contributions.filter(
    (c) => c.fundraising_item_id === item.id && c.status === 'paid'
  );

  const verifiedGross = paidContributions.reduce(
    (total, c) => total + Math.max(0, Number(c.gross_amount_cents ?? c.amount_cents) || 0),
    0
  );
  const verifiedFees = paidContributions.reduce(
    (total, c) => total + Math.max(0, Number(c.stripe_fee_cents) || 0),
    0
  );
  const verifiedNet = paidContributions.reduce(
    (total, c) => total + Math.max(0, Number(c.net_amount_cents ?? c.amount_cents) || 0),
    0
  );

  const manualAdjustment = Number(item.manual_adjustment_cents ?? 0) || 0;
  const grossRaised = Math.max(0, verifiedGross + manualAdjustment);
  const netRaised   = Math.max(0, verifiedNet  + manualAdjustment);
  const goal        = Math.max(0, Number(item.goal_amount_cents) || 0);

  // Public: progress based on gross donor support
  const progress = goal > 0 ? Math.min(100, Math.round((grossRaised / goal) * 100)) : 0;

  return {
    verified_raised_amount_cents: verifiedGross,
    manual_adjustment_cents:      manualAdjustment,
    raised_amount_cents:          grossRaised,
    contribution_count:           paidContributions.length,
    progress_percentage:          progress,
    remaining_amount_cents:       Math.max(0, goal - grossRaised),
    is_funded:                    goal > 0 && grossRaised >= goal,
    verified_stripe_fees_cents:   verifiedFees,
    verified_net_amount_cents:    verifiedNet,
    net_remaining_amount_cents:   Math.max(0, goal - netRaised),
  };
}

export function attachFundraisingTotals<
  T extends FundraisingTotalsInput & { raised_amount_cents?: number | null },
>(
  items: T[],
  contributions: Pick<FundraisingContribution, 'fundraising_item_id' | 'amount_cents' | 'gross_amount_cents' | 'stripe_fee_cents' | 'net_amount_cents' | 'status'>[]
) {
  return items.map((item) => ({
    ...item,
    ...calculateFundraisingTotals(item, contributions),
  }));
}
