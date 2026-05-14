'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { brand, glass } from '@/app/ui/theme';
import {
  SUPPORT_MODE_LABELS,
  PHYSICAL_INTENSITY_LABELS,
  REQUIRED_SUPPORT_MODE_LABELS,
  type JobRequirements,
  type MatchFlag,
  type MatchReason,
  type ParticipantSupportProfile,
} from '@/types/ndis';
import { matchGrade, MATCH_GRADE_LABELS, MATCH_GRADE_COLORS } from '@/lib/ndis/matching';
import { SERVICE_TYPE_LABELS } from '@/types/orders';

// ── Types ─────────────────────────────────────────────────────────────────────

type Order = {
  id: string;
  customer_name: string;
  service_type: string;
  context: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  estimated_duration_minutes: number;
  status: string;
  notes: string | null;
  final_price: number;
};

type MatchRow = {
  employee_id: string;
  employee: {
    id: string;
    full_name: string;
    email: string;
    suburb: string | null;
    services: string[] | null;
    ndis_worker: boolean;
  };
  support_profile: ParticipantSupportProfile | null;
  score: number;
  max_score: number;
  reasons: MatchReason[];
  flags: MatchFlag[];
  has_profile: boolean;
  publication_status: string | null;
};

// ── Form defaults ─────────────────────────────────────────────────────────────

const DEFAULT_REQS: Partial<JobRequirements> = {
  required_support_mode: 'any',
  physical_intensity: 'medium',
  transport_required: false,
  customer_facing_required: true,
  can_split_shift: false,
  requires_team: false,
  ndis_matching_enabled: true,
};

// ── Sub-components ────────────────────────────────────────────────────────────

function FlagBadge({ flag }: { flag: MatchFlag }) {
  const isBlocker = flag.severity === 'blocker';
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
      style={{
        background: isBlocker ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
        color: isBlocker ? '#991B1B' : '#92400E',
      }}
      title={flag.detail}
    >
      {isBlocker ? '⛔' : '⚠️'} {flag.label}
    </span>
  );
}

function ScoreBadge({ score, max }: { score: number; max: number }) {
  const grade = matchGrade(score, max);
  const colors = MATCH_GRADE_COLORS[grade];
  const pct = max > 0 ? Math.round((score / max) * 100) : 0;
  return (
    <div
      className="flex flex-col items-center justify-center w-16 h-16 rounded-2xl shrink-0"
      style={{ background: colors.bg }}
    >
      <span className="text-xl font-bold leading-none" style={{ color: colors.text }}>{pct}</span>
      <span className="text-[10px] font-medium mt-0.5" style={{ color: colors.text }}>/ 100</span>
    </div>
  );
}

function MatchReasonRow({ reason }: { reason: MatchReason }) {
  return (
    <div className="flex items-center gap-2 text-xs py-1">
      <span className={reason.passed ? 'text-emerald-600' : 'text-slate-400'}>
        {reason.passed ? '✓' : '✗'}
      </span>
      <span style={{ color: reason.passed ? '#065F46' : brand.muted }}>{reason.label}</span>
      {reason.note && (
        <span className="text-[11px]" style={{ color: brand.muted }}>— {reason.note}</span>
      )}
      <span className="ml-auto font-medium" style={{ color: brand.muted }}>
        {reason.points}/{reason.max_points}
      </span>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MatchParticipantsPage() {
  const params = useParams<{ orderId: string }>();
  const orderId = params?.orderId ?? '';
  const router = useRouter();

  const [order, setOrder] = useState<Order | null>(null);
  const [requirements, setRequirements] = useState<Partial<JobRequirements>>(DEFAULT_REQS);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loadingReqs, setLoadingReqs] = useState(true);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [savingReqs, setSavingReqs] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [overrideNote, setOverrideNote] = useState('');
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);
  const [showOverride, setShowOverride] = useState(false);

  // Load order + requirements
  const loadRequirements = useCallback(async () => {
    setLoadingReqs(true);
    try {
      const res = await fetch(`/api/ndis/jobs/${orderId}/requirements`);
      if (!res.ok) throw new Error('Failed to load job requirements');
      const data = await res.json();
      setOrder(data.order);
      if (data.requirements) {
        setRequirements(data.requirements);
      } else {
        // Pre-fill from order
        setRequirements({
          ...DEFAULT_REQS,
          service_type: data.order.service_type,
          estimated_duration_minutes: data.order.estimated_duration_minutes,
          scheduled_date: data.order.scheduled_date,
        } as Partial<JobRequirements>);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoadingReqs(false);
    }
  }, [orderId]);

  useEffect(() => { loadRequirements(); }, [loadRequirements]);

  // Compute matches
  const computeMatches = useCallback(async () => {
    setLoadingMatches(true);
    setMatches([]);
    try {
      const res = await fetch(`/api/ndis/jobs/${orderId}/matches`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Failed to compute matches');
      }
      const data = await res.json();
      setMatches(data.matches ?? []);
      // Pre-select already-published participants
      const alreadyPublished = new Set<string>(
        (data.matches ?? [])
          .filter((m: MatchRow) => m.publication_status === 'published' || m.publication_status === 'accepted')
          .map((m: MatchRow) => m.employee_id)
      );
      setSelected(alreadyPublished);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to compute matches');
    } finally {
      setLoadingMatches(false);
    }
  }, [orderId]);

  // Save requirements then compute matches
  async function handleSaveAndMatch() {
    setSavingReqs(true);
    try {
      const res = await fetch(`/api/ndis/jobs/${orderId}/requirements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requirements),
      });
      if (!res.ok) throw new Error('Failed to save requirements');
      toast.success('Requirements saved');
      await computeMatches();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSavingReqs(false);
    }
  }

  // Check if any selected participant has a blocker flag
  const hasBlockerSelected = matches
    .filter((m) => selected.has(m.employee_id))
    .some((m) => m.flags.some((f) => f.severity === 'blocker'));

  async function handlePublish() {
    if (selected.size === 0) {
      toast.error('Select at least one participant');
      return;
    }
    if (hasBlockerSelected && !overrideNote.trim()) {
      setShowOverride(true);
      return;
    }
    setPublishing(true);
    try {
      const res = await fetch(`/api/ndis/jobs/${orderId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_ids: Array.from(selected),
          override_reason: overrideNote.trim() || null,
        }),
      });
      if (!res.ok) throw new Error('Failed to publish job');
      toast.success(`Job published to ${selected.size} participant${selected.size !== 1 ? 's' : ''}`);
      router.push('/dashboard/ndis');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Publish failed');
    } finally {
      setPublishing(false);
    }
  }

  function toggleSelect(empId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(empId)) next.delete(empId);
      else next.add(empId);
      return next;
    });
  }

  const serviceLabel = order
    ? (SERVICE_TYPE_LABELS[order.service_type as keyof typeof SERVICE_TYPE_LABELS] ?? order.service_type)
    : '';

  if (loadingReqs) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: brand.primary, borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70"
        style={{ color: brand.muted }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
        Back to NDIS
      </button>

      {/* Job summary */}
      {order && (
        <div className={`${glass} rounded-2xl p-5`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{ background: 'rgba(15,61,46,0.1)', color: brand.primary }}
                >
                  {serviceLabel}
                </span>
                <span className="text-xs capitalize" style={{ color: brand.muted }}>{order.context}</span>
              </div>
              <h1 className="text-lg font-bold" style={{ color: brand.text }}>{order.customer_name}</h1>
              {order.scheduled_date && (
                <p className="text-sm mt-1" style={{ color: brand.muted }}>
                  {new Date(order.scheduled_date).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                  {order.scheduled_time && ` at ${order.scheduled_time}`}
                </p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-xl font-bold" style={{ color: brand.primary }}>${order.final_price.toFixed(2)}</p>
              <p className="text-xs mt-1" style={{ color: brand.muted }}>
                ~{Math.round(order.estimated_duration_minutes / 60 * 10) / 10}h est.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Job requirements editor */}
      <div className={`${glass} rounded-2xl p-5`}>
        <h2 className="text-base font-semibold mb-4" style={{ color: brand.text }}>Job Support Requirements</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Duration */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: brand.muted }}>Estimated duration (minutes)</label>
            <input
              type="number"
              min={15}
              value={requirements.estimated_duration_minutes ?? ''}
              onChange={(e) => setRequirements((r) => ({ ...r, estimated_duration_minutes: Number(e.target.value) || null }))}
              className="w-full rounded-xl border px-3 py-2 text-sm"
              style={{ borderColor: brand.border, color: brand.text }}
              placeholder={order ? String(order.estimated_duration_minutes) : ''}
            />
          </div>

          {/* Physical intensity */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: brand.muted }}>Physical intensity</label>
            <select
              value={requirements.physical_intensity ?? 'medium'}
              onChange={(e) => setRequirements((r) => ({ ...r, physical_intensity: e.target.value as JobRequirements['physical_intensity'] }))}
              className="w-full rounded-xl border px-3 py-2 text-sm"
              style={{ borderColor: brand.border, color: brand.text }}
            >
              {Object.entries(PHYSICAL_INTENSITY_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>

          {/* Support mode required */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: brand.muted }}>Required support mode</label>
            <select
              value={requirements.required_support_mode ?? 'any'}
              onChange={(e) => setRequirements((r) => ({ ...r, required_support_mode: e.target.value as JobRequirements['required_support_mode'] }))}
              className="w-full rounded-xl border px-3 py-2 text-sm"
              style={{ borderColor: brand.border, color: brand.text }}
            >
              {Object.entries(REQUIRED_SUPPORT_MODE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>

          {/* Start / End time */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: brand.muted }}>Start time</label>
              <input
                type="time"
                value={requirements.start_time ?? ''}
                onChange={(e) => setRequirements((r) => ({ ...r, start_time: e.target.value || null }))}
                className="w-full rounded-xl border px-3 py-2 text-sm"
                style={{ borderColor: brand.border, color: brand.text }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: brand.muted }}>End time</label>
              <input
                type="time"
                value={requirements.end_time ?? ''}
                onChange={(e) => setRequirements((r) => ({ ...r, end_time: e.target.value || null }))}
                className="w-full rounded-xl border px-3 py-2 text-sm"
                style={{ borderColor: brand.border, color: brand.text }}
              />
            </div>
          </div>

          {/* Location suburb */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: brand.muted }}>Location (suburb)</label>
            <input
              type="text"
              value={requirements.location_suburb ?? ''}
              onChange={(e) => setRequirements((r) => ({ ...r, location_suburb: e.target.value || null }))}
              className="w-full rounded-xl border px-3 py-2 text-sm"
              style={{ borderColor: brand.border, color: brand.text }}
              placeholder="e.g. South Brisbane"
            />
          </div>

          {/* Risk notes */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: brand.muted }}>Risk notes (admin only)</label>
            <input
              type="text"
              value={requirements.risk_notes ?? ''}
              onChange={(e) => setRequirements((r) => ({ ...r, risk_notes: e.target.value || null }))}
              className="w-full rounded-xl border px-3 py-2 text-sm"
              style={{ borderColor: brand.border, color: brand.text }}
              placeholder="Any hazards or access notes"
            />
          </div>

          {/* Checkboxes */}
          <div className="flex flex-col gap-2">
            {[
              { key: 'transport_required', label: 'Transport required' },
              { key: 'customer_facing_required', label: 'Customer-facing required' },
              { key: 'can_split_shift', label: 'Shift can be split' },
              { key: 'requires_team', label: 'Requires team' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: brand.text }}>
                <input
                  type="checkbox"
                  checked={!!requirements[key as keyof typeof requirements]}
                  onChange={(e) => setRequirements((r) => ({ ...r, [key]: e.target.checked }))}
                  className="rounded"
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <button
            onClick={handleSaveAndMatch}
            disabled={savingReqs}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
            style={{ background: brand.primary }}
          >
            {savingReqs ? (
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            )}
            Save & Find Matches
          </button>
          {matches.length > 0 && (
            <button
              onClick={computeMatches}
              disabled={loadingMatches}
              className="px-4 py-2 rounded-xl text-sm font-medium border transition-colors hover:bg-slate-50 disabled:opacity-50"
              style={{ borderColor: brand.border, color: brand.muted }}
            >
              Refresh matches
            </button>
          )}
        </div>
      </div>

      {/* Matches list */}
      {loadingMatches ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className={`${glass} rounded-2xl p-5 animate-pulse`}>
              <div className="flex gap-4">
                <div className="w-16 h-16 rounded-2xl bg-slate-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-200 rounded w-1/3" />
                  <div className="h-3 bg-slate-200 rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : matches.length > 0 ? (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold" style={{ color: brand.text }}>
              Participant matches <span className="text-sm font-normal" style={{ color: brand.muted }}>({matches.length} checked)</span>
            </h2>
            {selected.size > 0 && (
              <span className="text-sm font-medium" style={{ color: brand.primary }}>
                {selected.size} selected
              </span>
            )}
          </div>

          <div className="space-y-3">
            {matches.map((m) => {
              const grade = matchGrade(m.score, m.max_score);
              const gradeColors = MATCH_GRADE_COLORS[grade];
              const blockers = m.flags.filter((f) => f.severity === 'blocker');
              const warnings = m.flags.filter((f) => f.severity === 'warning');
              const isSelected = selected.has(m.employee_id);
              const isExpanded = expandedMatch === m.employee_id;
              const alreadyPublished = m.publication_status === 'published' || m.publication_status === 'accepted';

              return (
                <div
                  key={m.employee_id}
                  className={`${glass} rounded-2xl p-5 transition-all`}
                  style={{
                    outline: isSelected ? `2px solid ${brand.primary}` : 'none',
                    outlineOffset: 2,
                  }}
                >
                  <div className="flex items-start gap-4">
                    {/* Checkbox */}
                    <div className="mt-1">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(m.employee_id)}
                        className="w-4 h-4 accent-green-800 cursor-pointer"
                      />
                    </div>

                    {/* Score badge */}
                    <ScoreBadge score={m.score} max={m.max_score} />

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold" style={{ color: brand.text }}>
                          {m.employee.full_name}
                        </span>
                        <span
                          className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                          style={{ background: gradeColors.bg, color: gradeColors.text }}
                        >
                          {MATCH_GRADE_LABELS[grade]}
                        </span>
                        {m.employee.ndis_worker && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-800">
                            NDIS worker
                          </span>
                        )}
                        {alreadyPublished && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-800">
                            Already published
                          </span>
                        )}
                        {!m.has_profile && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600">
                            No support profile
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs" style={{ color: brand.muted }}>{m.employee.email}</span>
                        {m.employee.suburb && (
                          <span className="text-xs" style={{ color: brand.muted }}>· {m.employee.suburb}</span>
                        )}
                      </div>

                      {/* Support profile summary */}
                      {m.support_profile && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: brand.surfaceAlt, color: brand.muted }}>
                            {SUPPORT_MODE_LABELS[m.support_profile.support_mode]}
                          </span>
                          {m.support_profile.support_window_start && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: brand.surfaceAlt, color: brand.muted }}>
                              {m.support_profile.support_window_start}–{m.support_profile.support_window_end}
                            </span>
                          )}
                          <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: brand.surfaceAlt, color: brand.muted }}>
                            max {m.support_profile.max_shift_duration_minutes} min
                          </span>
                        </div>
                      )}

                      {/* Flags */}
                      {m.flags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {blockers.map((f, i) => <FlagBadge key={i} flag={f} />)}
                          {warnings.map((f, i) => <FlagBadge key={i} flag={f} />)}
                        </div>
                      )}
                    </div>

                    {/* Expand toggle */}
                    <button
                      onClick={() => setExpandedMatch(isExpanded ? null : m.employee_id)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors shrink-0"
                      style={{ color: brand.muted }}
                      title={isExpanded ? 'Hide breakdown' : 'Show breakdown'}
                    >
                      <svg
                        width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                        style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>
                  </div>

                  {/* Expanded breakdown */}
                  {isExpanded && m.reasons.length > 0 && (
                    <div className="mt-4 pt-4 border-t" style={{ borderColor: brand.border }}>
                      <p className="text-xs font-semibold mb-2" style={{ color: brand.muted }}>Score breakdown</p>
                      <div className="divide-y" style={{ borderColor: brand.border }}>
                        {m.reasons.map((r, i) => <MatchReasonRow key={i} reason={r} />)}
                      </div>
                      {m.support_profile?.supervision_notes && (
                        <div className="mt-3 p-3 rounded-xl" style={{ background: 'rgba(245,158,11,0.07)' }}>
                          <p className="text-[11px] font-semibold text-amber-800 mb-0.5">Supervision notes</p>
                          <p className="text-xs text-amber-900">{m.support_profile.supervision_notes}</p>
                        </div>
                      )}
                      {m.support_profile?.risk_notes && (
                        <div className="mt-2 p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.06)' }}>
                          <p className="text-[11px] font-semibold text-red-800 mb-0.5">Participant risk notes</p>
                          <p className="text-xs text-red-900">{m.support_profile.risk_notes}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Override note (shown when blockers present in selection) */}
          {showOverride && hasBlockerSelected && (
            <div className={`${glass} rounded-2xl p-5`} style={{ border: '2px solid rgba(239,68,68,0.3)' }}>
              <p className="text-sm font-semibold text-red-700 mb-1">Override required</p>
              <p className="text-xs mb-3" style={{ color: brand.muted }}>
                One or more selected participants has a safety blocker. Provide a documented reason to override and proceed.
              </p>
              <textarea
                value={overrideNote}
                onChange={(e) => setOverrideNote(e.target.value)}
                rows={3}
                placeholder="Explain why it is safe to proceed despite the safety flag..."
                className="w-full rounded-xl border px-3 py-2 text-sm resize-none"
                style={{ borderColor: 'rgba(239,68,68,0.4)', color: brand.text }}
              />
            </div>
          )}

          {/* Publish bar */}
          <div
            className="sticky bottom-4 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-xl"
            style={{ background: brand.primary }}
          >
            <div>
              <p className="text-sm font-semibold text-white">
                {selected.size > 0
                  ? `Publish to ${selected.size} participant${selected.size !== 1 ? 's' : ''}`
                  : 'Select participants to publish'}
              </p>
              {hasBlockerSelected && !overrideNote && (
                <p className="text-xs text-red-300 mt-0.5">Override note required for safety blockers</p>
              )}
            </div>
            <button
              onClick={handlePublish}
              disabled={publishing || selected.size === 0 || (hasBlockerSelected && !overrideNote.trim())}
              className="px-5 py-2 rounded-xl text-sm font-semibold text-white border border-white/30 hover:bg-white/10 transition-colors disabled:opacity-40 flex items-center gap-2"
            >
              {publishing ? (
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : null}
              Publish job
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
