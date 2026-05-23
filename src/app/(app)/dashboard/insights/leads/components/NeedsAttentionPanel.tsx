'use client';

// -----------------------------------------------------------------------------
// Needs Attention Panel
// -----------------------------------------------------------------------------
// Module 2 — single panel that surfaces operational urgency:
//   · unanswered leads          · waiting > 1 hour
//   · overdue follow-ups        · abandoned quotes
//   · failed contact attempts (placeholder — wired when conversations exist)
//
// Every row has an action (Open) — no decorative cards. The bucket
// summary chips at the top let an operator triage faster.
// -----------------------------------------------------------------------------

import Link from 'next/link';
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { night, tempTone } from '@/app/ui/theme';
import { NightPanel, NightChip, NightEmpty, PulseDot, SourceTag } from './NightPrimitives';
import { formatLeadAge, formatLeadMoney } from '../lib/leadAdapter';
import type { AttentionItem } from '../lib/types';

const CATEGORY_META: Record<AttentionItem['category'], { label: string; tone: 'hot' | 'warm' | 'cold' | 'lost'; verb: string }> = {
  unanswered: { label: 'Unanswered', tone: 'hot', verb: 'Reply' },
  waiting_long: { label: 'Waiting > 1h', tone: 'warm', verb: 'Respond' },
  overdue_followup: { label: 'Overdue follow-up', tone: 'warm', verb: 'Chase' },
  abandoned_quote: { label: 'Abandoned quote', tone: 'cold', verb: 'Recover' },
  failed_contact: { label: 'Failed contact', tone: 'hot', verb: 'Retry' },
};

export function NeedsAttentionPanel({
  items,
  limit = 8,
}: {
  items: AttentionItem[];
  limit?: number;
}) {
  // Bucket counts for the summary strip
  const counts = useMemo(() => {
    const map: Record<AttentionItem['category'], number> = {
      unanswered: 0,
      waiting_long: 0,
      overdue_followup: 0,
      abandoned_quote: 0,
      failed_contact: 0,
    };
    for (const item of items) map[item.category] += 1;
    return map;
  }, [items]);

  const total = items.length;
  const hot = counts.unanswered + counts.failed_contact;

  const visible = items.slice(0, limit);

  return (
    <NightPanel
      title="Needs attention"
      subtitle="The shortest path to a missed dollar. Everything here is actionable."
      right={
        <span className="inline-flex items-center gap-2">
          {hot > 0 ? <PulseDot tone="hot" /> : null}
          {total} {total === 1 ? 'item' : 'items'}
        </span>
      }
    >
      {/* Summary chip strip */}
      <div className="mb-4 grid grid-cols-2 gap-2 xl:grid-cols-3">
        {(Object.entries(counts) as Array<[AttentionItem['category'], number]>).map(([cat, n]) => {
          const meta = CATEGORY_META[cat];
          const t = tempTone[meta.tone.toUpperCase() as 'HOT' | 'WARM' | 'COLD' | 'LOST'];
          const isActive = n > 0;
          return (
            <div
              key={cat}
              className="rounded-xl border px-3 py-2.5"
              style={{
                background: isActive ? t.bg : 'rgba(255,255,255,0.02)',
                borderColor: isActive ? t.ring : night.border,
                opacity: isActive ? 1 : 0.5,
              }}
            >
              <p className="text-[10px] uppercase tracking-[0.16em]" style={{ color: night.subtle }}>
                {meta.label}
              </p>
              <p className="mt-1 text-xl font-semibold tabular-nums" style={{ color: isActive ? t.text : night.muted }}>
                {n}
              </p>
            </div>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <NightEmpty
          title="Nothing needs attention right now."
          detail="When a lead goes unanswered, abandoned, or stale, it will show up here with a one-click action."
        />
      ) : (
        <ul className="flex flex-col gap-2" role="list">
          {visible.map((item, idx) => (
            <motion.li
              key={item.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.22, delay: idx * 0.02 }}
            >
              <AttentionRow item={item} />
            </motion.li>
          ))}
        </ul>
      )}

      {items.length > limit ? (
        <p className="mt-3 text-center text-[11px]" style={{ color: night.subtle }}>
          + {items.length - limit} more in the queue
        </p>
      ) : null}
    </NightPanel>
  );
}

function AttentionRow({ item }: { item: AttentionItem }) {
  const meta = CATEGORY_META[item.category];
  const t = tempTone[meta.tone.toUpperCase() as 'HOT' | 'WARM' | 'COLD' | 'LOST'];
  return (
    <Link
      href={item.href}
      className="group flex items-center gap-3 rounded-xl border px-3 py-3 transition hover:bg-white/[0.025]"
      style={{ borderColor: night.border, background: 'rgba(255,255,255,0.012)' }}
    >
      <span
        className="inline-flex h-1.5 w-1.5 flex-shrink-0 rounded-full"
        style={{ background: t.text, boxShadow: `0 0 12px ${t.ring}` }}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold" style={{ color: night.text }}>{item.title}</span>
          <NightChip tone={meta.tone}>
            {meta.label}
          </NightChip>
        </div>
        <div className="mt-1 flex items-center gap-2 text-[11px]" style={{ color: night.muted }}>
          <span className="truncate">{item.detail}</span>
        </div>
      </div>
      <div className="flex flex-shrink-0 items-center gap-3 text-right">
        <div>
          <p className="text-sm font-semibold tabular-nums" style={{ color: night.text }}>
            {formatLeadMoney(item.value)}
          </p>
          <div className="mt-0.5 flex items-center justify-end gap-1.5 text-[10px] uppercase tracking-[0.14em]" style={{ color: night.subtle }}>
            <SourceTag source={item.source} className="!px-1.5 !py-0 !text-[10px]" />
            <span>{formatLeadAge(item.ageHours)}</span>
          </div>
        </div>
        <span
          className="text-[11px] font-semibold opacity-0 transition group-hover:opacity-100"
          style={{ color: night.accent }}
        >
          {meta.verb} →
        </span>
      </div>
    </Link>
  );
}
