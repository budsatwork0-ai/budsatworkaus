'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { dashboardTheme } from '@/lib/design-system/themes';
import type { DesignAudit, DesignViolation, TokenOverrides } from './_types';

// ── Brand token defaults (mirrors src/app/ui/theme.ts) ───────────────────────

const BRAND_DEFAULTS: Record<string, string> = {
  bg:         '#F6FBF7',
  card:       '#FFFFFF',
  border:     '#D7E7DD',
  primary:    '#0F3D2E',
  accent:     '#1C7C54',
  accentSoft: '#DDF3E4',
  surface:    '#F1F7F3',
  surfaceAlt: '#EAF6EE',
  text:       '#12261E',
  muted:      '#4C6157',
  focus:      '#8BC8A8',
};

const GLASS_DEFAULT     = 'bg-white/80 backdrop-blur-2xl border border-black/10 shadow-[0_10px_30px_rgba(2,6,23,0.08)]';
const GLASS_SOFT_DEFAULT = 'bg-white/70 backdrop-blur-2xl border border-black/10 shadow-[0_6px_20px_rgba(2,6,23,0.06)]';

const BRAND_LABELS: Record<string, string> = {
  bg: 'Page background', card: 'Card surface', border: 'Default border',
  primary: 'Primary (deep green)', accent: 'Accent (action green)', accentSoft: 'Accent soft fill',
  surface: 'Surface (tinted)', surfaceAlt: 'Surface alt', text: 'Body text',
  muted: 'Muted / secondary text', focus: 'Focus ring',
};

// ── Area display config ───────────────────────────────────────────────────────

const AREA_LABELS: Record<string, string> = {
  'glass-consistency':       'Glass consistency',
  'typography-hierarchy':    'Typography',
  'color-literals':          'Color tokens',
  'component-duplication':   'Component reuse',
  'spacing-consistency':     'Spacing',
  'cta-interactive-patterns':'CTAs',
  'sticky-footer':           'Sticky footer',
  'apple-simplicity':        'Simplicity',
};

const AREA_ORDER = Object.keys(AREA_LABELS);

function scoreColor(s: number) {
  if (s >= 85) return { text: dashboardTheme.color.success, bg: '#ECFDF5' };
  if (s >= 70) return { text: '#B8860B', bg: '#FFFBEB' };
  if (s >= 50) return { text: '#C2570A', bg: '#FFF7ED' };
  return { text: dashboardTheme.color.error, bg: '#FEF2F2' };
}

function priorityColor(p: string) {
  if (p === 'P0') return { text: '#B91C1C', bg: '#FEE2E2' };
  if (p === 'P1') return { text: '#C2570A', bg: '#FFF7ED' };
  if (p === 'P2') return { text: '#B8860B', bg: '#FFFBEB' };
  return { text: dashboardTheme.color.muted, bg: dashboardTheme.color.surface };
}

function statusLabel(s: string) {
  return { open: 'Open', in_progress: 'In progress', resolved: 'Resolved', wont_fix: "Won't fix", accepted: 'Accepted' }[s] ?? s;
}

function statusStyle(s: string): React.CSSProperties {
  if (s === 'open') return { background: '#FEE2E2', color: '#B91C1C' };
  if (s === 'in_progress') return { background: '#DBEAFE', color: '#1D4ED8' };
  if (s === 'resolved') return { background: '#ECFDF5', color: '#065F46' };
  if (s === 'wont_fix') return { background: '#F1F5F9', color: dashboardTheme.color.muted };
  return { background: dashboardTheme.color.surface, color: dashboardTheme.color.muted };
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Props = {
  audits: DesignAudit[];
  violations: DesignViolation[];
  tokenOverrides: TokenOverrides | null;
};

type Tab = 'overview' | 'violations' | 'tokens';

// ── Violation side panel ──────────────────────────────────────────────────────

function ViolationPanel({
  violation,
  onClose,
  onStatusChange,
}: {
  violation: DesignViolation;
  onClose: () => void;
  onStatusChange: (id: string, status: string, note: string) => void;
}) {
  const [note, setNote] = useState(violation.resolution_note ?? '');
  const [saving, setSaving] = useState(false);

  const apply = useCallback(async (status: string) => {
    setSaving(true);
    try {
      await fetch(`/api/design/violations/${violation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, resolution_note: note }),
      });
      onStatusChange(violation.id, status, note);
      onClose();
    } finally {
      setSaving(false);
    }
  }, [violation.id, note, onStatusChange, onClose]);

  const pc = priorityColor(violation.priority);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]"
        onClick={onClose}
      />
      {/* Panel */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 340, damping: 36 }}
        className="fixed inset-y-0 right-0 z-50 flex w-[460px] flex-col overflow-y-auto bg-white shadow-2xl"
      >
        {/* Header */}
        <div
          className="flex items-start justify-between gap-3 border-b px-6 py-5"
          style={{ borderColor: dashboardTheme.color.border }}
        >
          <div className="flex-1 min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span
                className="rounded px-2 py-0.5 text-[11px] font-bold"
                style={{ background: pc.bg, color: pc.text }}
              >
                {violation.priority}
              </span>
              <span
                className="rounded-full px-2.5 py-0.5 text-[11px]"
                style={statusStyle(violation.status)}
              >
                {statusLabel(violation.status)}
              </span>
              <span className="text-[11px]" style={{ color: dashboardTheme.color.muted }}>
                {AREA_LABELS[violation.area] ?? violation.area}
              </span>
            </div>
            <h2 className="text-[16px] font-semibold leading-snug" style={{ color: dashboardTheme.color.text }}>
              {violation.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 hover:bg-black/5"
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 px-6 py-5">
          {violation.component && (
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: dashboardTheme.color.muted }}>Component</p>
              <code className="rounded bg-slate-100 px-2 py-0.5 text-[13px]">{violation.component}</code>
              {violation.effort && (
                <span className="ml-2 text-[12px]" style={{ color: dashboardTheme.color.muted }}>· {violation.effort}</span>
              )}
            </div>
          )}

          {violation.description && (
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: dashboardTheme.color.muted }}>Issue</p>
              <p className="text-[14px] leading-relaxed" style={{ color: dashboardTheme.color.text }}>
                {violation.description}
              </p>
            </div>
          )}

          {violation.proposed_fix && (
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: dashboardTheme.color.muted }}>Proposed fix</p>
              <div
                className="rounded-xl border p-3 text-[13px] leading-relaxed"
                style={{ background: dashboardTheme.color.surface, borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
              >
                {violation.proposed_fix}
              </div>
            </div>
          )}

          {(violation.affected_files?.length ?? 0) > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: dashboardTheme.color.muted }}>Affected files</p>
              <ul className="space-y-0.5">
                {violation.affected_files!.map((f) => (
                  <li key={f} className="truncate text-[12px] font-mono" style={{ color: dashboardTheme.color.muted }}>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Resolution note */}
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: dashboardTheme.color.muted }}>Resolution note</p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Describe how this was resolved or why it's being dismissed…"
              rows={3}
              className="w-full rounded-xl border px-3 py-2 text-[13px] outline-none focus:ring-2 resize-none"
              style={{
                borderColor: dashboardTheme.color.border,
                color: dashboardTheme.color.text,
                background: '#fff',
              }}
            />
          </div>
        </div>

        {/* Actions */}
        <div
          className="border-t px-6 py-4 space-y-2"
          style={{ borderColor: dashboardTheme.color.border }}
        >
          <div className="flex gap-2">
            <button
              onClick={() => apply('in_progress')}
              disabled={saving || violation.status === 'in_progress'}
              className="flex-1 rounded-xl py-2.5 text-[13px] font-medium transition-opacity disabled:opacity-40"
              style={{ background: '#DBEAFE', color: '#1D4ED8' }}
            >
              In progress
            </button>
            <button
              onClick={() => apply('resolved')}
              disabled={saving || violation.status === 'resolved'}
              className="flex-1 rounded-xl py-2.5 text-[13px] font-medium transition-opacity disabled:opacity-40"
              style={{ background: dashboardTheme.color.accentSoft, color: dashboardTheme.color.accent }}
            >
              Resolved
            </button>
            <button
              onClick={() => apply('wont_fix')}
              disabled={saving || violation.status === 'wont_fix'}
              className="flex-1 rounded-xl py-2.5 text-[13px] font-medium transition-opacity disabled:opacity-40"
              style={{ background: dashboardTheme.color.surface, color: dashboardTheme.color.muted }}
            >
              Won&apos;t fix
            </button>
          </div>
          {saving && (
            <p className="text-center text-[12px]" style={{ color: dashboardTheme.color.muted }}>Saving…</p>
          )}
        </div>
      </motion.div>
    </>
  );
}

// ── Overview tab ──────────────────────────────────────────────────────────────

function OverviewTab({ audits }: { audits: DesignAudit[] }) {
  const latest = audits[0];

  if (!latest) {
    return (
      <div
        className="rounded-2xl border p-8 text-center"
        style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.muted }}
      >
        No audit data yet. The Design System agent runs Saturday 6 AM AEST.
      </div>
    );
  }

  const sc = scoreColor(latest.overall_score);

  return (
    <div className="space-y-6">
      {/* Score hero */}
      <div
        className="rounded-2xl border p-6 flex items-start gap-6"
        style={{ background: '#fff', borderColor: dashboardTheme.color.border }}
      >
        <div
          className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-2xl text-center"
          style={{ background: sc.bg }}
        >
          <span className="text-[28px] font-bold leading-none" style={{ color: sc.text }}>{latest.overall_score}</span>
          <span className="text-[10px] font-semibold uppercase tracking-wide mt-0.5" style={{ color: sc.text }}>/ 100</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-[18px] font-semibold capitalize" style={{ color: dashboardTheme.color.text }}>
              {latest.score_label}
            </h2>
            <span className="text-[12px]" style={{ color: dashboardTheme.color.muted }}>
              {latest.audit_date} · {latest.violation_count} violation{latest.violation_count !== 1 ? 's' : ''}
            </span>
          </div>
          {latest.executive_summary && (
            <p className="text-[13px] leading-relaxed" style={{ color: dashboardTheme.color.muted }}>
              {latest.executive_summary}
            </p>
          )}
        </div>
      </div>

      {/* Area scores grid */}
      <div>
        <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-wide" style={{ color: dashboardTheme.color.muted }}>
          Area breakdown
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {AREA_ORDER.map((areaId) => {
            const score = latest.area_scores[areaId] ?? 0;
            const { text, bg } = scoreColor(score);
            const prev = audits[1]?.area_scores[areaId];
            const trend = prev !== undefined ? score - prev : null;
            return (
              <div
                key={areaId}
                className="rounded-xl border p-4"
                style={{ background: '#fff', borderColor: dashboardTheme.color.border }}
              >
                <p className="mb-2 text-[11px]" style={{ color: dashboardTheme.color.muted }}>
                  {AREA_LABELS[areaId]}
                </p>
                <div className="flex items-end gap-1.5">
                  <span className="text-[22px] font-bold leading-none" style={{ color: text }}>{score}</span>
                  <span className="text-[11px] mb-0.5" style={{ color: text }}>/100</span>
                  {trend !== null && (
                    <span
                      className="ml-auto text-[11px] font-medium"
                      style={{ color: trend > 0 ? dashboardTheme.color.success : trend < 0 ? dashboardTheme.color.error : dashboardTheme.color.muted }}
                    >
                      {trend > 0 ? `+${trend}` : trend < 0 ? `${trend}` : '—'}
                    </span>
                  )}
                </div>
                <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: dashboardTheme.color.surface }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, background: bg === '#ECFDF5' ? '#1C7C54' : text }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick wins */}
      {(latest.quick_wins?.length ?? 0) > 0 && (
        <div>
          <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-wide" style={{ color: dashboardTheme.color.muted }}>
            Quick wins (&lt; 30 min each)
          </h3>
          <div
            className="rounded-2xl border divide-y"
            style={{ background: '#fff', borderColor: dashboardTheme.color.border }}
          >
            {latest.quick_wins!.map((win, i) => (
              <div key={i} className="flex items-start gap-3 px-5 py-3.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={dashboardTheme.color.accent} strokeWidth="2.5" className="mt-0.5 shrink-0">
                  <polyline points="9 11 12 14 22 4" />
                  <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                </svg>
                <span className="text-[13px] leading-snug" style={{ color: dashboardTheme.color.text }}>{win}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Violations tab ────────────────────────────────────────────────────────────

function ViolationsTab({
  violations,
  onSelect,
}: {
  violations: DesignViolation[];
  onSelect: (v: DesignViolation) => void;
}) {
  const [filterArea, setFilterArea] = useState('all');
  const [filterStatus, setFilterStatus] = useState('open');
  const [filterPriority, setFilterPriority] = useState('all');

  const filtered = violations.filter((v) => {
    if (filterArea !== 'all' && v.area !== filterArea) return false;
    if (filterStatus !== 'all' && v.status !== filterStatus) return false;
    if (filterPriority !== 'all' && v.priority !== filterPriority) return false;
    return true;
  });

  const selectStyle = {
    background: '#fff',
    border: `1px solid ${dashboardTheme.color.border}`,
    color: dashboardTheme.color.text,
    borderRadius: '10px',
    padding: '6px 12px',
    fontSize: '13px',
    outline: 'none',
  } as React.CSSProperties;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={selectStyle}>
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In progress</option>
          <option value="resolved">Resolved</option>
          <option value="wont_fix">Won&apos;t fix</option>
          <option value="accepted">Accepted</option>
        </select>
        <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} style={selectStyle}>
          <option value="all">All priorities</option>
          <option value="P0">P0 — Critical</option>
          <option value="P1">P1 — High</option>
          <option value="P2">P2 — Medium</option>
          <option value="P3">P3 — Low</option>
        </select>
        <select value={filterArea} onChange={(e) => setFilterArea(e.target.value)} style={selectStyle}>
          <option value="all">All areas</option>
          {AREA_ORDER.map((a) => (
            <option key={a} value={a}>{AREA_LABELS[a]}</option>
          ))}
        </select>
        <span className="ml-auto self-center text-[12px]" style={{ color: dashboardTheme.color.muted }}>
          {filtered.length} result{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div
          className="rounded-2xl border p-8 text-center text-[14px]"
          style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.muted }}
        >
          No violations match these filters.
        </div>
      ) : (
        <div
          className="rounded-2xl border divide-y overflow-hidden"
          style={{ background: '#fff', borderColor: dashboardTheme.color.border }}
        >
          {filtered.map((v) => {
            const pc = priorityColor(v.priority);
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => onSelect(v)}
                className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-black/[0.02] transition-colors"
              >
                <span
                  className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold"
                  style={{ background: pc.bg, color: pc.text }}
                >
                  {v.priority}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-[13px] font-medium" style={{ color: dashboardTheme.color.text }}>
                    {v.title}
                  </p>
                  <p className="truncate text-[11px]" style={{ color: dashboardTheme.color.muted }}>
                    {AREA_LABELS[v.area] ?? v.area}{v.component ? ` · ${v.component}` : ''}
                    {v.effort ? ` · ${v.effort}` : ''}
                  </p>
                </div>
                <span
                  className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px]"
                  style={statusStyle(v.status)}
                >
                  {statusLabel(v.status)}
                </span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={dashboardTheme.color.muted} strokeWidth="2" className="shrink-0">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Tokens tab ────────────────────────────────────────────────────────────────

function TokensTab({ tokenOverrides }: { tokenOverrides: TokenOverrides | null }) {
  const [brand, setBrand] = useState<Record<string, string>>({
    ...BRAND_DEFAULTS,
    ...(tokenOverrides?.brand as Record<string, string> | undefined ?? {}),
  });
  const [glass, setGlass] = useState(tokenOverrides?.glass ?? GLASS_DEFAULT);
  const [glassSoft, setGlassSoft] = useState(tokenOverrides?.glassSoft ?? GLASS_SOFT_DEFAULT);
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [copied, setCopied] = useState(false);

  const save = useCallback(async () => {
    setSaving('saving');
    try {
      const res = await fetch('/api/site-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'design_token_overrides',
          value: { brand, glass, glassSoft },
        }),
      });
      setSaving(res.ok ? 'saved' : 'error');
      if (res.ok) setTimeout(() => setSaving('idle'), 2000);
    } catch {
      setSaving('error');
    }
  }, [brand, glass, glassSoft]);

  const reset = useCallback(() => {
    setBrand({ ...BRAND_DEFAULTS });
    setGlass(GLASS_DEFAULT);
    setGlassSoft(GLASS_SOFT_DEFAULT);
  }, []);

  const copyCode = useCallback(() => {
    const lines = [
      `export const brand = {`,
      ...Object.entries(brand).map(([k, v]) => `  ${k}: '${v}',`),
      `};`,
      ``,
      `export const glass = '${glass}';`,
      `export const glassSoft = '${glassSoft}';`,
    ].join('\n');
    navigator.clipboard.writeText(lines).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [brand, glass, glassSoft]);

  const inputStyle: React.CSSProperties = {
    flex: 1,
    border: `1px solid ${dashboardTheme.color.border}`,
    borderRadius: '10px',
    padding: '6px 10px',
    fontSize: '13px',
    fontFamily: 'monospace',
    color: dashboardTheme.color.text,
    background: '#fff',
    outline: 'none',
  };

  return (
    <div className="space-y-6">
      {/* Info banner */}
      <div
        className="rounded-xl border px-4 py-3 text-[13px]"
        style={{ background: '#EFF6FF', borderColor: '#BFDBFE', color: '#1D4ED8' }}
      >
        Overrides are stored as a record in site settings. Use &quot;Copy theme.ts&quot; to generate the code snippet to apply them to the codebase.
      </div>

      {/* Brand colors */}
      <div>
        <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-wide" style={{ color: dashboardTheme.color.muted }}>
          Brand colors
        </h3>
        <div
          className="rounded-2xl border divide-y overflow-hidden"
          style={{ background: '#fff', borderColor: dashboardTheme.color.border }}
        >
          {Object.keys(BRAND_DEFAULTS).map((key) => {
            const value = brand[key] ?? BRAND_DEFAULTS[key];
            const isModified = value !== BRAND_DEFAULTS[key];
            return (
              <div key={key} className="flex items-center gap-3 px-5 py-3">
                <input
                  type="color"
                  value={value}
                  onChange={(e) => setBrand((prev) => ({ ...prev, [key]: e.target.value }))}
                  className="h-8 w-8 shrink-0 cursor-pointer rounded border-0 p-0"
                  style={{ padding: 0 }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium" style={{ color: dashboardTheme.color.text }}>
                    {BRAND_LABELS[key]}
                    {isModified && (
                      <span className="ml-2 text-[10px] font-semibold" style={{ color: '#1D4ED8' }}>modified</span>
                    )}
                  </p>
                  <p className="text-[11px] font-mono" style={{ color: dashboardTheme.color.muted }}>brand.{key}</p>
                </div>
                <input
                  type="text"
                  value={value}
                  onChange={(e) => setBrand((prev) => ({ ...prev, [key]: e.target.value }))}
                  style={{ ...inputStyle, width: '120px', flex: 'none' }}
                />
                {isModified && (
                  <button
                    onClick={() => setBrand((prev) => ({ ...prev, [key]: BRAND_DEFAULTS[key] ?? '' }))}
                    className="text-[11px]"
                    style={{ color: dashboardTheme.color.muted }}
                  >
                    Reset
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Glass tokens */}
      <div>
        <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-wide" style={{ color: dashboardTheme.color.muted }}>
          Glass tokens
        </h3>
        <div
          className="rounded-2xl border divide-y overflow-hidden"
          style={{ background: '#fff', borderColor: dashboardTheme.color.border }}
        >
          {[
            { key: 'glass', label: 'glass', value: glass, onChange: setGlass, def: GLASS_DEFAULT },
            { key: 'glassSoft', label: 'glassSoft', value: glassSoft, onChange: setGlassSoft, def: GLASS_SOFT_DEFAULT },
          ].map(({ key, label, value, onChange, def }) => (
            <div key={key} className="px-5 py-4">
              <div className="mb-1.5 flex items-center gap-2">
                <p className="text-[12px] font-medium" style={{ color: dashboardTheme.color.text }}>{label}</p>
                {value !== def && <span className="text-[10px] font-semibold" style={{ color: '#1D4ED8' }}>modified</span>}
                {value !== def && (
                  <button onClick={() => onChange(def)} className="text-[11px]" style={{ color: dashboardTheme.color.muted }}>
                    Reset
                  </button>
                )}
              </div>
              <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                rows={2}
                className="w-full rounded-xl border px-3 py-2 text-[12px] font-mono resize-none outline-none"
                style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
              />
              {/* Preview */}
              <div className={`mt-2 rounded-xl p-3 text-[11px] ${value}`} style={{ color: dashboardTheme.color.muted }}>
                Preview surface
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving === 'saving'}
          className="rounded-xl px-5 py-2.5 text-[13px] font-medium text-white transition-opacity disabled:opacity-60"
          style={{ background: dashboardTheme.color.accent }}
        >
          {saving === 'saving' ? 'Saving…' : saving === 'saved' ? 'Saved' : saving === 'error' ? 'Failed — retry' : 'Save overrides'}
        </button>
        <button
          onClick={copyCode}
          className="rounded-xl border px-5 py-2.5 text-[13px] font-medium transition-colors"
          style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
        >
          {copied ? 'Copied!' : 'Copy theme.ts snippet'}
        </button>
        <button
          onClick={reset}
          className="ml-auto text-[12px]"
          style={{ color: dashboardTheme.color.muted }}
        >
          Reset all to defaults
        </button>
      </div>
    </div>
  );
}

// ── Root component ────────────────────────────────────────────────────────────

export function DesignDashboardClient({ audits, violations, tokenOverrides }: Props) {
  const [tab, setTab] = useState<Tab>('overview');
  const [selectedViolation, setSelectedViolation] = useState<DesignViolation | null>(null);
  const [localViolations, setLocalViolations] = useState<DesignViolation[]>(violations);

  const handleStatusChange = useCallback((id: string, status: string, note: string) => {
    setLocalViolations((prev) =>
      prev.map((v) =>
        v.id === id
          ? { ...v, status, resolution_note: note, resolved_at: ['resolved', 'wont_fix'].includes(status) ? new Date().toISOString() : v.resolved_at }
          : v,
      ),
    );
  }, []);

  const openCount = localViolations.filter((v) => v.status === 'open').length;

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'violations', label: 'Violations', count: openCount },
    { id: 'tokens', label: 'Design tokens' },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-[24px] font-semibold" style={{ color: dashboardTheme.color.text }}>
          Design System
        </h1>
        <p className="mt-0.5 text-[13px]" style={{ color: dashboardTheme.color.muted }}>
          Audit scores, violations, and design token overrides
        </p>
      </div>

      {/* Tab bar */}
      <div
        className="mb-6 flex gap-1 rounded-xl border p-1"
        style={{ background: dashboardTheme.color.surface, borderColor: dashboardTheme.color.border, width: 'fit-content' }}
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-medium transition-all"
            style={
              tab === t.id
                ? { background: '#fff', color: dashboardTheme.color.text, boxShadow: '0 1px 4px rgba(2,6,23,0.08)' }
                : { color: dashboardTheme.color.muted }
            }
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span
                className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                style={
                  tab === t.id
                    ? { background: dashboardTheme.color.accentSoft, color: dashboardTheme.color.accent }
                    : { background: dashboardTheme.color.border, color: dashboardTheme.color.muted }
                }
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'overview' && <OverviewTab audits={audits} />}
      {tab === 'violations' && (
        <ViolationsTab violations={localViolations} onSelect={setSelectedViolation} />
      )}
      {tab === 'tokens' && <TokensTab tokenOverrides={tokenOverrides} />}

      {/* Violation side panel */}
      <AnimatePresence>
        {selectedViolation && (
          <ViolationPanel
            violation={selectedViolation}
            onClose={() => setSelectedViolation(null)}
            onStatusChange={handleStatusChange}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
