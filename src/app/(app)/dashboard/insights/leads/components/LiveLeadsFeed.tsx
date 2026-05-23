'use client';

// -----------------------------------------------------------------------------
// Live Leads Feed
// -----------------------------------------------------------------------------
// Module 1 — real-time stream of leads. Each row answers, at a glance:
//   service · suburb · source · age · temperature · quote status
//
// HOT rows pulse with a soft glow. The list is filterable by temperature and
// source, defaults to "all temperatures, last 24h", and stays under one
// scroll viewport on desktop. Click a row → /dashboard/quotes deep link.
// -----------------------------------------------------------------------------

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cx, night, tempTone } from '@/app/ui/theme';
import {
  NightPanel,
  NightChip,
  TemperatureBadge,
  SourceTag,
  NightEmpty,
} from './NightPrimitives';
import { formatLeadAge, formatLeadMoney, SOURCE_ORDER, TEMPERATURE_ORDER } from '../lib/leadAdapter';
import type { Lead, LeadSource, LeadTemperature } from '../lib/types';

type Filter = 'all' | LeadTemperature;
type SourceFilter = 'all' | LeadSource;

export function LiveLeadsFeed({ leads }: { leads: Lead[] }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');

  // Order: HOT first, then by age desc within temperature.
  const ordered = useMemo(() => {
    const tempRank: Record<LeadTemperature, number> = { HOT: 0, WARM: 1, COLD: 2, LOST: 3 };
    return [...leads].sort((a, b) => {
      const r = tempRank[a.temperature] - tempRank[b.temperature];
      if (r !== 0) return r;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [leads]);

  const visible = useMemo(() => {
    return ordered.filter((l) => {
      if (filter !== 'all' && l.temperature !== filter) return false;
      if (sourceFilter !== 'all' && l.source !== sourceFilter) return false;
      return true;
    });
  }, [ordered, filter, sourceFilter]);

  // Source pills — only show sources that actually exist in the dataset (plus 'all').
  const sourcesPresent = useMemo(() => {
    const set = new Set<LeadSource>(leads.map((l) => l.source));
    return SOURCE_ORDER.filter((s) => set.has(s));
  }, [leads]);

  // Temperature counts for the filter chips.
  const tempCounts = useMemo(() => {
    const counts: Record<LeadTemperature, number> = { HOT: 0, WARM: 0, COLD: 0, LOST: 0 };
    for (const l of ordered) counts[l.temperature] += 1;
    return counts;
  }, [ordered]);

  const hotCount = tempCounts.HOT;

  return (
    <NightPanel
      title="Live Leads"
      subtitle="Every active lead, hottest first. HOT rows pulse — these need a response now."
      right={
        <span className="inline-flex items-center gap-2">
          <span
            className="relative inline-flex h-2 w-2"
            aria-hidden
          >
            <motion.span
              className="absolute inset-0 rounded-full"
              style={{ background: hotCount > 0 ? night.hot : night.accent }}
              initial={{ opacity: 0.5, scale: 1 }}
              animate={{ opacity: 0, scale: 2.6 }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
            />
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: hotCount > 0 ? night.hot : night.accent }}
            />
          </span>
          {visible.length} of {leads.length} leads
        </span>
      }
      pad="sm"
    >
      {/* Filters */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <FilterPill active={filter === 'all'} onClick={() => setFilter('all')}>
          All · {ordered.length}
        </FilterPill>
        {TEMPERATURE_ORDER.map((t) => (
          <FilterPill
            key={t}
            active={filter === t}
            onClick={() => setFilter(filter === t ? 'all' : t)}
            tone={t.toLowerCase() as 'hot' | 'warm' | 'cold' | 'lost'}
          >
            {t} · {tempCounts[t]}
          </FilterPill>
        ))}
        <div className="mx-1 h-4 w-px" style={{ background: night.border }} aria-hidden />
        <FilterPill active={sourceFilter === 'all'} onClick={() => setSourceFilter('all')}>
          Any source
        </FilterPill>
        {sourcesPresent.map((s) => (
          <FilterPill
            key={s}
            active={sourceFilter === s}
            onClick={() => setSourceFilter(sourceFilter === s ? 'all' : s)}
          >
            {capitalize(s)}
          </FilterPill>
        ))}
      </div>

      {/* Feed */}
      {visible.length === 0 ? (
        <NightEmpty
          title="No leads match that filter"
          detail="Try clearing the filter, or check back when new quotes arrive."
        />
      ) : (
        <ul className="flex flex-col" role="list">
          <AnimatePresence initial={false}>
            {visible.map((lead, idx) => (
              <motion.li
                key={lead.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25, delay: Math.min(idx * 0.012, 0.2) }}
              >
                <LeadRow lead={lead} />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </NightPanel>
  );
}

function LeadRow({ lead }: { lead: Lead }) {
  const tone = tempTone[lead.temperature];
  const isHot = lead.isHotPulse;
  return (
    <Link
      href={lead.href}
      className="group relative flex items-center gap-4 rounded-xl px-3 py-3 transition"
      style={{
        // HOT gets a subtle inner glow ring + hover lifts to a panelAlt.
        background: isHot ? 'rgba(255,90,69,0.045)' : undefined,
        boxShadow: isHot ? `inset 0 0 0 1px ${tone.ring}` : undefined,
      }}
    >
      {/* Left rail — temperature dot */}
      <div className="flex h-full w-6 flex-shrink-0 items-center justify-center">
        <TemperatureBadge temperature={lead.temperature} pulse={isHot} size="sm" />
      </div>

      {/* Main */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold" style={{ color: night.text }}>
            {lead.serviceLabel}
          </span>
          <span className="text-[11px]" style={{ color: night.subtle }}>·</span>
          <span className="truncate text-[13px]" style={{ color: night.muted }}>
            {lead.suburb || 'Suburb unknown'}
          </span>
          {lead.attentionReason ? (
            <NightChip tone="warm" className="ml-1 hidden lg:inline-flex">
              {lead.attentionReason}
            </NightChip>
          ) : null}
        </div>
        <div className="mt-1 flex items-center gap-2 text-[11px]" style={{ color: night.subtle }}>
          <span className="truncate">{lead.customerName}</span>
          <span aria-hidden>·</span>
          <SourceTag source={lead.source} />
          <span aria-hidden>·</span>
          <span>{quoteStatusLabel(lead.quoteStatus)}</span>
        </div>
      </div>

      {/* Right cluster — value + age */}
      <div className="flex flex-shrink-0 items-center gap-4 text-right">
        <div>
          <p className="text-sm font-semibold tabular-nums" style={{ color: night.text }}>
            {formatLeadMoney(lead.value)}
          </p>
          <p className="text-[10px] uppercase tracking-[0.16em]" style={{ color: night.subtle }}>
            {formatLeadAge(lead.ageHours)} ago
          </p>
        </div>
        <span
          className="text-[11px] opacity-0 transition group-hover:opacity-100"
          style={{ color: night.accent }}
        >
          Open →
        </span>
      </div>

      {/* Row divider on hover-target only — keeps list tight */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-3 -bottom-px h-px"
        style={{ background: night.divider }}
      />
    </Link>
  );
}

function FilterPill({
  active,
  onClick,
  tone,
  children,
}: {
  active: boolean;
  onClick: () => void;
  tone?: 'hot' | 'warm' | 'cold' | 'lost';
  children: React.ReactNode;
}) {
  if (tone) {
    const t = tempTone[tone.toUpperCase() as LeadTemperature];
    return (
      <button
        type="button"
        onClick={onClick}
        className={cx(
          'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold transition',
          active ? '' : 'opacity-70 hover:opacity-100'
        )}
        style={{
          background: active ? t.bg : 'transparent',
          color: t.text,
          borderColor: active ? t.ring : 'rgba(255,255,255,0.08)',
        }}
      >
        {children}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium transition'
      )}
      style={{
        background: active ? 'rgba(28,124,84,0.18)' : 'transparent',
        color: active ? '#7CE0B0' : night.muted,
        borderColor: active ? 'rgba(28,124,84,0.4)' : 'rgba(255,255,255,0.08)',
      }}
    >
      {children}
    </button>
  );
}

function quoteStatusLabel(status: string): string {
  switch (status) {
    case 'submitted': return 'Quote submitted';
    case 'in_review': return 'In review';
    case 'finalized': return 'Quote sent';
    case 'payment_pending': return 'Awaiting payment';
    case 'paid': return 'Booked';
    case 'draft': return 'Draft';
    case 'lost': return 'Lost';
    case 'cancelled': return 'Cancelled';
    default: return status.replace('_', ' ');
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
