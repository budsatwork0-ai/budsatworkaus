'use client';

import type { ReactNode } from 'react';
import type { SandboxScenarioTemplate } from '@/lib/sandbox/scenarios';
import type { Lesson, OperatorPromotionStatus, RunResult, RunStatus, TrendDirection } from '../_lib/types';
import { isPass } from '../_lib/format';

export function Panel({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="grid gap-3 rounded-[8px] border border-[#dfe9e2] bg-white px-4 py-4 shadow-[0_18px_48px_rgba(15,61,46,0.07)]">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-black text-[#17392b]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function DrawerSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[8px] border border-[#dfe9e2] px-4 py-3">
      <h3 className="text-sm font-black text-[#17392b]">{title}</h3>
      <div className="mt-2 grid gap-2">{children}</div>
    </section>
  );
}

export function CommandMetric({
  label,
  value,
  subValue,
  loading,
  tone = 'normal',
  className,
  trend,
}: {
  label: string;
  value: string;
  subValue?: string;
  loading?: boolean;
  tone?: 'normal' | 'warning' | 'success';
  className?: string;
  trend?: TrendDirection;
}) {
  const toneClass =
    className ??
    (tone === 'warning' ? 'border-amber-200 bg-amber-50 text-amber-800' : tone === 'success' ? 'border-[#b5d6c5] bg-[#e5f4ec] text-[#1C7C54]' : 'border-[#dfe9e2] bg-[#f4faf6] text-[#17392b]');
  return (
    <div className={`rounded-[8px] border px-3 py-2 ${toneClass}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.12em] opacity-75">{label}</p>
      <div className="mt-1 flex flex-wrap items-center gap-1">
        <p className="text-base font-black">{loading ? 'Loading' : value}</p>
        {!loading && trend ? <TrendBadge direction={trend} period="vs yesterday" /> : null}
      </div>
      {subValue ? <p className="truncate text-[10px] font-bold opacity-75">{subValue}</p> : null}
    </div>
  );
}

export function ArenaActionButton({ label, description, busy, disabled, onClick, tone = 'default' }: { label: string; description: string; busy: boolean; disabled: boolean; onClick: () => void; tone?: 'default' | 'warning' }) {
  const styles = tone === 'warning'
    ? 'border border-amber-300 bg-amber-50 hover:bg-amber-100'
    : 'border border-[#dfe9e2] bg-[#f4faf6] hover:border-[#3c8259] hover:bg-white';
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={`rounded-[8px] px-4 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${styles}`}>
      <p className="text-sm font-black text-[#17392b]">{busy ? 'Running...' : label}</p>
      <p className="text-xs font-semibold text-[#7f9187]">{description}</p>
    </button>
  );
}

export function RunStatusPanel({ status }: { status: RunStatus }) {
  const progress = status.total === 0 ? 0 : Math.round((status.currentIndex / status.total) * 100);
  const elapsed = Math.max(0, Math.round((Date.now() - status.startedAt) / 1000));
  const tone = status.status === 'failed' ? 'border-red-200 bg-red-50 text-red-800' : status.status === 'complete' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-900';
  return (
    <section className={`rounded-[8px] border px-4 py-4 shadow-sm ${tone}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em]">{status.kind === 'pack' ? 'Pack running' : 'Scenario running'}</p>
          <h2 className="text-lg font-black">{status.label}</h2>
          <p className="text-sm font-semibold">{status.message}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black">{status.currentIndex}/{status.total}</p>
          <p className="text-xs font-bold">{elapsed}s elapsed</p>
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/70">
        <div className="h-full rounded-full bg-current transition-all" style={{ width: `${progress}%` }} />
      </div>
      {status.currentScenario ? <p className="mt-2 text-xs font-bold">Current: {status.currentScenario}</p> : null}
    </section>
  );
}

export function LastResultCard({ result, scenario, onOpen }: { result: RunResult; scenario: SandboxScenarioTemplate | null; onOpen: () => void }) {
  return (
    <Panel title="Latest Manual Scenario Result" action={scenario ? <SmallButton onClick={onOpen}>Details</SmallButton> : null}>
      <div className="flex flex-wrap items-center gap-3">
        <PassFailChip passed={isPass(result)} />
        <F1Badge f1={result.score.f1Score} />
        {scenario ? <p className="text-sm font-black text-[#17392b]">{scenario.title}</p> : null}
      </div>
      <p className="text-xs font-semibold text-[#617269]">{result.summary}</p>
    </Panel>
  );
}

export function StatCard({ label, value, loading }: { label: string; value: number; loading: boolean }) {
  return (
    <div className="rounded-[8px] border border-[#dfe9e2] bg-white px-4 py-4 shadow-[0_12px_32px_rgba(15,61,46,0.06)]">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-[#7f9187]">{label}</p>
      <p className="mt-2 text-3xl font-black text-[#17392b]">{loading ? '-' : value}</p>
    </div>
  );
}

export function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] bg-[#f4faf6] px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-wider text-[#7f9187]">{label}</p>
      <p className="mt-1 text-sm font-black text-[#17392b]">{value}</p>
    </div>
  );
}

export function MiniMetric({ label, value, trend }: { label: string; value: string; trend?: TrendDirection }) {
  return (
    <div className="rounded-[8px] bg-[#f4faf6] px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-wider text-[#7f9187]">{label}</p>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-lg font-black text-[#17392b]">{value}</p>
        {trend ? <TrendBadge direction={trend} period="vs yesterday" /> : null}
      </div>
    </div>
  );
}

export function TrendBadge({ direction, period }: { direction: TrendDirection; period: string }) {
  const arrow = direction === 'improving' ? '↑' : direction === 'worsening' ? '↓' : '→';
  const label = direction === 'improving' ? 'improving' : direction === 'worsening' ? 'worsening' : 'unchanged';
  const colour = direction === 'improving' ? 'text-[#1C7C54]' : direction === 'worsening' ? 'text-red-700' : 'text-[#7f9187]';
  return <span className={`text-[10px] font-black uppercase tracking-wide ${colour}`}>{arrow} {label} <span className="font-bold normal-case tracking-normal opacity-75">{period}</span></span>;
}

export function LessonCard({ lesson }: { lesson: Lesson }) {
  return (
    <div className="rounded-[8px] bg-[#f4faf6] px-3 py-2">
      <p className="text-xs font-black text-[#17392b]">{lesson.title}</p>
      <p className="mt-1 text-xs font-semibold text-[#617269]">{lesson.observation}</p>
      {lesson.recommendation ? <p className="mt-1 text-xs font-semibold text-[#1C7C54]">{lesson.recommendation}</p> : null}
    </div>
  );
}

export function Select({ value, onChange, children }: { value: string; onChange: (value: string) => void; children: ReactNode }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className="rounded-[6px] border border-[#dfe9e2] bg-white px-3 py-2 text-sm font-bold text-[#617269] outline-none transition focus:border-[#1C7C54]">
      {children}
    </select>
  );
}

export function SmallButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rounded-[6px] border border-[#dfe9e2] px-3 py-1.5 text-xs font-black text-[#17392b] hover:border-[#3c8259]">
      {children}
    </button>
  );
}

export function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button type="button" onClick={onClose} className="rounded-full bg-[#f4faf6] px-3 py-1.5 text-sm font-black text-[#617269] hover:bg-[#dfe9e2]">
      Close
    </button>
  );
}

export function Alert({ tone, children }: { tone: 'error' | 'success'; children: ReactNode }) {
  return (
    <div className={`rounded-[8px] border px-4 py-3 text-sm font-semibold ${tone === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
      {children}
    </div>
  );
}

export function PromotionChip({ status }: { status: OperatorPromotionStatus }) {
  const styles: Record<OperatorPromotionStatus, string> = {
    Promote: 'bg-[#e5f4ec] text-[#1C7C54]',
    Monitor: 'bg-[#fff6e0] text-[#9a6700]',
    Investigate: 'bg-[#fde8e8] text-[#b42318]',
    Blocked: 'bg-[#f8e8f8] text-[#7b2d7b]',
  };
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${styles[status]}`}>{status}</span>;
}

export function SeverityBadge({ severity }: { severity: string }) {
  const colour =
    severity === 'critical' ? 'bg-red-100 text-red-800'
    : severity === 'warning' ? 'bg-yellow-100 text-yellow-800'
    : severity === 'resolved' ? 'bg-emerald-100 text-emerald-800'
    : 'bg-blue-100 text-blue-800';
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${colour}`}>{severity}</span>;
}

export function StatusPill({ status }: { status: string }) {
  const styles = status === 'complete' ? 'bg-[#e5f4ec] text-[#1C7C54]' : status === 'failed' ? 'bg-[#fde8e8] text-[#b42318]' : 'bg-[#fff6e0] text-[#9a6700]';
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${styles}`}>{status}</span>;
}

export function F1Badge({ f1 }: { f1: number }) {
  const colour = f1 >= 0.7 ? 'bg-emerald-100 text-emerald-800' : f1 >= 0.4 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800';
  return <span className={`rounded-full px-2 py-0.5 text-xs font-black ${colour}`}>F1 {f1.toFixed(2)}</span>;
}

export function PassFailChip({ passed }: { passed: boolean }) {
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${passed ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>{passed ? 'Pass' : 'Fail'}</span>;
}

export function ActionComparePanel({ title, actions, expectedSet }: { title: string; actions: string[]; expectedSet?: Set<string> }) {
  return (
    <section className="rounded-[8px] border border-[#dfe9e2] px-4 py-3">
      <h3 className="text-sm font-black text-[#17392b]">{title}</h3>
      {actions.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {actions.map((action, index) => {
            const matched = expectedSet ? expectedSet.has(action) : true;
            return <span key={`${action}-${index}`} className={`rounded-full px-2 py-0.5 text-[10px] font-black ${matched ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>{action}</span>;
          })}
        </div>
      ) : (
        <p className="mt-2 text-sm font-semibold text-[#7f9187]">None.</p>
      )}
    </section>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-[8px] bg-[#f4faf6] px-4 py-6 text-center">
      <p className="text-sm font-semibold text-[#7f9187]">{message}</p>
    </div>
  );
}
