'use client';

import Link from 'next/link';
import { useState } from 'react';

export type InboxItem = {
  key: string;
  stage: 'new' | 'quoted' | 'done';
  name: string;
  service: string | null;
  suburb: string | null;
  phone: string | null;
  createdAt: string;
  preview: string | null;
  href: string;
  isQuote?: boolean;
  total?: number | null;
  doneLabel?: string | null;
};

const TABS = [
  { key: 'new', label: 'New' },
  { key: 'quoted', label: 'Quoted' },
  { key: 'done', label: 'Done' },
] as const;

function age(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

function nice(s: string | null | undefined) {
  return (s || '').replace(/_/g, ' ');
}

function chaseHref(item: InboxItem) {
  if (!item.phone) return item.href;
  const first = item.name.split(' ')[0];
  const body = `Hi ${first}, just checking in on the quote for ${nice(item.service) || 'the job'}. Any questions? Cheers, Buds At Work`;
  return `sms:${item.phone}?&body=${encodeURIComponent(body)}`;
}

function Card({ item }: { item: InboxItem }) {
  const main =
    item.stage === 'new'
      ? { label: item.isQuote ? 'Send quote' : 'Reply', href: item.href }
      : item.stage === 'quoted'
        ? { label: 'Chase', href: chaseHref(item) }
        : null;
  return (
    <div className="rounded-[22px] bg-white p-4 shadow-[0_10px_30px_rgba(15,61,46,0.05)]">
      <Link href={item.href} className="block">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[16px] font-bold text-[#17392b]">{item.name}</span>
          <span className="shrink-0 text-xs font-semibold text-[#7f9187]">{age(item.createdAt)}</span>
        </div>
        <div className="mt-0.5 truncate text-sm capitalize text-[#7f9187]">
          {[nice(item.service), item.suburb, item.total ? `$${item.total}` : null].filter(Boolean).join(' · ') || 'No details yet'}
        </div>
        {item.preview ? <p className="mt-2 line-clamp-2 text-sm text-[#4b5d53]">“{item.preview}”</p> : null}
      </Link>
      {main ? (
        <a href={main.href} className="mt-3 flex h-11 items-center justify-center rounded-full bg-[#0F3F33] text-sm font-bold text-white">
          {main.label}
        </a>
      ) : (
        <div className="mt-2 text-xs font-semibold capitalize text-[#7f9187]">{nice(item.doneLabel)}</div>
      )}
    </div>
  );
}

export function LeadsInbox({ items, initialTab }: { items: InboxItem[]; initialTab: 'new' | 'quoted' | 'done' }) {
  const [tab, setTab] = useState(initialTab);
  const shown = items.filter((i) => i.stage === tab);
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 pb-10">
      <div className="flex gap-1 rounded-full bg-white p-1 shadow-sm">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`h-10 flex-1 rounded-full text-sm font-bold ${tab === t.key ? 'bg-[#0F3F33] text-white' : 'text-[#7f9187]'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'done' ? (
        <details className="rounded-[22px] bg-white/60 p-3">
          <summary className="cursor-pointer px-1 text-sm font-bold text-[#17392b]">Show finished leads</summary>
          <div className="mt-3 flex flex-col gap-3">{shown.map((i) => <Card key={i.key} item={i} />)}</div>
        </details>
      ) : shown.length === 0 ? (
        <p className="rounded-[22px] bg-white px-4 py-6 text-center text-[15px] font-semibold text-[#3c8259]">
          {tab === 'new' ? 'No new leads. All caught up ✓' : 'No quotes waiting'}
        </p>
      ) : (
        shown.map((i) => <Card key={i.key} item={i} />)
      )}
    </div>
  );
}
