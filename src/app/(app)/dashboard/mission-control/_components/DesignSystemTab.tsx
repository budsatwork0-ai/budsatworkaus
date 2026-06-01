'use client';

import { useState } from 'react';
import { brand, core2, glass, glassSoft } from '@/app/ui/theme';

/* ── helpers ──────────────────────────────────────────────────────────────── */

function Spec({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-5" style={{ boxShadow: core2.shadow.card }}>
      <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">{children}</h3>
  );
}

/* ── main component ───────────────────────────────────────────────────────── */

export function DesignSystemTab() {
  const [toast, setToast] = useState<string | null>(null);

  function copy(token: string) {
    void navigator.clipboard.writeText(token);
    setToast(token);
    setTimeout(() => setToast(null), 1800);
  }

  return (
    <div className="space-y-8">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/40">
            Buds at Work · Core 2.0
          </p>
          <h2 className="mt-0.5 text-xl font-semibold text-white">Design System</h2>
          <p className="mt-1 text-[12px] text-white/45">
            Click any token to copy its name. Three contexts: Admin dashboard · Crew portal · Public site.
          </p>
        </div>
        {toast && (
          <span className="rounded-lg border border-emerald-700/40 bg-emerald-900/50 px-3 py-1.5 text-[11px] font-medium text-emerald-300">
            Copied: {toast}
          </span>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          TYPE
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="space-y-3">
        <SectionLabel>Type</SectionLabel>

        {/* Display & headings */}
        <Spec label="Type — Display & headings">
          <div className="divide-y divide-black/5">
            {[
              { label: 'Page title', specimen: 'Dashboard', size: core2.type.pageTitle.size, weight: core2.type.pageTitle.weight, spec: '30px / 600 / tracking-[-0.03em]' },
              { label: 'Section heading', specimen: "Today's Schedule", size: core2.type.sectionHeading.size, weight: core2.type.sectionHeading.weight, spec: '20px / 600 / tracking-[-0.02em]' },
              { label: 'Card title', specimen: 'Revenue this month', size: core2.type.cardTitle.size, weight: core2.type.cardTitle.weight, spec: '16px / 600' },
            ].map((row) => (
              <div key={row.label} className="flex items-baseline justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div>
                  <p
                    style={{ fontSize: row.size, fontWeight: row.weight, color: brand.primary, letterSpacing: '-0.02em' }}
                  >
                    {row.specimen}
                  </p>
                  <p className="mt-0.5 text-[10px]" style={{ color: brand.muted }}>{row.label}</p>
                </div>
                <code className="shrink-0 text-[10px] text-slate-400">{row.spec}</code>
              </div>
            ))}
          </div>
        </Spec>

        {/* Body & meta */}
        <Spec label="Type — Body & meta">
          <div className="divide-y divide-black/5">
            {[
              { label: 'Body', specimen: 'Standard clean · 3 bedrooms · 2 bathrooms', size: core2.type.body.size, weight: core2.type.body.weight, color: brand.text, spec: '15px / 400 / leading-[1.55]' },
              { label: 'Meta', specimen: 'Last updated 2 hours ago · Order #1042', size: core2.type.meta.size, weight: core2.type.meta.weight, color: brand.muted, spec: '12.5px / 400 / leading-[1.5]' },
              { label: 'KPI number', specimen: '$4,820', size: '30px', weight: 700, color: brand.primary, spec: 'text-3xl / 700 / tracking-tight' },
              { label: 'Table value', specimen: 'Completed', size: '14px', weight: 600, color: brand.text, spec: '14px / 600' },
            ].map((row) => (
              <div key={row.label} className="flex items-baseline justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div>
                  <p style={{ fontSize: row.size, fontWeight: row.weight, color: row.color }}>{row.specimen}</p>
                  <p className="mt-0.5 text-[10px]" style={{ color: brand.muted }}>{row.label}</p>
                </div>
                <code className="shrink-0 text-[10px] text-slate-400">{row.spec}</code>
              </div>
            ))}
          </div>
        </Spec>

        {/* Eyebrow & trust row */}
        <Spec label="Type — Eyebrow & trust row">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p
                  className="font-semibold uppercase"
                  style={{ fontSize: '10px', letterSpacing: '0.22em', color: brand.muted }}
                >
                  Buds · Active · Logan & South Brisbane
                </p>
                <p className="mt-1 text-[10px]" style={{ color: brand.muted }}>Eyebrow label — context above major sections</p>
              </div>
              <code className="shrink-0 text-[10px] text-slate-400">10px / 600 / tracking-[0.22em] / uppercase</code>
            </div>
            <div className="border-t border-black/5 pt-4">
              <div className="flex flex-wrap items-center gap-5">
                {['Certified', 'Fully insured', 'Local crew', 'Verified'].map((t) => (
                  <div key={t} className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: brand.accent }} />
                    <span className="text-[11px] font-semibold" style={{ color: brand.muted }}>{t}</span>
                  </div>
                ))}
              </div>
              <code className="mt-2 block text-[10px] text-slate-400">Trust row · 11px / 600 · dot = brand.accent · brand.muted text</code>
            </div>
          </div>
        </Spec>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          COLORS
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="space-y-3">
        <SectionLabel>Colors</SectionLabel>

        <Spec label="Colors — Primary palette">
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
            {[
              { token: 'brand.primary', hex: brand.primary, usage: 'Headings, numbers, nav' },
              { token: 'brand.accent', hex: brand.accent, usage: 'CTAs, active states' },
              { token: 'brand.accentSoft', hex: brand.accentSoft, usage: 'Pill fills, hovers' },
              { token: 'brand.surface', hex: brand.surface, usage: 'Tinted surface' },
              { token: 'brand.surfaceAlt', hex: brand.surfaceAlt, usage: 'Alt tinted' },
              { token: 'brand.bg', hex: brand.bg, usage: 'Page background' },
              { token: 'brand.card', hex: brand.card, usage: 'Card white' },
              { token: 'brand.border', hex: brand.border, usage: 'Borders' },
            ].map((s) => (
              <button
                key={s.token}
                onClick={() => copy(s.token)}
                title={`Copy "${s.token}"`}
                className="group flex flex-col gap-1.5 text-left"
              >
                <div
                  className="h-10 w-full rounded-xl border border-black/8"
                  style={{ background: s.hex }}
                />
                <p className="text-[10px] font-semibold text-slate-600 group-hover:text-slate-900 transition-colors">{s.token}</p>
                <p className="font-mono text-[9px] text-slate-400">{s.hex}</p>
                <p className="text-[9px] text-slate-400 leading-snug">{s.usage}</p>
              </button>
            ))}
          </div>
        </Spec>

        <Spec label="Colors — Text & semantic">
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
            {[
              { token: 'brand.text', hex: brand.text, usage: 'Body text' },
              { token: 'brand.muted', hex: brand.muted, usage: 'Labels, secondary' },
              { token: 'brand.focus', hex: brand.focus, usage: 'Focus ring' },
              { token: 'core2.color.success', hex: core2.color.success, usage: 'Success' },
              { token: 'core2.color.warning', hex: core2.color.warning, usage: 'Warning' },
              { token: 'core2.color.error', hex: core2.color.error, usage: 'Errors' },
              { token: 'core2.color.info', hex: core2.color.info, usage: 'Info / neutral' },
              { token: 'core2.color.secondary', hex: core2.color.secondary, usage: 'Gold — sparingly' },
            ].map((s) => (
              <button
                key={s.token}
                onClick={() => copy(s.token)}
                title={`Copy "${s.token}"`}
                className="group flex flex-col gap-1.5 text-left"
              >
                <div
                  className="h-10 w-full rounded-xl border border-black/8"
                  style={{ background: s.hex }}
                />
                <p className="text-[10px] font-semibold text-slate-600 group-hover:text-slate-900 transition-colors">{s.token}</p>
                <p className="font-mono text-[9px] text-slate-400">{s.hex}</p>
                <p className="text-[9px] text-slate-400 leading-snug">{s.usage}</p>
              </button>
            ))}
          </div>
        </Spec>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          SPACING
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="space-y-3">
        <SectionLabel>Spacing</SectionLabel>

        <Spec label="Radii scale">
          <div className="flex flex-wrap items-end gap-6">
            {([
              { key: 'sm', px: 10, usage: 'Chips, inputs, tags' },
              { key: 'md', px: 14, usage: 'Buttons, rows' },
              { key: 'lg', px: 20, usage: 'Cards, panels' },
              { key: 'xl', px: 26, usage: 'Feature panels, hero cards' },
            ] as const).map((r) => (
              <button
                key={r.key}
                onClick={() => copy(`core2.radius.${r.key}`)}
                className="group flex flex-col items-center gap-2"
              >
                <div
                  className="border-2 transition-opacity group-hover:opacity-80"
                  style={{
                    width: 44 + r.px * 1.2,
                    height: 44 + r.px * 1.2,
                    borderRadius: r.px,
                    background: brand.accentSoft,
                    borderColor: brand.accent,
                  }}
                />
                <p className="text-[10px] font-semibold text-slate-700">core2.radius.{r.key}</p>
                <p className="font-mono text-[10px] text-slate-400">{r.px}px</p>
                <p className="text-[9px] text-slate-400">{r.usage}</p>
              </button>
            ))}
          </div>
        </Spec>

        <Spec label="Shadows & elevation">
          <div className="flex flex-wrap items-end gap-8">
            {([
              { key: 'card', usage: 'Default card', bg: '#fafafa' },
              { key: 'hover', usage: 'Hover / lifted', bg: '#fff' },
              { key: 'modal', usage: 'Modals, drawers', bg: '#fff' },
            ] as const).map((s) => (
              <button
                key={s.key}
                onClick={() => copy(`core2.shadow.${s.key}`)}
                className="group flex flex-col items-center gap-3"
              >
                <div
                  className="h-16 w-28 rounded-2xl border border-black/5 transition-transform group-hover:scale-[1.03]"
                  style={{ background: s.bg, boxShadow: core2.shadow[s.key] }}
                />
                <p className="text-[10px] font-semibold text-slate-700">core2.shadow.{s.key}</p>
                <p className="text-[9px] text-slate-400">{s.usage}</p>
              </button>
            ))}
          </div>
        </Spec>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          COMPONENTS
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="space-y-3">
        <SectionLabel>Components</SectionLabel>

        {/* Buttons */}
        <Spec label="Buttons">
          <div className="flex flex-wrap items-end gap-6">
            <div className="flex flex-col items-center gap-2">
              <button
                className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: brand.accent }}
              >
                Book a service
              </button>
              <code className="text-[9px] text-slate-400">Primary CTA</code>
              <code className="text-[9px] text-slate-400">brand.accent bg / white</code>
            </div>
            <div className="flex flex-col items-center gap-2">
              <button className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                View details
              </button>
              <code className="text-[9px] text-slate-400">Secondary</code>
              <code className="text-[9px] text-slate-400">white + border-slate-200</code>
            </div>
            <div className="flex flex-col items-center gap-2">
              <button className="rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-50">
                Cancel
              </button>
              <code className="text-[9px] text-slate-400">Ghost</code>
              <code className="text-[9px] text-slate-400">transparent bg</code>
            </div>
            <div className="flex flex-col items-center gap-2">
              <button className="rounded-xl bg-red-500 px-5 py-2.5 text-sm font-semibold text-white">
                Delete
              </button>
              <code className="text-[9px] text-slate-400">Danger</code>
              <code className="text-[9px] text-slate-400">bg-red-500 / white</code>
            </div>
            <div className="flex flex-col items-center gap-2">
              <button className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm">
                <svg className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              <code className="text-[9px] text-slate-400">Icon button</code>
              <code className="text-[9px] text-slate-400">h-9 w-9 · rounded-xl</code>
            </div>
          </div>
          <p className="mt-4 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-[10px] text-amber-700">
            Rule: button bg = <strong>brand.accent</strong> (#1C7C54). Never use brand.primary for button backgrounds — that is for headings and numbers only.
          </p>
        </Spec>

        {/* Cards */}
        <Spec label="Cards">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* Panel */}
            <div>
              <div className="rounded-[22px] border border-black/5 bg-white px-5 py-5" style={{ boxShadow: core2.shadow.card }}>
                <p className="text-sm font-semibold" style={{ color: brand.primary }}>Revenue MTD</p>
                <p className="text-[12px]" style={{ color: brand.muted }}>Month to date</p>
                <p className="mt-2 text-2xl font-bold tracking-tight" style={{ color: brand.primary }}>$4,820</p>
              </div>
              <code className="mt-1.5 block text-[9px] text-slate-400">Panel: rounded-[22px] border border-black/5 bg-white px-5 py-5</code>
            </div>
            {/* SummaryCard */}
            <div>
              <div className="rounded-[22px] border border-black/5 bg-white px-4 py-4" style={{ boxShadow: core2.shadow.card }}>
                <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: brand.muted }}>Jobs this week</p>
                <p className="mt-1.5 text-3xl font-bold tracking-tight" style={{ color: brand.primary }}>24</p>
                <p className="mt-0.5 text-[11px]" style={{ color: brand.muted }}>+3 from last week</p>
              </div>
              <code className="mt-1.5 block text-[9px] text-slate-400">SummaryCard: rounded-[22px] border border-black/5 bg-white px-4 py-4</code>
            </div>
            {/* StatRow */}
            <div>
              <div className="rounded-xl border border-black/5 bg-white px-3.5 py-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-sm" style={{ color: brand.muted }}>Outstanding</p>
                  <p className="text-sm font-semibold" style={{ color: brand.primary }}>$1,240</p>
                </div>
              </div>
              <code className="mt-1.5 block text-[9px] text-slate-400">StatRow: rounded-xl border border-black/5 bg-white px-3.5 py-2.5</code>
            </div>
          </div>
        </Spec>

        {/* Chips & badges */}
        <Spec label="Chips & badges">
          <div className="flex flex-wrap items-end gap-5">
            {[
              { label: 'Scheduled', bg: 'bg-sky-100', text: 'text-sky-700', spec: 'sky-100 / sky-700' },
              { label: 'In progress', bg: 'bg-amber-100', text: 'text-amber-700', spec: 'amber-100 / amber-700' },
              { label: 'Completed', bg: 'bg-emerald-100', text: 'text-emerald-700', spec: 'emerald-100 / emerald-700' },
              { label: 'Cancelled', bg: 'bg-red-100', text: 'text-red-700', spec: 'red-100 / red-700' },
            ].map((c) => (
              <div key={c.label} className="flex flex-col items-center gap-1.5">
                <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${c.bg} ${c.text}`}>
                  {c.label}
                </span>
                <code className="text-[9px] text-slate-400">{c.spec}</code>
              </div>
            ))}
            <div className="flex flex-col items-center gap-1.5">
              <span className="inline-flex items-center gap-2 rounded-full border border-black/5 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm">
                <span className="h-2 w-2 rounded-full" style={{ background: brand.accent }} />
                Active
              </span>
              <code className="text-[9px] text-slate-400">HeaderChip</code>
              <code className="text-[9px] text-slate-400">white + border + dot</code>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <span
                className="rounded-full px-3 py-1 text-[11px] font-semibold"
                style={{ background: brand.accentSoft, color: brand.accent }}
              >
                Active
              </span>
              <code className="text-[9px] text-slate-400">Accent pill</code>
              <code className="text-[9px] text-slate-400">brand.accentSoft / brand.accent</code>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <span
                className="rounded-full px-3 py-1 text-[11px] font-semibold"
                style={{ background: core2.color.secondarySoft, color: core2.color.secondary }}
              >
                Gold badge
              </span>
              <code className="text-[9px] text-slate-400">Gold pill — sparingly</code>
              <code className="text-[9px] text-slate-400">secondarySoft / secondary</code>
            </div>
          </div>
          <p className="mt-3 text-[10px] text-slate-400">
            All chips: <code>rounded-full px-3 py-1 text-[11px] font-semibold</code> · StatusChip pulls colours from <code>statusStyles</code> in <code>@/types/dashboard</code>.
          </p>
        </Spec>

        {/* Form inputs */}
        <Spec label="Form inputs">
          <div className="max-w-xs space-y-4">
            <div>
              <label className="mb-1.5 block text-[13px] font-semibold" style={{ color: brand.text }}>
                Property address
              </label>
              <input
                readOnly
                value="123 Example St, Brisbane"
                className="w-full rounded-[10px] border px-3 py-2.5 text-sm outline-none focus:ring-2"
                style={{ borderColor: brand.border, color: brand.text, background: brand.card }}
              />
              <p className="mt-1 text-[10px] text-slate-400">Label: 13px / 600 · Input: rounded-[10px] border brand.border</p>
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-semibold" style={{ color: brand.text }}>
                Service type
              </label>
              <select
                className="w-full rounded-[10px] border px-3 py-2.5 text-sm"
                style={{ borderColor: brand.border, color: brand.text, background: brand.card }}
              >
                <option>Standard clean</option>
                <option>Deep clean</option>
              </select>
            </div>
            <div className="flex items-center gap-2.5">
              <input type="checkbox" id="ds-chk" className="h-4 w-4 rounded" />
              <label htmlFor="ds-chk" className="text-sm" style={{ color: brand.text }}>
                Include window clean
              </label>
            </div>
            <div className="rounded-[10px] border px-3 py-2.5 text-sm" style={{ borderColor: brand.focus, color: brand.text, outline: `2px solid ${brand.focus}`, outlineOffset: '2px' }}>
              Focus state preview
              <p className="text-[10px]" style={{ color: brand.muted }}>outline: brand.focus · outlineOffset: 2px</p>
            </div>
          </div>
        </Spec>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          BRAND
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="space-y-3">
        <SectionLabel>Brand</SectionLabel>

        {/* Avatars */}
        <Spec label="Avatars">
          <div className="flex flex-wrap items-end gap-6">
            {[
              { initials: 'JT', cls: 'h-8 w-8 text-[10px]', label: 'sm · h-8 w-8' },
              { initials: 'JT', cls: 'h-10 w-10 text-[11px]', label: 'md · h-10 w-10' },
              { initials: 'JT', cls: 'h-14 w-14 text-[14px]', label: 'lg · h-14 w-14' },
            ].map((av) => (
              <div key={av.label} className="flex flex-col items-center gap-2">
                <div
                  className={`${av.cls} flex items-center justify-center rounded-full font-semibold`}
                  style={{ background: brand.accentSoft, color: brand.accent }}
                >
                  {av.initials}
                </div>
                <code className="text-[9px] text-slate-400">{av.label}</code>
                <code className="text-[9px] text-slate-400">accentSoft / accent</code>
              </div>
            ))}
            <div className="flex flex-col items-center gap-2">
              <div className="flex -space-x-2.5">
                {['BT', 'AM', 'KL', '+3'].map((i) => (
                  <div
                    key={i}
                    className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white text-[10px] font-semibold"
                    style={{ background: brand.accentSoft, color: brand.accent }}
                  >
                    {i}
                  </div>
                ))}
              </div>
              <code className="text-[9px] text-slate-400">Stacked row</code>
              <code className="text-[9px] text-slate-400">-space-x-2.5 · border-2 border-white</code>
            </div>
          </div>
        </Spec>

        {/* Icons */}
        <Spec label="Icons">
          <div className="grid grid-cols-4 gap-4 sm:grid-cols-8">
            {[
              { label: 'Refresh', path: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' },
              { label: 'Arrow up', path: 'M5 10l7-7m0 0l7 7m-7-7v18' },
              { label: 'Arrow dn', path: 'M19 14l-7 7m0 0l-7-7m7 7V3' },
              { label: 'Check', path: 'M5 13l4 4L19 7' },
              { label: 'Close', path: 'M6 18L18 6M6 6l12 12' },
              { label: 'Plus', path: 'M12 4v16m8-8H4' },
              { label: 'Calendar', path: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
              { label: 'User', path: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
            ].map((ic) => (
              <div key={ic.label} className="flex flex-col items-center gap-1.5">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-black/5 bg-white"
                  style={{ boxShadow: core2.shadow.card }}
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke={brand.accent}
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    viewBox="0 0 24 24"
                  >
                    <path d={ic.path} />
                  </svg>
                </div>
                <p className="text-[10px] text-slate-500">{ic.label}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[10px] text-slate-400">
            All icons: strokeWidth 1.8 · stroke=brand.accent · strokeLinecap=&quot;round&quot; · 18–24px.
            Labels are required — icons never replace text.
          </p>
        </Spec>

        {/* Logo — Wordmark */}
        <Spec label="Logo — Wordmark">
          <div className="flex flex-wrap items-start gap-6">
            {/* On white */}
            <div className="flex flex-col items-center gap-2">
              <div className="flex h-20 w-44 items-center justify-center rounded-2xl border border-black/5 bg-white" style={{ boxShadow: core2.shadow.card }}>
                <div className="flex flex-col items-center leading-tight">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: brand.muted }}>Buds</span>
                  <span className="text-xl font-bold tracking-tight" style={{ color: brand.primary }}>at Work</span>
                </div>
              </div>
              <code className="text-[9px] text-slate-400">On white</code>
            </div>
            {/* On surface */}
            <div className="flex flex-col items-center gap-2">
              <div className="flex h-20 w-44 items-center justify-center rounded-2xl" style={{ background: brand.surface }}>
                <div className="flex flex-col items-center leading-tight">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: brand.muted }}>Buds</span>
                  <span className="text-xl font-bold tracking-tight" style={{ color: brand.primary }}>at Work</span>
                </div>
              </div>
              <code className="text-[9px] text-slate-400">On brand.surface</code>
            </div>
            {/* On primary / reversed */}
            <div className="flex flex-col items-center gap-2">
              <div className="flex h-20 w-44 items-center justify-center rounded-2xl" style={{ background: brand.primary }}>
                <div className="flex flex-col items-center leading-tight">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/55">Buds</span>
                  <span className="text-xl font-bold tracking-tight text-white">at Work</span>
                </div>
              </div>
              <code className="text-[9px] text-slate-400">On brand.primary (reversed)</code>
            </div>
          </div>
        </Spec>

        {/* Glass tokens */}
        <Spec label="Glass tokens">
          <div className="flex flex-wrap gap-5">
            <div className="flex flex-col gap-2">
              <div
                className="relative h-20 w-44 overflow-hidden rounded-2xl"
                style={{ background: `linear-gradient(135deg, ${brand.surface}, ${brand.accentSoft})` }}
              >
                <div className={`${glass} absolute inset-0 flex items-center justify-center rounded-2xl`}>
                  <code className="text-[12px] font-semibold" style={{ color: brand.primary }}>glass</code>
                </div>
              </div>
              <code className="text-[9px] text-slate-400">bg-white/80 backdrop-blur-2xl</code>
              <code className="text-[9px] text-slate-400">border border-black/10 shadow-lg</code>
            </div>
            <div className="flex flex-col gap-2">
              <div
                className="relative h-20 w-44 overflow-hidden rounded-2xl"
                style={{ background: `linear-gradient(135deg, ${brand.surface}, ${brand.accentSoft})` }}
              >
                <div className={`${glassSoft} absolute inset-0 flex items-center justify-center rounded-2xl`}>
                  <code className="text-[12px] font-semibold" style={{ color: brand.primary }}>glassSoft</code>
                </div>
              </div>
              <code className="text-[9px] text-slate-400">bg-white/70 backdrop-blur-2xl</code>
              <code className="text-[9px] text-slate-400">border border-black/10 shadow-md</code>
            </div>
          </div>
          <p className="mt-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-[10px] text-red-700">
            Anti-pattern: <code>glass</code> and <code>glassSoft</code> are <strong>strings</strong> — always{' '}
            <code>className={'{glass}'}</code>. Never <code>style={'{...glass}'}</code> or <code>{'{...glass}'}</code>.
          </p>
        </Spec>
      </section>

      {/* Footer */}
      <div className="border-t border-white/[0.05] pt-4 text-[10px] text-white/30">
        Core 2.0 · src/app/ui/theme.ts · All tokens live in brand.* and core2.* · Click any swatch to copy its token name
      </div>
    </div>
  );
}
