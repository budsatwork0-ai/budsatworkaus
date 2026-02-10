import React from 'react';
import { cls } from '../../utils/formatting';
import { ACCENT } from '../../lib/pricing/constants';
import { M } from '../../utils/motion';
import { WindowIcon, CleanIcon, LawnIcon, TruckIcon } from '../../utils/icons';

const LIVE_ORDER_ITEMS = [
  { label: 'Window clean', price: '$120', detail: '12 windows washed', icon: <WindowIcon />, timeAgo: '2 min ago', location: 'Brisbane' },
  { label: 'Deep clean', price: '$380', detail: 'Tidy 2 bed · 2 bath', icon: <CleanIcon />, timeAgo: '5 min ago', location: 'Gold Coast' },
  { label: 'Mow & edge', price: '$140', detail: 'Mow + tidy edges', icon: <LawnIcon />, timeAgo: '8 min ago', location: 'Sunshine Coast' },
  { label: 'Bin clean', price: '$80', detail: '2 bins scrubbed', icon: <TruckIcon />, timeAgo: '12 min ago', location: 'Ipswich' },
] as const;

export function LiveOrdersStrip({ className = '' }: { className?: string }) {
  return (
    <div className={cls('relative', className)}>
      {/* Section header */}
      <div className="flex items-center justify-center gap-3 mb-6">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-300/60 to-transparent" />
        <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/60 backdrop-blur-xl border border-white/80 shadow-sm">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-xs font-medium text-slate-700 tracking-wide uppercase">Live orders</span>
        </div>
        <div className="h-px flex-1 bg-gradient-to-l from-transparent via-slate-300/60 to-transparent" />
      </div>

      {/* Main container */}
      <div className="p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
            <div>
              <h3 className="text-lg sm:text-xl font-semibold text-slate-900 tracking-tight">
                What others are ordering
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                Popular services booked by customers near you
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Updated in real-time</span>
            </div>
          </div>

          {/* Cards grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" aria-label="Recently ordered services">
            {LIVE_ORDER_ITEMS.map((item, idx) => (
              <M.div
                key={item.label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ delay: idx * 0.1, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="group relative rounded-2xl bg-white/80 backdrop-blur-xl border border-white/90 p-4 shadow-[0_4px_20px_rgba(15,23,42,0.06)] hover:shadow-[0_8px_30px_rgba(15,23,42,0.1)] transition-all duration-300 hover:-translate-y-0.5"
              >
                {/* Top row: icon + service info */}
                <div className="flex items-start gap-3 mb-3">
                  <span
                    aria-hidden
                    className="shrink-0 text-slate-700 grid place-items-center h-11 w-11 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200/60 shadow-sm group-hover:scale-105 transition-transform duration-300"
                  >
                    {item.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-900 truncate">{item.label}</div>
                    <div className="text-xs text-slate-500 truncate mt-0.5">{item.detail}</div>
                  </div>
                </div>

                {/* Bottom row: price + meta */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <div
                    className="text-base font-bold tracking-tight"
                    style={{ color: ACCENT }}
                  >
                    {item.price}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-slate-400">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>{item.location}</span>
                    <span className="mx-1">·</span>
                    <span>{item.timeAgo}</span>
                  </div>
                </div>
              </M.div>
            ))}
          </div>
      </div>
    </div>
  );
}
