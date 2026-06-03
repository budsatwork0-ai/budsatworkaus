'use client';

import type React from 'react';
import Link from 'next/link';
import { MetricCard } from './MetricCard';

type AvatarLead = {
  initials: string;
  name: string;
};

export function OverviewCard({
  customers,
  revenue,
  newLeadsCount,
  leads,
}: {
  customers: string;
  revenue: string;
  newLeadsCount: number;
  leads: AvatarLead[];
}) {
  return (
    <section className="rounded-[26px] border border-[#dfe9e2] bg-white px-4 py-4 shadow-[0_18px_48px_rgba(15,61,46,0.07)]">
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 className="text-[18px] font-extrabold leading-tight text-[#17392b]">Overview</h2>
        <span className="rounded-full border border-[#dfe9e2] bg-[#fbfdfb] px-3 py-1 text-[12px] font-bold text-[#839188]">Live data</span>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <MetricCard
          label="Customers"
          value={customers}
          subtitle="Total customer records"
          icon={<UserIcon />}
        />
        <MetricCard
          label="Revenue · MTD"
          value={revenue}
          subtitle={revenue === '$0' ? 'No revenue recorded' : 'Completed jobs this month'}
          icon={<WalletIcon />}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-[20px] bg-[#f4faf6] px-3 py-2.5">
        <div className="min-w-0">
          <h3 className="text-[15px] font-extrabold text-[#17392b]">{newLeadsCount} new leads this week</h3>
          <p className="text-[12px] font-semibold text-[#87968d]">Unique live leads and quote enquiries</p>
        </div>
        {leads.length > 0 ? (
          <div className="flex shrink-0 items-center -space-x-2">
            {leads.map((lead) => (
              <Link key={`${lead.name}-${lead.initials}`} href="/dashboard/customers" className="group" title={lead.name}>
                <span className="grid h-9 w-9 place-items-center rounded-full border-2 border-[#f4faf6] bg-[#dfdfe1] text-[12px] font-bold text-[#666a68] transition group-hover:bg-[#d6eadb]">
                  {lead.initials}
                </span>
              </Link>
            ))}
            <Link href="/dashboard/customers" className="grid h-9 w-9 place-items-center rounded-full border-2 border-[#f4faf6] bg-white text-[#7d8d84] shadow-sm" aria-label="View customers">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        ) : (
          <Link href="/dashboard/customers" className="shrink-0 text-[12px] font-bold text-[#3c8259]">View customers</Link>
        )}
      </div>
    </section>
  );
}

function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 12V8H6a2 2 0 1 1 0-4h12v4" />
      <path d="M4 6v14a2 2 0 0 0 2 2h14v-6" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
    </svg>
  );
}
