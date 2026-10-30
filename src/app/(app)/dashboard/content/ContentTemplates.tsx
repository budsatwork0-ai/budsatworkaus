'use client';

import { useMemo, useState } from 'react';

export type SavedPost = { id: string; service: string; suburb: string | null; caption: string; cta: string | null; photo_tip: string | null; created_at: string };

const SERVICES = ['Lawn mowing', 'Garden tidy-up', 'Hedge trimming', 'Rubbish removal', 'Pressure washing', 'Gutter cleaning', 'Weeding', 'Mulching'];

type Tpl = { caption: string; cta: string; photo_tip: string };

function templates(service: string, suburb: string): Tpl[] {
  const s = service.toLowerCase();
  const where = suburb.trim() ? ` in ${suburb.trim()}` : '';
  const area = suburb.trim() || 'your area';
  return [
    {
      caption: `Another ${s} job done${where} 🌿 Before and after — swipe to see the difference. Our crew takes pride in every yard.`,
      cta: `Book your ${s} today — message us or get a quote at budsatwork.com.au`,
      photo_tip: 'Stand in the same spot for both photos. Same angle, same time of day, landscape mode.',
    },
    {
      caption: `Locals${where}: is your yard ready for the weekend? We've got spots open this week for ${s}.`,
      cta: `Limited spots in ${area} — send us a message to lock one in.`,
      photo_tip: 'Take the before photo wide so the whole mess shows. Take the after from the same place.',
    },
    {
      caption: `Meet the crew behind the ${s}${where} 👋 Every job helps our team build skills and confidence.`,
      cta: 'Support local and get your yard sorted — link in bio for a free quote.',
      photo_tip: 'Get one photo of the crew working (with their OK), plus the finished result.',
    },
    {
      caption: `Big transformation${where} this week! From overgrown to tidy with our ${s} service. Happy customer, happy crew.`,
      cta: 'Want the same for your place? Comment "QUOTE" or message us.',
      photo_tip: 'Shoot the worst corner first. Hold the phone at chest height for both shots.',
    },
  ];
}

function fullText(t: { caption: string; cta: string | null }) {
  return [t.caption, t.cta].filter(Boolean).join('\n\n');
}

export function ContentTemplates({ initialPosts }: { initialPosts: SavedPost[] }) {
  const [service, setService] = useState(SERVICES[0]);
  const [suburb, setSuburb] = useState('');
  const [posts, setPosts] = useState(initialPosts);
  const [copied, setCopied] = useState<string | null>(null);
  const [saving, setSaving] = useState<number | null>(null);
  const list = useMemo(() => templates(service, suburb), [service, suburb]);

  async function copy(key: string, text: string) {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 1500); } catch { /* ignore */ }
  }

  async function save(i: number, t: Tpl) {
    setSaving(i);
    try {
      const res = await fetch('/api/content-posts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ service, suburb, ...t }) });
      const j = await res.json();
      if (res.ok && j.post) setPosts((p) => [j.post, ...p]);
    } finally { setSaving(null); }
  }

  async function hide(id: string) {
    if (!confirm('Remove this saved post from the list?')) return;
    const res = await fetch('/api/content-posts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    if (res.ok) setPosts((p) => p.filter((x) => x.id !== id));
  }

  const btn = 'rounded-full px-4 py-2 text-sm font-semibold min-h-[40px]';

  return (
    <>
      <div className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm">
        <label className="text-sm font-semibold text-[#0F3F33]">Service
          <select value={service} onChange={(e) => setService(e.target.value)} className="mt-1 w-full rounded-xl border border-[#0F3F33]/20 px-3 py-2 text-base">
            {SERVICES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold text-[#0F3F33]">Suburb
          <input value={suburb} onChange={(e) => setSuburb(e.target.value)} placeholder="e.g. Ipswich" className="mt-1 w-full rounded-xl border border-[#0F3F33]/20 px-3 py-2 text-base" />
        </label>
      </div>

      {list.map((t, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-sm">
          <p className="whitespace-pre-line text-[15px] text-[#0F3F33]">{t.caption}</p>
          <p className="text-sm font-semibold text-[#0F3F33]">👉 {t.cta}</p>
          <p className="rounded-xl bg-[#F5B83D]/15 p-2 text-sm text-[#0F3F33]">📸 {t.photo_tip}</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => copy(`t${i}`, fullText(t))} className={`${btn} bg-[#0F3F33] text-white`}>{copied === `t${i}` ? 'Copied ✓' : 'Copy'}</button>
            <button onClick={() => save(i, t)} disabled={saving === i} className={`${btn} bg-[#F5B83D] text-[#0F3F33]`}>{saving === i ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      ))}

      <h2 className="mt-2 text-lg font-bold text-[#0F3F33]">Saved posts</h2>
      {posts.length === 0 && <p className="text-sm text-[#0F3F33]/60">Nothing saved yet.</p>}
      {posts.map((p) => (
        <div key={p.id} className="flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-xs text-[#0F3F33]/60">{p.service}{p.suburb ? ` · ${p.suburb}` : ''} · {new Date(p.created_at).toLocaleDateString('en-AU')}</p>
          <p className="whitespace-pre-line text-[15px] text-[#0F3F33]">{fullText(p)}</p>
          <div className="flex gap-2">
            <button onClick={() => copy(p.id, fullText(p))} className={`${btn} bg-[#0F3F33] text-white`}>{copied === p.id ? 'Copied ✓' : 'Copy'}</button>
            <button onClick={() => hide(p.id)} className={`${btn} border border-[#0F3F33]/20 text-[#0F3F33]`}>Remove</button>
          </div>
        </div>
      ))}
    </>
  );
}
