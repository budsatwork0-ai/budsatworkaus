'use client';

import type React from 'react';
import { StatusPill } from './StatusPill';

export function MetricCard({
  label,
  value,
  subtitle,
  delta,
  deltaTone,
  icon,
}: {
  label: string;
  value: string;
  subtitle: string;
  delta?: string;
  deltaTone?: 'green' | 'red';
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-[20px] border border-[#dde8df] bg-white/92 px-4 py-3 shadow-[0_18px_38px_rgba(15,61,46,0.05)]">
      <div className="flex items-center gap-2 text-[13px] font-semibold text-[#87968d]">
        <span className="text-[#7d9186]">{icon}</span>
        <span>{label}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <p className="text-[28px] font-extrabold leading-none tracking-normal text-[#17392b] sm:text-[32px]">
          {value}
        </p>
        {delta && deltaTone ? <StatusPill tone={deltaTone}>{delta}</StatusPill> : null}
      </div>
      <p className="mt-1 text-[12px] font-medium text-[#a0ada5]">{subtitle}</p>
    </div>
  );
}
