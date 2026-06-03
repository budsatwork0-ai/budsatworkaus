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
  customerDelta,
  revenueDelta,
  newLeadsCount,
  leads,
}: {
  customers: string;
  revenue: string;
  customerDelta: string;
  revenueDelta: string;
  newLeadsCount: number;
  leads: AvatarLead[];
}) {
  return (
    <section className="rounded-[30px] border border-[#dfe9e2] bg-white px-6 py-7 shadow-[0_18px_48px_rgba(15,61,46,0.07)] sm:px-8 lg:px-9">
      <div className="mb-7 flex items-center justify-between gap-4">
        <h2 className="text-[28px] font-extrabold leading-tight text-[#17392b]">Overview</h2>
        <select className="h-11 rounded-full border border-[#dfe9e2] bg-white px-5 text-[16px] font-semibold text-[#839188] outline-none">
          <option>Last month</option>
          <option>This month</option>
          <option>Last quarter</option>
        </select>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <MetricCard
          label="Customers"
          value={customers}
          subtitle="vs last month"
          delta={customerDelta}
          deltaTone="red"
          icon={<UserIcon />}
        />
        <MetricCard
          label="Revenue · MTD"
          value={revenue}
          subtitle="vs last month"
          delta={revenueDelta}
          deltaTone="green"
          icon={<WalletIcon />}
        />
      </div>

      <div className="mt-8">
        <h3 className="text-[23px] font-extrabold text-[#17392b]">{newLeadsCount} new leads this week!</h3>
        <p className="text-[17px] font-medium text-[#87968d]">Send a welcome message to all new customers.</p>
        <div className="mt-3 flex flex-wrap items-end gap-5">
          {leads.map((lead) => (
            <Link key={`${lead.name}-${lead.initials}`} href="/dashboard/customers" className="group text-center">
              <span className="grid h-[76px] w-[76px] place-items-center rounded-full bg-[#dfdfe1] text-xl font-bold text-[#666a68] transition group-hover:bg-[#d6eadb]">
                {lead.initials}
              </span>
              <span className="mt-2 block max-w-[76px] truncate text-[16px] font-medium text-[#7d8d84]">{lead.name}</span>
            </Link>
          ))}
          <Link href="/dashboard/customers" className="text-center">
            <span className="grid h-[76px] w-[76px] place-items-center rounded-full border border-[#dfe9e2] bg-white text-[#7d8d84] shadow-sm">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </span>
            <span className="mt-2 block text-[16px] font-medium text-[#7d8d84]">View all</span>
          </Link>
        </div>
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
