// Order Types for Buds at Work

export type ServiceType = 'windows' | 'cleaning' | 'yard' | 'dump' | 'auto' | 'sneakers';
export type Context = 'home' | 'commercial';
export type Frequency = 'none' | 'daily' | '3x_weekly' | 'weekly' | 'fortnightly' | 'monthly';

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export interface Order {
  id: string;
  quote_id?: string | null;
  customer_id?: string | null;
  customer_name: string;
  customer_email?: string | null;
  customer_phone?: string | null;
  service_type: ServiceType;
  context: Context;
  scope?: string | null;
  frequency: Frequency;
  base_price: number;
  discount_percent: number;
  final_price: number;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
  status: OrderStatus;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
}

export interface OrderFilters {
  status?: OrderStatus | 'all';
  service_type?: ServiceType | 'all';
  search?: string;
  date_from?: string;
  date_to?: string;
}

export interface CreateOrderInput {
  quote_id?: string;
  customer_id?: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  service_type: ServiceType;
  context: Context;
  scope?: string;
  frequency?: Frequency;
  base_price: number;
  discount_percent?: number;
  final_price: number;
  scheduled_date?: string;
  scheduled_time?: string;
  status?: OrderStatus;
  notes?: string;
}

export interface UpdateOrderInput {
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  scheduled_date?: string;
  scheduled_time?: string;
  status?: OrderStatus;
  notes?: string;
  completed_at?: string;
}

// Helper labels for display
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  scheduled: 'bg-purple-100 text-purple-800',
  in_progress: 'bg-orange-100 text-orange-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  windows: 'Windows',
  cleaning: 'Cleaning',
  yard: 'Yard',
  dump: 'Dump',
  auto: 'Auto',
  sneakers: 'Sneakers',
};

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  none: 'One-time',
  daily: 'Daily',
  '3x_weekly': '3x Weekly',
  weekly: 'Weekly',
  fortnightly: 'Fortnightly',
  monthly: 'Monthly',
};
