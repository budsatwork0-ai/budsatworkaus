'use client';

import { brand } from '@/app/ui/theme';
import type { LiveEstimate } from './types';

interface Props {
  estimate: LiveEstimate;
}

function fmtAUD(n: number) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(n);
}

export function AssistantPriceBanner({ estimate }: Props) {
  return (
    <div
      className="flex items-center justify-between rounded-2xl px-4 py-3"
      style={{ background: brand.accentSoft }}
    >
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: brand.accent }}>
          Estimated price
        </p>
        <p className="text-[22px] font-bold leading-tight" style={{ color: brand.primary }}>
          {fmtAUD(estimate.total)}
        </p>
        {estimate.breakdown && (
          <p className="mt-0.5 text-[11px] leading-snug" style={{ color: brand.muted }}>
            {estimate.breakdown}
          </p>
        )}
      </div>
      {!estimate.breakdown && (
        <p className="max-w-[130px] text-right text-[11px] leading-snug" style={{ color: brand.muted }}>
          Confirmed before booking
        </p>
      )}
    </div>
  );
}
