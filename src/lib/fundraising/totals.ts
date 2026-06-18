export type ContributionStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export interface FundraisingContribution {
  id: string;
  fundraising_item_id: string;
  amount_cents: number;
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
  verified_raised_amount_cents: number;
  manual_adjustment_cents: number;
  raised_amount_cents: number;
  contribution_count: number;
  progress_percentage: number;
  remaining_amount_cents: number;
  is_funded: boolean;
}

export function calculateFundraisingTotals(
  item: FundraisingTotalsInput,
  contributions: Pick<FundraisingContribution, 'fundraising_item_id' | 'amount_cents' | 'status'>[]
): FundraisingTotals {
  const paidContributions = contributions.filter(
    (contribution) => contribution.fundraising_item_id === item.id && contribution.status === 'paid'
  );
  const verifiedRaised = paidContributions.reduce(
    (total, contribution) => total + Math.max(0, Number(contribution.amount_cents) || 0),
    0
  );
  const manualAdjustment = Number(item.manual_adjustment_cents ?? 0) || 0;
  const raised = Math.max(0, verifiedRaised + manualAdjustment);
  const goal = Math.max(0, Number(item.goal_amount_cents) || 0);
  const progress = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;

  return {
    verified_raised_amount_cents: verifiedRaised,
    manual_adjustment_cents: manualAdjustment,
    raised_amount_cents: raised,
    contribution_count: paidContributions.length,
    progress_percentage: progress,
    remaining_amount_cents: Math.max(0, goal - raised),
    is_funded: goal > 0 && raised >= goal,
  };
}

export function attachFundraisingTotals<
  T extends FundraisingTotalsInput & { raised_amount_cents?: number | null },
>(
  items: T[],
  contributions: Pick<FundraisingContribution, 'fundraising_item_id' | 'amount_cents' | 'status'>[]
) {
  return items.map((item) => ({
    ...item,
    ...calculateFundraisingTotals(item, contributions),
  }));
}
