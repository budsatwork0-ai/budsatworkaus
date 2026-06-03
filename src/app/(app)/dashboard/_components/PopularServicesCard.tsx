'use client';

import Link from 'next/link';
import { StatusPill } from './StatusPill';

export type PopularService = {
  name: string;
  status: 'Active' | 'Offline';
  price: string;
  shade: 'dark' | 'mid' | 'soft';
};

export function PopularServicesCard({ services }: { services: PopularService[] }) {
  return (
    <section className="max-h-[270px] overflow-hidden rounded-[26px] border border-[#dfe9e2] bg-white px-4 py-4 shadow-[0_18px_48px_rgba(15,61,46,0.07)]">
      <h2 className="text-[18px] font-extrabold leading-tight text-[#17392b]">Popular services</h2>
      <div className="mt-3 divide-y divide-[#e2ebe5]">
        {services.length === 0 ? (
          <p className="rounded-[18px] bg-[#f4faf6] px-3 py-3 text-[13px] font-semibold text-[#7f9187]">No services recorded</p>
        ) : services.map((service) => (
          <div key={service.name} className="grid grid-cols-[38px_minmax(0,1fr)_auto] items-center gap-3 py-2 first:pt-0">
            <span className={`grid h-9 w-9 place-items-center rounded-[12px] text-white ${iconBg(service.shade)}`}>
              <ServiceIcon />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[14px] font-extrabold text-[#273f34]">{service.name}</p>
              <StatusPill tone={service.status === 'Active' ? 'green' : 'red'}>{service.status}</StatusPill>
            </div>
            <p className="text-[14px] font-extrabold text-[#273f34]">{service.price}</p>
          </div>
        ))}
      </div>
      <Link
        href="/dashboard/insights?tab=marketing"
        className="mt-3 flex h-9 items-center justify-center rounded-[16px] border border-[#dfe9e2] text-[13px] font-semibold text-[#839188] transition hover:bg-[#f4faf6]"
      >
        All services
      </Link>
    </section>
  );
}

function iconBg(shade: PopularService['shade']) {
  if (shade === 'dark') return 'bg-[#1f5a3f]';
  if (shade === 'mid') return 'bg-[#4fa46c]';
  return 'bg-[#8aa092]';
}

function ServiceIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 11V7a3 3 0 0 1 6 0v4" />
      <rect x="7" y="11" width="10" height="9" rx="2" />
      <path d="M18 7h2M19 4v6M4 6h2M5 3v6" />
    </svg>
  );
}
