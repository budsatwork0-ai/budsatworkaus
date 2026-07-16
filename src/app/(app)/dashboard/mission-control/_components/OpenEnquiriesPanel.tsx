'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import type { OpenEnquiryRow } from '../_types';

// ── helpers ────────────────────────────────────────────────────────────────

const SERVICE_LABELS: Record<string, string> = {
  windows:         'Window cleaning',
  cleaning:        'Home cleaning',
  yard:            'Yard care',
  dump:            'Dump runs',
  auto:            'Auto detailing',
  laundry_sneakers:'Laundry & sneakers',
  sneakers:        'Sneaker care',
  other:           'General enquiry',
};

const SOURCE_GLYPH: Record<string, string> = {
  website:   '◐',
  messenger: '⌬',
  sms:       '✦',
  instagram: '◇',
  email:     '✉',
  phone:     '☏',
  referral:  '⇄',
  unknown:   '·',
};

function ageLabel(createdAt: string): { text: string; cls: string } {
  const hrs = (Date.now() - new Date(createdAt).getTime()) / 3_600_000;
  if (hrs < 24) {
    const text = hrs < 1 ? `${Math.max(1, Math.round(hrs * 60))}m` : `${Math.round(hrs)}h`;
    return { text, cls: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-300' };
  }
  if (hrs < 48) {
    return { text: `${Math.round(hrs)}h`, cls: 'border-amber-400/40 bg-amber-500/10 text-amber-300' };
  }
  return { text: `${Math.round(hrs / 24)}d`, cls: 'border-red-400/40 bg-red-500/10 text-red-300' };
}

// ── component ──────────────────────────────────────────────────────────────

export function OpenEnquiriesPanel({ rows }: { rows: OpenEnquiryRow[] }) {
  const [visible, setVisible] = useState<OpenEnquiryRow[]>(rows);
  const [loading, setLoading] = useState<Set<string>>(new Set());

  async function act(id: string, status: 'in_conversation' | 'lost') {
    setLoading((s) => new Set([...s, id]));
    try {
      const res = await fetch(`/api/leads/${id}/status`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(await res.text());
      setVisible((prev) => prev.filter((r) => r.id !== id));
      toast.success(status === 'in_conversation' ? 'Marked as contacted' : 'Archived');
    } catch {
      toast.error('Action failed — try again');
    } finally {
      setLoading((s) => { const n = new Set(s); n.delete(id); return n; });
    }
  }

  if (visible.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-8 text-center"
        style={{ borderColor: 'rgba(255,255,255,0.08)' }}
      >
        <p className="text-sm font-semibold text-white/60">All enquiries responded to</p>
        <p className="mt-1 text-xs text-white/35">No leads sitting at awaiting response.</p>
      </div>
    );
  }

  const overLimit = visible.length > 10;
  const shown = visible.slice(0, 10);

  return (
    <div className="space-y-1.5">
      {shown.map((row) => {
        const age = ageLabel(row.created_at);
        const busy = loading.has(row.id);
        const service = SERVICE_LABELS[row.service_type ?? ''] ?? (row.service_type ?? 'Enquiry');
        const glyph = SOURCE_GLYPH[row.source] ?? '·';

        return (
          <div
            key={row.id}
            className="flex items-center gap-3 rounded-xl border px-3 py-2.5"
            style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.018)' }}
          >
            {/* Source glyph */}
            <span className="flex-shrink-0 text-base" style={{ color: '#7CE0B0' }} aria-hidden>{glyph}</span>

            {/* Main info */}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-sm font-semibold text-white">{row.customer_name}</span>
                <span className="text-xs text-white/40">{service}</span>
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-[11px] text-white/40">
                <span className="capitalize">{row.source}</span>
                {row.customer_phone && <span>· {row.customer_phone}</span>}
                {row.customer_email && !row.customer_phone && <span>· {row.customer_email}</span>}
              </div>
            </div>

            {/* Age badge */}
            <span
              className={`flex-shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums ${age.cls}`}
            >
              {age.text}
            </span>

            {/* Actions */}
            <div className="flex flex-shrink-0 items-center gap-1.5">
              <button
                onClick={() => void act(row.id, 'in_conversation')}
                disabled={busy}
                className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-40"
              >
                Contacted
              </button>
              <button
                onClick={() => void act(row.id, 'lost')}
                disabled={busy}
                className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-semibold text-white/40 transition hover:bg-white/[0.07] disabled:opacity-40"
              >
                Archive
              </button>
              <Link
                href={`/services?lead_id=${row.id}`}
                target="_blank"
                className="rounded-lg border border-sky-400/25 bg-sky-500/[0.06] px-2.5 py-1 text-[11px] font-semibold text-sky-300 transition hover:bg-sky-500/15"
              >
                Quote →
              </Link>
            </div>
          </div>
        );
      })}

      {overLimit && (
        <p className="pt-1 text-center text-[11px] text-white/35">
          +{visible.length - 10} more ·{' '}
          <Link href="/dashboard/insights/leads" className="text-white/55 underline-offset-2 hover:underline">
            View all in Leads workspace
          </Link>
        </p>
      )}
    </div>
  );
}
