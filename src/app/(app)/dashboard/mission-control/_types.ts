export type AgentRow = {
  id: string;
  name: string;
  status: string;
  category: string;
  autonomy: string;
  last_run_at?: string | null;
  last_success_at?: string | null;
};

export type BusinessSnapshotData = {
  mtd_revenue: number;
  mtd_orders: number;
  completed_mtd: number;
  in_progress: number;
  jobs_today: number;
  pending_enquiries: number;
};

export type OpenEnquiryRow = {
  id: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  service_type: string | null;
  source: string;
  reply_channel: string | null;
  created_at: string;
};
