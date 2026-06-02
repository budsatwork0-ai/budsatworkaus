'use client';

import { useState } from 'react';
import { ALL_THEMES, type Theme } from '@/lib/design-system/themes';

/* ── small helpers ───────────────────────────────────────────────────────── */

function Spec({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-5" style={{ boxShadow: '0 8px 26px rgba(2,6,23,0.05)' }}>
      <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      {children}
    </div>
  );
}

function Swatch({ token, hex, usage, onCopy }: { token: string; hex: string; usage: string; onCopy: (t: string) => void }) {
  return (
    <button onClick={() => onCopy(token)} title={`Copy "${token}"`} className="group flex flex-col gap-1.5 text-left">
      <div className="h-10 w-full rounded-xl border border-black/8" style={{ background: hex }} />
      <p className="text-[10px] font-semibold text-slate-600 transition-colors group-hover:text-slate-900">{token}</p>
      <p className="font-mono text-[9px] text-slate-400">{hex.length > 22 ? hex.slice(0, 22) + '…' : hex}</p>
      <p className="text-[9px] leading-snug text-slate-400">{usage}</p>
    </button>
  );
}

/* ── main tab ────────────────────────────────────────────────────────────── */

export function DesignSystemTab() {
  const [activeContext, setActiveContext] = useState<0 | 1 | 2>(0);
  const [toast, setToast] = useState<string | null>(null);

  const t: Theme = ALL_THEMES[activeContext];

  function copy(token: string) {
    void navigator.clipboard.writeText(token);
    setToast(token);
    setTimeout(() => setToast(null), 1800);
  }

  return (
    <div className="space-y-8">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/40">
            Buds at Work · Design System
          </p>
          <h2 className="mt-0.5 text-xl font-semibold text-white">Context-Scoped Themes</h2>
          <p className="mt-1 text-[12px] text-white/45">
            Each context is independently editable. Click any swatch to copy its token path.
          </p>
        </div>
        {toast && (
          <span className="rounded-lg border border-emerald-700/40 bg-emerald-900/50 px-3 py-1.5 text-[11px] font-medium text-emerald-300">
            Copied: {toast}
          </span>
        )}
      </div>

      {/* ── Context switcher ────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-1.5">
        <div className="flex gap-1">
          {ALL_THEMES.map((theme, i) => {
            const active = activeContext === i;
            return (
              <button
                key={theme.context}
                onClick={() => setActiveContext(i as 0 | 1 | 2)}
                className="flex-1 rounded-xl px-3 py-2.5 text-[12px] font-semibold transition-all"
                style={active
                  ? { background: theme.color.primary, color: theme.color.onDark }
                  : { color: 'rgba(255,255,255,0.5)' }
                }
              >
                {theme.name}
                {active && (
                  <span className="ml-2 rounded-full px-1.5 py-0.5 text-[10px]"
                    style={{ background: 'rgba(255,255,255,0.15)' }}>
                    active
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Context description strip */}
        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 px-2 pb-1">
          <p className="text-[10px] text-white/35">
            Edit: <code className="text-white/55">src/lib/design-system/themes/{t.context}.ts</code>
          </p>
          <p className="text-[10px] text-white/35">
            Import: <code className="text-white/55">import {'{ '}
              {t.context === 'dashboard' ? 'dashboardTheme' : t.context === 'crew' ? 'crewTheme' : 'publicTheme'}
              {'}'} from &apos;@/lib/design-system/themes&apos;</code>
          </p>
        </div>
      </div>

      {/* ── Preview strip ───────────────────────────────────────────────── */}
      <Spec label={`${t.name} — page preview`}>
        <div className="overflow-hidden rounded-xl border border-black/5" style={{ background: t.pageBg }}>
          {/* Mini nav */}
          <div className="flex items-center gap-3 border-b px-4 py-2.5" style={{ background: t.nav.bg, borderColor: t.nav.border }}>
            <div className="h-5 w-5 rounded-md" style={{ background: t.color.primary }} />
            <div className="flex gap-3">
              {['Home', 'Jobs', 'Schedule'].map((item, i) => (
                <span key={item} className="text-[11px] font-medium rounded-md px-2 py-0.5"
                  style={i === 0
                    ? { color: t.nav.activeText, background: t.nav.activeBg, fontWeight: 600 }
                    : { color: t.nav.inactiveText }
                  }>
                  {item}
                </span>
              ))}
            </div>
          </div>
          {/* Mini content */}
          <div className="p-4 space-y-3">
            <p style={{ fontSize: t.type.sectionHeading.size, fontWeight: t.type.sectionHeading.weight, color: t.color.primary, lineHeight: t.type.sectionHeading.leading }}>
              {t.context === 'public' ? 'Book a local service' : t.context === 'crew' ? 'Your jobs today' : 'Operations overview'}
            </p>
            <div className="flex gap-2">
              <div className="rounded-xl border p-3 flex-1" style={{ background: t.color.card, borderColor: t.color.border, boxShadow: t.shadow.card }}>
                <p style={{ fontSize: t.type.meta.size, color: t.color.muted }}>Revenue MTD</p>
                <p style={{ fontSize: '22px', fontWeight: 700, color: t.color.primary }}>$4,820</p>
              </div>
              <div className="rounded-xl border p-3 flex-1" style={{ background: t.color.surface, borderColor: t.color.border }}>
                <p style={{ fontSize: t.type.meta.size, color: t.color.muted }}>Jobs</p>
                <p style={{ fontSize: '22px', fontWeight: 700, color: t.color.primary }}>24</p>
              </div>
            </div>
            <button className="rounded-full px-4 py-2 text-sm font-semibold text-white" style={{ background: t.color.accent }}>
              {t.context === 'public' ? 'Get a quote' : t.context === 'crew' ? 'Find jobs' : 'View schedule'}
            </button>
          </div>
        </div>
      </Spec>

      {/* ════════════════════════════════════════════════════════════════════
          TYPE
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="space-y-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">Type — {t.name}</h3>

        <Spec label="Display & headings">
          <div className="divide-y divide-black/5">
            {([
              { label: 'Page title',      step: t.type.pageTitle,      specimen: t.context === 'public' ? 'Book a local service' : t.context === 'crew' ? 'Crew Hub' : 'Dashboard' },
              { label: 'Section heading', step: t.type.sectionHeading, specimen: "Today's Schedule" },
              { label: 'Card title',      step: t.type.cardTitle,      specimen: 'Revenue this month' },
            ] as const).map((row) => (
              <div key={row.label} className="flex items-baseline justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div>
                  <p style={{ fontSize: row.step.size, fontWeight: row.step.weight, color: t.color.primary, lineHeight: row.step.leading }}>
                    {row.specimen}
                  </p>
                  <p className="mt-0.5 text-[10px]" style={{ color: t.color.muted }}>{row.label}</p>
                </div>
                <code className="shrink-0 text-[10px] text-slate-400">
                  {row.step.size} / {row.step.weight} / {row.step.leading}
                </code>
              </div>
            ))}
          </div>
        </Spec>

        <Spec label="Body & meta">
          <div className="divide-y divide-black/5">
            {([
              { label: 'Body', step: t.type.body, specimen: 'Standard clean · 3 bedrooms · 2 bathrooms', color: t.color.text },
              { label: 'Meta', step: t.type.meta, specimen: 'Last updated 2 hours ago · Order #1042',    color: t.color.muted },
            ] as const).map((row) => (
              <div key={row.label} className="flex items-baseline justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div>
                  <p style={{ fontSize: row.step.size, fontWeight: row.step.weight, color: row.color }}>{row.specimen}</p>
                  <p className="mt-0.5 text-[10px]" style={{ color: t.color.muted }}>{row.label}</p>
                </div>
                <code className="shrink-0 text-[10px] text-slate-400">
                  {row.step.size} / {row.step.weight}
                </code>
              </div>
            ))}
          </div>
        </Spec>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          COLORS
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="space-y-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">Colors — {t.name}</h3>

        <Spec label="Primary palette">
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
            {([
              { token: 'color.primary',    hex: t.color.primary,    usage: 'Headings, numbers' },
              { token: 'color.accent',     hex: t.color.accent,     usage: 'CTAs, active' },
              { token: 'color.accentSoft', hex: t.color.accentSoft, usage: 'Pill fills, hover' },
              { token: 'color.surface',    hex: t.color.surface,    usage: 'Tinted surface' },
              { token: 'color.surfaceAlt', hex: t.color.surfaceAlt, usage: 'Alt surface' },
              { token: 'color.bg',         hex: t.color.bg,         usage: 'Page bg' },
              { token: 'color.card',       hex: t.color.card,       usage: 'Card white' },
              { token: 'color.border',     hex: t.color.border,     usage: 'Borders' },
            ] as const).map((s) => (
              <Swatch key={s.token} token={s.token} hex={s.hex} usage={s.usage} onCopy={copy} />
            ))}
          </div>
        </Spec>

        <Spec label="Text & semantic">
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
            {([
              { token: 'color.text',          hex: t.color.text,          usage: 'Body text' },
              { token: 'color.muted',         hex: t.color.muted,         usage: 'Labels' },
              { token: 'color.focus',         hex: t.color.focus,         usage: 'Focus ring' },
              { token: 'color.success',       hex: t.color.success,       usage: 'Success' },
              { token: 'color.warning',       hex: t.color.warning,       usage: 'Warning' },
              { token: 'color.error',         hex: t.color.error,         usage: 'Error' },
              { token: 'color.secondary',     hex: t.color.secondary,     usage: 'Gold — sparingly' },
              { token: 'color.onDark',        hex: t.color.onDark,        usage: 'On dark bg' },
            ] as const).map((s) => (
              <Swatch key={s.token} token={s.token} hex={s.hex} usage={s.usage} onCopy={copy} />
            ))}
          </div>
        </Spec>

        {/* Side-by-side diff — all three contexts at once */}
        <Spec label="Primary colour — all three contexts compared">
          <div className="flex gap-3">
            {ALL_THEMES.map((theme) => (
              <div key={theme.context} className="flex flex-1 flex-col gap-1.5">
                <div className="h-10 rounded-xl border border-black/8" style={{ background: theme.color.primary }} />
                <div className="h-10 rounded-xl border border-black/8" style={{ background: theme.color.accent }} />
                <p className="text-[10px] font-semibold text-slate-600">{theme.name}</p>
                <p className="font-mono text-[9px] text-slate-400">{theme.color.primary}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[10px] text-slate-400">
            Currently identical across contexts — diverge them by editing each theme file independently.
          </p>
        </Spec>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          SPACING
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="space-y-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">Spacing — {t.name}</h3>

        <Spec label="Radii scale">
          <div className="flex flex-wrap items-end gap-6">
            {([
              { key: 'sm', usage: 'Chips, inputs' },
              { key: 'md', usage: 'Buttons, rows' },
              { key: 'lg', usage: 'Cards, panels' },
              { key: 'xl', usage: 'Feature panels' },
            ] as const).map((r) => (
              <button key={r.key} onClick={() => copy(`radius.${r.key}`)} className="group flex flex-col items-center gap-2">
                <div
                  className="border-2 transition-opacity group-hover:opacity-75"
                  style={{
                    width: 44 + parseInt(t.radius[r.key]) * 1.1,
                    height: 44 + parseInt(t.radius[r.key]) * 1.1,
                    borderRadius: t.radius[r.key],
                    background: t.color.accentSoft,
                    borderColor: t.color.accent,
                  }}
                />
                <p className="text-[10px] font-semibold text-slate-700">radius.{r.key}</p>
                <p className="font-mono text-[10px] text-slate-400">{t.radius[r.key]}</p>
                <p className="text-[9px] text-slate-400">{r.usage}</p>
              </button>
            ))}
          </div>
          {/* Radius diff across contexts */}
          <div className="mt-4 border-t border-black/5 pt-4">
            <p className="mb-2 text-[10px] text-slate-400">All contexts compared</p>
            <div className="overflow-x-auto">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="text-left text-slate-400">
                    <th className="pb-1.5 pr-4 font-semibold">Scale</th>
                    {ALL_THEMES.map((th) => <th key={th.context} className="pb-1.5 pr-4 font-semibold">{th.name}</th>)}
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {(['sm', 'md', 'lg', 'xl'] as const).map((key) => (
                    <tr key={key} className="border-t border-black/4">
                      <td className="py-1 pr-4 font-sans font-semibold text-slate-600">{key}</td>
                      {ALL_THEMES.map((th) => (
                        <td key={th.context} className={`py-1 pr-4 ${th.context === t.context ? 'text-slate-900 font-semibold' : 'text-slate-400'}`}>
                          {th.radius[key]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Spec>

        <Spec label="Shadows & elevation">
          <div className="flex flex-wrap gap-8">
            {(['card', 'hover', 'modal'] as const).map((key) => (
              <button key={key} onClick={() => copy(`shadow.${key}`)} className="group flex flex-col items-center gap-3">
                <div
                  className="h-16 w-28 rounded-2xl border border-black/5 bg-white transition-transform group-hover:scale-[1.03]"
                  style={{ boxShadow: t.shadow[key] }}
                />
                <p className="text-[10px] font-semibold text-slate-700">shadow.{key}</p>
              </button>
            ))}
          </div>
        </Spec>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          COMPONENTS
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="space-y-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">Components — {t.name}</h3>

        <Spec label="Buttons">
          <div className="flex flex-wrap items-end gap-6">
            {[
              { label: 'Primary CTA', node: (
                <button className="rounded-full px-5 py-2.5 text-sm font-semibold text-white" style={{ background: t.color.accent }}>
                  {t.context === 'public' ? 'Get a quote' : t.context === 'crew' ? 'Find jobs' : 'Book service'}
                </button>
              ), spec: 'rounded-full · color.accent bg' },
              { label: 'Secondary', node: (
                <button className="rounded-full border px-5 py-2.5 text-sm font-semibold" style={{ borderColor: t.color.border, color: t.color.text }}>
                  View details
                </button>
              ), spec: 'rounded-full · border · color.border' },
              { label: 'Ghost', node: (
                <button className="rounded-full px-5 py-2.5 text-sm font-semibold" style={{ color: t.color.muted }}>
                  Cancel
                </button>
              ), spec: 'rounded-full · transparent' },
              { label: 'Danger', node: (
                <button className="rounded-full px-5 py-2.5 text-sm font-semibold text-white" style={{ background: t.color.error }}>
                  Delete
                </button>
              ), spec: 'rounded-full · color.error bg' },
            ].map((b) => (
              <div key={b.label} className="flex flex-col items-center gap-2">
                {b.node}
                <code className="text-[9px] text-slate-400">{b.label}</code>
                <code className="text-[9px] text-slate-400">{b.spec}</code>
              </div>
            ))}
          </div>
          <p className="mt-3 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-[10px] text-amber-700">
            Rule: button bg = <strong>color.accent</strong>. Never use color.primary for button backgrounds — headings and numbers only.
          </p>
        </Spec>

        <Spec label="Cards">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <div className="border p-5" style={{ borderRadius: t.radius.lg, background: t.color.card, borderColor: t.color.border, boxShadow: t.shadow.card }}>
                <p className="text-sm font-semibold" style={{ color: t.color.primary }}>Revenue MTD</p>
                <p style={{ fontSize: t.type.meta.size, color: t.color.muted }}>Month to date</p>
                <p className="mt-2 text-2xl font-bold tracking-tight" style={{ color: t.color.primary }}>$4,820</p>
              </div>
              <code className="mt-1.5 block text-[9px] text-slate-400">Panel · radius.lg · shadow.card</code>
            </div>
            <div>
              <div className="border p-4" style={{ borderRadius: t.radius.lg, background: t.color.card, borderColor: t.color.border, boxShadow: t.shadow.card }}>
                <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: t.color.muted }}>Jobs this week</p>
                <p className="mt-1.5 text-3xl font-bold tracking-tight" style={{ color: t.color.primary }}>24</p>
              </div>
              <code className="mt-1.5 block text-[9px] text-slate-400">SummaryCard · radius.lg · shadow.card</code>
            </div>
            <div>
              <div className="flex items-center justify-between border px-3.5 py-2.5" style={{ borderRadius: t.radius.md, background: t.color.card, borderColor: t.color.border }}>
                <p className="text-sm" style={{ color: t.color.muted }}>Outstanding</p>
                <p className="text-sm font-semibold" style={{ color: t.color.primary }}>$1,240</p>
              </div>
              <code className="mt-1.5 block text-[9px] text-slate-400">StatRow · radius.md</code>
            </div>
          </div>
        </Spec>

        <Spec label="Chips & badges">
          <div className="flex flex-wrap items-end gap-5">
            {[
              { label: 'Scheduled',   bg: 'bg-sky-100',     text: 'text-sky-700'     },
              { label: 'In progress', bg: 'bg-amber-100',   text: 'text-amber-700'   },
              { label: 'Completed',   bg: 'bg-emerald-100', text: 'text-emerald-700' },
              { label: 'Cancelled',   bg: 'bg-red-100',     text: 'text-red-700'     },
            ].map((c) => (
              <div key={c.label} className="flex flex-col items-center gap-1.5">
                <span className={`px-3 py-1 text-[11px] font-semibold ${c.bg} ${c.text}`} style={{ borderRadius: t.radius.sm }}>
                  {c.label}
                </span>
                <code className="text-[9px] text-slate-400">radius.sm</code>
              </div>
            ))}
            <div className="flex flex-col items-center gap-1.5">
              <span className="inline-flex items-center gap-1.5 border px-3 py-1 text-[11px] font-semibold text-slate-700"
                style={{ borderRadius: t.radius.sm, borderColor: t.color.border, background: t.color.card }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: t.color.accent }} />
                Active
              </span>
              <code className="text-[9px] text-slate-400">HeaderChip</code>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <span className="px-3 py-1 text-[11px] font-semibold"
                style={{ borderRadius: t.radius.sm, background: t.color.accentSoft, color: t.color.accent }}>
                Accent pill
              </span>
              <code className="text-[9px] text-slate-400">color.accentSoft / accent</code>
            </div>
          </div>
        </Spec>

        <Spec label="Glass tokens">
          <div className="flex flex-wrap gap-5">
            {([
              { key: 'glass', value: t.glass, label: 'Full glass' },
              { key: 'glassSoft', value: t.glassSoft, label: 'Soft glass' },
            ] as const).map((g) => (
              <div key={g.key} className="flex flex-col gap-2">
                <div className="relative h-20 w-44 overflow-hidden rounded-2xl"
                  style={{ background: `linear-gradient(135deg, ${t.color.surface}, ${t.color.accentSoft})` }}>
                  <div className={`${g.value} absolute inset-0 flex items-center justify-center rounded-2xl`}>
                    <code className="text-[12px] font-semibold" style={{ color: t.color.primary }}>{g.key}</code>
                  </div>
                </div>
                <code className="text-[9px] text-slate-400">{g.label}</code>
              </div>
            ))}
          </div>
          <p className="mt-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-[10px] text-red-700">
            Always <code>className={'{t.glass}'}</code> — never <code>style={'{...t.glass}'}</code>. These are Tailwind class strings, not objects.
          </p>
        </Spec>
      </section>

      {/* ── File map ──────────────────────────────────────────────────── */}
      <Spec label="Where to edit each context">
        <div className="space-y-2">
          {ALL_THEMES.map((theme) => (
            <div key={theme.context} className="flex items-center gap-3 rounded-xl border px-4 py-3"
              style={{
                borderColor: theme.context === t.context ? t.color.accent : t.color.border,
                background: theme.context === t.context ? t.color.accentSoft : t.color.card,
              }}>
              <div className="h-3 w-3 rounded-full" style={{ background: theme.color.primary }} />
              <div>
                <p className="text-[12px] font-semibold" style={{ color: t.color.primary }}>{theme.name}</p>
                <code className="text-[10px] text-slate-500">src/lib/design-system/themes/{theme.context}.ts</code>
              </div>
              {theme.context === t.context && (
                <span className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold"
                  style={{ background: t.color.accent, color: '#fff' }}>
                  viewing
                </span>
              )}
            </div>
          ))}
        </div>
        <p className="mt-3 text-[10px] text-slate-400">
          Interface: <code>src/lib/design-system/themes/_theme.ts</code> — defines the shared shape all three contexts must implement.
        </p>
      </Spec>

      <div className="border-t border-white/[0.05] pt-4 text-[10px] text-white/30">
        Batch 1 complete — theme files created. Next: migrate crew imports (Batch 2), then dashboard (Batch 3), then public (Batch 4).
      </div>
    </div>
  );
}
