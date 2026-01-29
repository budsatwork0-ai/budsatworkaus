// Subscription Types for Buds at Work

import type { ServiceType, Context } from './orders';

export type SubscriptionFrequency = 'daily' | '3x_weekly' | 'weekly' | 'fortnightly' | 'monthly';
export type SubscriptionStatus = 'active' | 'paused' | 'cancelled';

export interface Subscription {
  id: string;
  customer_id?: string | null;
  customer_name: string;
  customer_email?: string | null;
  customer_phone?: string | null;
  service_type: ServiceType;
  context: Context;
  scope?: string | null;
  frequency: SubscriptionFrequency;
  base_price: number;
  discount_percent: number;
  price_per_cycle: number;
  status: SubscriptionStatus;
  start_date: string;
  next_service_date?: string | null;
  last_service_date?: string | null;
  end_date?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionFilters {
  status?: SubscriptionStatus | 'all';
  service_type?: ServiceType | 'all';
  frequency?: SubscriptionFrequency | 'all';
  search?: string;
}

export interface CreateSubscriptionInput {
  customer_id?: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  service_type: ServiceType;
  context: Context;
  scope?: string;
  frequency: SubscriptionFrequency;
  base_price: number;
  discount_percent?: number;
  price_per_cycle: number;
  status?: SubscriptionStatus;
  start_date: string;
  next_service_date?: string;
  notes?: string;
}

export interface UpdateSubscriptionInput {
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  frequency?: SubscriptionFrequency;
  base_price?: number;
  discount_percent?: number;
  price_per_cycle?: number;
  status?: SubscriptionStatus;
  next_service_date?: string;
  last_service_date?: string;
  end_date?: string;
  notes?: string;
}

// Subscription order link (for tracking orders generated from subscriptions)
export interface SubscriptionOrder {
  id: string;
  subscription_id: string;
  order_id: string;
  service_date: string;
  created_at: string;
}

// Helper labels for display
export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  active: 'Active',
  paused: 'Paused',
  cancelled: 'Cancelled',
};

export const SUBSCRIPTION_STATUS_COLORS: Record<SubscriptionStatus, string> = {
  active: 'bg-green-100 text-green-800',
  paused: 'bg-yellow-100 text-yellow-800',
  cancelled: 'bg-red-100 text-red-800',
};

export const SUBSCRIPTION_FREQUENCY_LABELS: Record<SubscriptionFrequency, string> = {
  daily: 'Daily',
  '3x_weekly': '3x Weekly',
  weekly: 'Weekly',
  fortnightly: 'Fortnightly',
  monthly: 'Monthly',
};

// Frequency discount percentages (from your pricing logic)
export const FREQUENCY_DISCOUNTS: Record<SubscriptionFrequency, number> = {
  daily: 0.28,
  '3x_weekly': 0.18,
  weekly: 0.12,
  fortnightly: 0.10,
  monthly: 0,
};

// Calculate cycles per month for revenue forecasting
export const CYCLES_PER_MONTH: Record<SubscriptionFrequency, number> = {
  daily: 30,
  '3x_weekly': 12,
  weekly: 4,
  fortnightly: 2,
  monthly: 1,
};

// Helper to calculate monthly revenue from a subscription
export function calculateMonthlyRevenue(subscription: Subscription): number {
  const cyclesPerMonth = CYCLES_PER_MONTH[subscription.frequency];
  return subscription.price_per_cycle * cyclesPerMonth;
}

// Helper to calculate annual revenue from a subscription
export function calculateAnnualRevenue(subscription: Subscription): number {
  return calculateMonthlyRevenue(subscription) * 12;
}
