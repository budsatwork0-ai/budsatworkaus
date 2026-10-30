'use client';

import OrderInvoice, { type InvoiceFields } from '../components/shared/OrderInvoice';

export type TodayJob = InvoiceFields & {
  id: string;
  customer_name: string | null;
  customer_email: string | null;
  service_type: string | null;
  scheduled_time: string | null;
  final_price: number;
  status: string;
};

export function BudOsToday({ jobs }: { jobs: TodayJob[] }) {
  if (jobs.length === 0) {
    return <p className="rounded-[16px] bg-[#f4faf6] px-4 py-3 text-[15px] text-[#7f9187]">No jobs today.</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      {jobs.map((job) => (
        <div key={job.id} className="rounded-[18px] border border-[#e6efe9] p-4">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-[16px] font-bold text-[#17392b]">{job.customer_name || 'Customer'}</span>
            <span className="shrink-0 text-sm font-semibold text-[#7f9187]">{job.scheduled_time || ''}</span>
          </div>
          <div className="mt-0.5 text-sm text-[#7f9187]">{(job.service_type || '').replace(/_/g, ' ')}</div>
          <div className="mt-3">
            <OrderInvoice orderId={job.id} order={job} />
          </div>
        </div>
      ))}
    </div>
  );
}
