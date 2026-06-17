'use client';

import { useState } from 'react';
import type { AgentIntegrityReport, AgentRow, HealthData, Lesson, WorkshopCertificationStatus, WorkshopQueueItem, WorkshopState } from '../_lib/types';
import {
  buildRepairPlanItems,
  buildWhyNotCertifiedMessage,
  deriveCertificationStatus,
  deriveActiveAgentProgress,
  formatAgentDisplayName,
  type RepairPlanItem,
} from '../_lib/workshop';
import { EmptyState, Panel, SeverityBadge, SmallButton } from './ui';

// ── Local helper: certification status badge ────────────────────────────────

function CertificationBadge({ status }: { status: WorkshopCertificationStatus }) {
  const styles: Record<WorkshopCertificationStatus, string> = {
    certified: 'bg-emerald-100 text-emerald-800',
    blocked: 'bg-red-100 text-red-800',
    in_progress: 'bg-amber-100 text-amber-800',
  };
  const labels: Record<WorkshopCertificationStatus, string> = {
    certified: 'Certified',
    blocked: 'Blocked',
    in_progress: 'In Progress',
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

// ── Local helper: readiness progress bar ────────────────────────────────────

function ReadinessBar({ value }: { value: number }) {
  const colour =
    value >= 80 ? 'bg-emerald-500' : value >= 40 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="h-2 overflow-hidden rounded-full bg-[#dfe9e2]" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div
        className={`h-full rounded-full transition-all duration-500 ${colour}`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

// ── Workshop progress strip ─────────────────────────────────────────────────

function WorkshopProgressStrip({
  certifiedCount,
  totalCount,
  completionPercentage,
  queue,
}: {
  certifiedCount: number;
  totalCount: number;
  completionPercentage: number;
  queue: WorkshopQueueItem[];
}) {
  const blockedCount = queue.filter((item) => item.certificationStatus === 'blocked').length;
  const backlogCount = queue.filter((item) => item.status === 'backlog').length;
  const activeCount = queue.filter((item) => item.status === 'active').length;

  return (
    <div className="rounded-[8px] border border-[#dfe9e2] bg-white px-4 py-4 shadow-[0_12px_32px_rgba(15,61,46,0.06)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#7f9187]">Workshop Progress</p>
          <p className="mt-1 text-2xl font-black text-[#17392b]">
            {certifiedCount} / {totalCount} certified
          </p>
          <p className="text-sm font-semibold text-[#617269]">{completionPercentage}% complete</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Metric label="Certified" value={certifiedCount} colour="text-emerald-700" />
          <Metric label="Active" value={activeCount} colour="text-[#17392b]" />
          <Metric label="Blocked" value={blockedCount} colour="text-red-700" />
          <Metric label="Backlog" value={backlogCount} colour="text-[#7f9187]" />
        </div>
      </div>
      <div className="mt-3">
        <ReadinessBar value={completionPercentage} />
      </div>
    </div>
  );
}

function Metric({ label, value, colour }: { label: string; value: number; colour: string }) {
  return (
    <div className="text-center">
      <p className={`text-xl font-black ${colour}`}>{value}</p>
      <p className="text-[10px] font-black uppercase tracking-wider text-[#7f9187]">{label}</p>
    </div>
  );
}

// ── Currently On Bench panel ────────────────────────────────────────────────

function CurrentlyOnBenchPanel({
  workshopState,
  integrityReport,
  agentRow,
  health,
  lessons,
  onRunTests,
  onViewDoctor,
  onAdvanceWorkshop,
}: {
  workshopState: WorkshopState;
  integrityReport: AgentIntegrityReport | null;
  agentRow: AgentRow | null;
  health: HealthData | null;
  lessons: Lesson[];
  onRunTests: () => void;
  onViewDoctor: () => void;
  onAdvanceWorkshop: () => void;
}) {
  const { activeAgentId, activeAgentProgress } = workshopState;
  const displayName = formatAgentDisplayName(activeAgentId);

  const activeItem = workshopState.queue.find((item) => item.agentId === activeAgentId);
  const certStatus = activeItem?.certificationStatus ?? 'in_progress';

  const passRateDisplay =
    activeAgentProgress.passRate !== null
      ? `${(activeAgentProgress.passRate * 100).toFixed(0)}%`
      : 'No runs yet';

  const readinessDisplay = `${activeAgentProgress.readinessPercentage}%`;

  const canAdvance = workshopState.queue.some(
    (item) =>
      item.agentId !== activeAgentId &&
      (item.status === 'pending' || item.certificationStatus === 'in_progress'),
  );

  return (
    <Panel title="Currently on the Bench">
      {/* Agent header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-black text-[#17392b]">{displayName}</h3>
            <CertificationBadge status={certStatus} />
          </div>
          <p className="mt-0.5 text-xs font-semibold text-[#7f9187]">{activeAgentId}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SmallButton onClick={onRunTests}>Run Tests</SmallButton>
          <SmallButton onClick={onViewDoctor}>View in Doctor</SmallButton>
          {certStatus === 'certified' && canAdvance ? (
            <button
              type="button"
              onClick={onAdvanceWorkshop}
              className="rounded-[6px] border border-[#1C7C54] bg-[#1C7C54] px-3 py-1.5 text-xs font-black text-white transition hover:bg-[#17392b]"
            >
              Advance Workshop →
            </button>
          ) : null}
        </div>
      </div>

      {/* Progress metrics grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        <BenchMetric
          label="Readiness"
          value={readinessDisplay}
          tone={activeAgentProgress.readinessPercentage >= 80 ? 'success' : activeAgentProgress.readinessPercentage >= 40 ? 'warning' : 'danger'}
        />
        <BenchMetric
          label="Pass Rate"
          value={passRateDisplay}
          tone={
            activeAgentProgress.passRate === null
              ? 'neutral'
              : activeAgentProgress.passRate >= 0.8
                ? 'success'
                : activeAgentProgress.passRate >= 0.5
                  ? 'warning'
                  : 'danger'
          }
        />
        <BenchMetric
          label="Blockers"
          value={String(activeAgentProgress.blockerCount)}
          tone={activeAgentProgress.blockerCount > 0 ? 'danger' : 'success'}
        />
        <BenchMetric
          label="Root Causes"
          value={String(activeAgentProgress.openRootCauses)}
          tone={activeAgentProgress.openRootCauses > 0 ? 'warning' : 'success'}
        />
        <BenchMetric
          label="Open Lessons"
          value={String(activeAgentProgress.openLessons)}
          tone={activeAgentProgress.openLessons > 0 ? 'warning' : 'success'}
        />
        <BenchMetric
          label="Integrity"
          value={integrityReport ? `${integrityReport.integrityScore}%` : '—'}
          tone={
            integrityReport === null
              ? 'neutral'
              : integrityReport.integrityScore >= 80
                ? 'success'
                : integrityReport.integrityScore >= 40
                  ? 'warning'
                  : 'danger'
          }
        />
      </div>

      {/* Readiness bar */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <p className="text-[10px] font-black uppercase tracking-wider text-[#7f9187]">Readiness</p>
          <p className="text-[10px] font-bold text-[#617269]">{readinessDisplay}</p>
        </div>
        <ReadinessBar value={activeAgentProgress.readinessPercentage} />
      </div>

      {/* Estimated work + next action */}
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-[8px] bg-[#f4faf6] px-3 py-2">
          <p className="text-[10px] font-black uppercase tracking-wider text-[#7f9187]">Estimated Work</p>
          <p className="mt-1 text-sm font-black text-[#17392b]">{activeAgentProgress.estimatedWork}</p>
        </div>
        <div className="rounded-[8px] bg-[#f4faf6] px-3 py-2">
          <p className="text-[10px] font-black uppercase tracking-wider text-[#7f9187]">Next Action</p>
          <p className="mt-1 text-sm font-black text-[#17392b]">{activeAgentProgress.nextAction}</p>
        </div>
      </div>
    </Panel>
  );
}

type BenchMetricTone = 'success' | 'warning' | 'danger' | 'neutral';

function BenchMetric({ label, value, tone }: { label: string; value: string; tone: BenchMetricTone }) {
  const toneClass: Record<BenchMetricTone, string> = {
    success: 'border-[#b5d6c5] bg-[#e5f4ec] text-[#1C7C54]',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
    danger: 'border-red-200 bg-red-50 text-red-800',
    neutral: 'border-[#dfe9e2] bg-[#f4faf6] text-[#617269]',
  };
  return (
    <div className={`rounded-[8px] border px-3 py-2 ${toneClass[tone]}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.1em] opacity-75">{label}</p>
      <p className="mt-1 text-base font-black">{value}</p>
    </div>
  );
}

// ── Why Not Certified panel ─────────────────────────────────────────────────

function WhyNotCertifiedPanel({
  agentId,
  certificationStatus,
  integrityReport,
  agentRow,
  health,
  lessons,
}: {
  agentId: string;
  certificationStatus: WorkshopCertificationStatus;
  integrityReport: AgentIntegrityReport | null;
  agentRow: AgentRow | null;
  health: HealthData | null;
  lessons: Lesson[];
}) {
  if (certificationStatus === 'certified') return null;

  const agentActiveRootCauses = (
    health?.activeRootCauses ?? health?.rootCauses ?? []
  ).filter((rc) => rc.agentId === agentId);

  const agentLessons = lessons.filter((l) => l.agentId === agentId);

  const message = buildWhyNotCertifiedMessage({
    agentId,
    certificationStatus,
    integrityReport,
    agentRow,
    agentActiveRootCauses,
    agentLessons,
  });

  const tone =
    certificationStatus === 'blocked'
      ? 'border-red-200 bg-red-50'
      : 'border-amber-200 bg-amber-50';

  // Surface the most critical blockers as a bullet list.
  const bullets: string[] = [];

  const criticalRootCauses = agentActiveRootCauses.filter((rc) => rc.severity === 'critical');
  for (const rc of criticalRootCauses.slice(0, 3)) {
    bullets.push(`Critical root cause: "${rc.title}"`);
  }

  const criticalIntegrations = integrityReport?.repairPlan.missingIntegrations.filter(
    (i) => i.severity === 'critical',
  ) ?? [];
  for (const integration of criticalIntegrations.slice(0, 2)) {
    bullets.push(`Missing critical integration: ${integration.integration}`);
  }

  if (agentRow?.status === 'Blocked' && agentRow.blockers.length > 0) {
    bullets.push(...agentRow.blockers.slice(0, 2));
  }

  return (
    <Panel title="Why Not Certified?">
      <div className={`rounded-[8px] border px-4 py-3 ${tone}`}>
        <p className="text-sm font-semibold text-[#17392b]">{message}</p>
      </div>
      {bullets.length > 0 ? (
        <ul className="grid gap-1.5">
          {bullets.map((bullet) => (
            <li key={bullet} className="flex items-start gap-2 text-sm">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" aria-hidden="true" />
              <span className="font-semibold text-[#617269]">{bullet}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </Panel>
  );
}

// ── Recommended Repair Plan panel ───────────────────────────────────────────

function RecommendedRepairPlanPanel({
  agentId,
  integrityReport,
  agentRow,
  health,
  openLessons,
}: {
  agentId: string;
  integrityReport: AgentIntegrityReport | null;
  agentRow: AgentRow | null;
  health: HealthData | null;
  openLessons: number;
}) {
  const agentActiveRootCauses = (
    health?.activeRootCauses ?? health?.rootCauses ?? []
  ).filter((rc) => rc.agentId === agentId);

  const items = buildRepairPlanItems({
    integrityReport,
    agentRow,
    agentActiveRootCauses,
    openLessons,
  });

  if (items.length === 0) {
    return (
      <Panel title="Recommended Repair Plan">
        <EmptyState message="No repair actions required. This agent is ready to certify." />
      </Panel>
    );
  }

  return (
    <Panel title="Recommended Repair Plan">
      <div className="grid gap-2">
        {items.map((item) => (
          <RepairPlanItemRow key={`${item.type}-${item.title}`} item={item} />
        ))}
      </div>
    </Panel>
  );
}

function RepairPlanItemRow({ item }: { item: RepairPlanItem }) {
  const rankColour =
    item.rank === 1
      ? 'bg-red-100 text-red-800'
      : item.rank === 2
        ? 'bg-amber-100 text-amber-800'
        : 'bg-[#e5f4ec] text-[#1C7C54]';

  return (
    <div className="flex items-start gap-3 rounded-[8px] border border-[#dfe9e2] bg-[#f4faf6] px-3 py-3">
      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${rankColour}`}>
        {item.rank}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-black text-[#17392b]">{item.title}</p>
          <SeverityBadge severity={item.severity} />
        </div>
        <p className="mt-1 text-xs font-semibold text-[#617269]">{item.detail}</p>
      </div>
    </div>
  );
}

// ── Workshop Queue panel ────────────────────────────────────────────────────

function QueueItemRow({
  item,
  isDragging,
  isDragOver,
  isFirst,
  isLast,
  onActivate,
  onMoveToBacklog,
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  item: WorkshopQueueItem;
  isDragging: boolean;
  isDragOver: boolean;
  isFirst: boolean;
  isLast: boolean;
  onActivate: (agentId: string) => void;
  onMoveToBacklog: (agentId: string) => void;
  onMoveUp: (agentId: string) => void;
  onMoveDown: (agentId: string) => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onDragEnd: () => void;
}) {
  const isCertified = item.certificationStatus === 'certified';
  const isActive = item.status === 'active';

  const containerClass = [
    'flex items-center gap-3 rounded-[8px] border px-3 py-2.5 transition',
    isActive ? 'border-[#1C7C54] bg-[#e5f4ec]' : 'border-[#dfe9e2] bg-white',
    isCertified ? 'opacity-60' : '',
    isDragging ? 'opacity-40 scale-[0.98]' : '',
    isDragOver && !isDragging ? 'border-[#1C7C54] bg-[#f4faf6]' : '',
    !isCertified ? 'cursor-grab active:cursor-grabbing' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={containerClass}
      draggable={!isCertified}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      aria-label={`${formatAgentDisplayName(item.agentId)} — ${item.certificationStatus}`}
    >
      {/* Position badge */}
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#f4faf6] text-[10px] font-black text-[#617269]">
        {item.position}
      </span>

      {/* Name + status */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-black text-[#17392b]">{formatAgentDisplayName(item.agentId)}</p>
          <CertificationBadge status={item.certificationStatus} />
          {isActive ? (
            <span className="rounded-full bg-[#1C7C54] px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
              Active
            </span>
          ) : null}
        </div>
        <p className="text-[10px] font-semibold text-[#7f9187]">{item.agentId}</p>
      </div>

      {/* Controls — hidden for certified items */}
      {!isCertified ? (
        <div className="flex shrink-0 items-center gap-1">
          {/* Up/down for keyboard/mobile accessibility */}
          <button
            type="button"
            onClick={() => onMoveUp(item.agentId)}
            disabled={isFirst}
            className="rounded p-1 text-[#7f9187] transition hover:bg-[#dfe9e2] disabled:opacity-30"
            aria-label={`Move ${formatAgentDisplayName(item.agentId)} up`}
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => onMoveDown(item.agentId)}
            disabled={isLast}
            className="rounded p-1 text-[#7f9187] transition hover:bg-[#dfe9e2] disabled:opacity-30"
            aria-label={`Move ${formatAgentDisplayName(item.agentId)} down`}
          >
            ↓
          </button>
          {!isActive ? (
            <button
              type="button"
              onClick={() => onActivate(item.agentId)}
              className="rounded-[6px] border border-[#dfe9e2] px-2 py-1 text-[10px] font-black text-[#17392b] transition hover:border-[#1C7C54]"
            >
              Activate
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => onMoveToBacklog(item.agentId)}
            className="rounded-[6px] border border-[#dfe9e2] px-2 py-1 text-[10px] font-black text-[#7f9187] transition hover:border-[#617269]"
          >
            Backlog
          </button>
        </div>
      ) : null}
    </div>
  );
}

function WorkshopQueuePanel({
  queue,
  onActivate,
  onMoveToBacklog,
  onReorder,
}: {
  queue: WorkshopQueueItem[];
  onActivate: (agentId: string) => void;
  onMoveToBacklog: (agentId: string) => void;
  onReorder: (newOrder: string[]) => void;
}) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  if (queue.length === 0) {
    return (
      <Panel title="Workshop Queue">
        <EmptyState message="No agents in the Workshop queue." />
      </Panel>
    );
  }

  const pending = queue.filter((item) => item.certificationStatus !== 'certified');
  const certified = queue.filter((item) => item.certificationStatus === 'certified');

  function handleDragStart(agentId: string) {
    setDraggedId(agentId);
  }

  function handleDragOver(e: React.DragEvent, agentId: string) {
    e.preventDefault();
    setDragOverId(agentId);
  }

  function handleDrop(targetId: string) {
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }
    const pendingIds = pending.map((item) => item.agentId);
    const fromIndex = pendingIds.indexOf(draggedId);
    const toIndex = pendingIds.indexOf(targetId);
    if (fromIndex === -1 || toIndex === -1) return;

    const newOrder = [...pendingIds];
    newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, draggedId);

    // Certified agents always trail — append them after the reordered pending list.
    const certifiedIds = certified.map((item) => item.agentId);
    onReorder([...newOrder, ...certifiedIds]);
    setDraggedId(null);
    setDragOverId(null);
  }

  function handleMoveUp(agentId: string) {
    const ids = queue.map((item) => item.agentId);
    const index = ids.indexOf(agentId);
    if (index <= 0) return;
    const next = [...ids];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    onReorder(next);
  }

  function handleMoveDown(agentId: string) {
    const ids = queue.map((item) => item.agentId);
    const index = ids.indexOf(agentId);
    if (index >= ids.length - 1) return;
    const next = [...ids];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    onReorder(next);
  }

  const allCertified = queue.every((item) => item.certificationStatus === 'certified');

  return (
    <Panel title="Workshop Queue">
      {allCertified ? (
        <div className="rounded-[8px] border border-emerald-200 bg-emerald-50 px-4 py-4 text-center">
          <p className="text-sm font-black text-emerald-800">All agents certified.</p>
          <p className="mt-1 text-xs font-semibold text-emerald-700">
            The Workshop queue is complete. Well done.
          </p>
        </div>
      ) : null}

      {/* Drag hint — desktop only */}
      {!allCertified && pending.length > 1 ? (
        <p className="hidden text-[10px] font-semibold text-[#7f9187] sm:block">
          Drag rows to reorder · use ↑ ↓ buttons on mobile
        </p>
      ) : null}

      {/* Pending / active items */}
      <div className="grid gap-1.5">
        {pending.map((item, index) => (
          <QueueItemRow
            key={item.agentId}
            item={item}
            isDragging={draggedId === item.agentId}
            isDragOver={dragOverId === item.agentId}
            isFirst={index === 0}
            isLast={index === pending.length - 1}
            onActivate={onActivate}
            onMoveToBacklog={onMoveToBacklog}
            onMoveUp={handleMoveUp}
            onMoveDown={handleMoveDown}
            onDragStart={() => handleDragStart(item.agentId)}
            onDragOver={(e) => handleDragOver(e, item.agentId)}
            onDrop={() => handleDrop(item.agentId)}
            onDragEnd={() => {
              setDraggedId(null);
              setDragOverId(null);
            }}
          />
        ))}
      </div>

      {/* Certified section */}
      {certified.length > 0 ? (
        <div className="grid gap-1.5">
          <p className="text-[10px] font-black uppercase tracking-wider text-[#7f9187]">
            Certified ({certified.length})
          </p>
          {certified.map((item) => (
            <QueueItemRow
              key={item.agentId}
              item={item}
              isDragging={false}
              isDragOver={false}
              isFirst={false}
              isLast={false}
              onActivate={onActivate}
              onMoveToBacklog={onMoveToBacklog}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
              onDragStart={() => {}}
              onDragOver={() => {}}
              onDrop={() => {}}
              onDragEnd={() => {}}
            />
          ))}
        </div>
      ) : null}
    </Panel>
  );
}

// ── Main WorkshopTab export ─────────────────────────────────────────────────

export function WorkshopTab({
  workshopState,
  integrityReports,
  health,
  lessons,
  agentRows,
  isBusy,
  onActivateAgent,
  onMoveToBacklog,
  onAdvanceWorkshop,
  onRunTests,
  onViewDoctor,
  onReorderQueue,
}: {
  workshopState: WorkshopState;
  integrityReports: AgentIntegrityReport[] | null;
  health: HealthData | null;
  lessons: Lesson[];
  agentRows: AgentRow[];
  isBusy: boolean;
  onActivateAgent: (agentId: string) => void;
  onMoveToBacklog: (agentId: string) => void;
  onAdvanceWorkshop: () => void;
  onRunTests: () => void;
  onViewDoctor: () => void;
  onReorderQueue: (newOrder: string[]) => void;
}) {
  const { activeAgentId, queue, activeAgentProgress } = workshopState;

  const integrityReport =
    integrityReports?.find((r) => r.agentId === activeAgentId) ?? null;

  const agentRow = agentRows.find((r) => r.agentId === activeAgentId) ?? null;

  const activeItem = queue.find((item) => item.agentId === activeAgentId);
  const certStatus = activeItem?.certificationStatus ?? 'in_progress';

  // Derive active agent root causes and lessons for passing to sub-panels.
  const agentActiveRootCauses = (
    health?.activeRootCauses ?? health?.rootCauses ?? []
  ).filter((rc) => rc.agentId === activeAgentId);

  const agentLessons = lessons.filter((l) => l.agentId === activeAgentId);

  // We need the active agent's progress but the full derivation is already in
  // workshopState.activeAgentProgress — pass open lessons count separately
  // so WhyNotCertified and RepairPlan panels can use it without re-deriving.
  const openLessons = activeAgentProgress.openLessons;

  // "No agents in queue" empty state.
  if (queue.length === 0) {
    return (
      <section className="grid gap-5" aria-label="Agent Workshop">
        <Panel title="Agent Workshop">
          <EmptyState message="No agents are currently in the Workshop queue." />
        </Panel>
      </section>
    );
  }

  // "All agents certified" celebration state.
  const allCertified = queue.every((item) => item.certificationStatus === 'certified');
  if (allCertified) {
    return (
      <section className="grid gap-5" aria-label="Agent Workshop">
        <WorkshopProgressStrip
          certifiedCount={workshopState.certifiedCount}
          totalCount={workshopState.totalCount}
          completionPercentage={workshopState.completionPercentage}
          queue={queue}
        />
        <div className="rounded-[8px] border border-emerald-200 bg-emerald-50 px-6 py-8 text-center">
          <p className="text-2xl font-black text-emerald-800">All agents certified.</p>
          <p className="mt-2 text-sm font-semibold text-emerald-700">
            The Workshop is complete. All agents have passed certification requirements.
          </p>
        </div>
        <WorkshopQueuePanel
          queue={queue}
          onActivate={onActivateAgent}
          onMoveToBacklog={onMoveToBacklog}
          onReorder={onReorderQueue}
        />
      </section>
    );
  }

  // Integrity reports loading state.
  const integrityLoading = integrityReports === null;

  return (
    <section className="grid gap-5" aria-label="Agent Workshop">
      {/* 1. Workshop progress strip */}
      <WorkshopProgressStrip
        certifiedCount={workshopState.certifiedCount}
        totalCount={workshopState.totalCount}
        completionPercentage={workshopState.completionPercentage}
        queue={queue}
      />

      {/* 2. Currently on bench */}
      <CurrentlyOnBenchPanel
        workshopState={workshopState}
        integrityReport={integrityReport}
        agentRow={agentRow}
        health={health}
        lessons={lessons}
        onRunTests={onRunTests}
        onViewDoctor={onViewDoctor}
        onAdvanceWorkshop={onAdvanceWorkshop}
      />

      {/* 3. Two-column layout on wide screens: Why-not / Repair plan */}
      <div className="grid gap-5 xl:grid-cols-2">
        {/* Why Not Certified */}
        {certStatus !== 'certified' ? (
          integrityLoading ? (
            <Panel title="Why Not Certified?">
              <div className="rounded-[8px] bg-[#f4faf6] px-4 py-3 text-sm font-semibold text-[#617269]">
                Loading integrity data…
              </div>
            </Panel>
          ) : (
            <WhyNotCertifiedPanel
              agentId={activeAgentId}
              certificationStatus={certStatus}
              integrityReport={integrityReport}
              agentRow={agentRow}
              health={health}
              lessons={lessons}
            />
          )
        ) : (
          <Panel title="Why Not Certified?">
            <div className="rounded-[8px] border border-emerald-200 bg-emerald-50 px-4 py-3">
              <p className="text-sm font-semibold text-emerald-800">
                This agent has passed all certification requirements.
              </p>
            </div>
          </Panel>
        )}

        {/* Recommended Repair Plan */}
        {integrityLoading ? (
          <Panel title="Recommended Repair Plan">
            <div className="rounded-[8px] bg-[#f4faf6] px-4 py-3 text-sm font-semibold text-[#617269]">
              Loading repair plan…
            </div>
          </Panel>
        ) : (
          <RecommendedRepairPlanPanel
            agentId={activeAgentId}
            integrityReport={integrityReport}
            agentRow={agentRow}
            health={health}
            openLessons={openLessons}
          />
        )}
      </div>

      {/* 4. Workshop Queue */}
      <WorkshopQueuePanel
        queue={queue}
        onActivate={onActivateAgent}
        onMoveToBacklog={onMoveToBacklog}
        onReorder={onReorderQueue}
      />

      {/* 5. Advance Workshop action bar — shown when active agent is certified and there is a next agent */}
      {certStatus === 'certified' ? (
        <div className="flex items-center justify-between rounded-[8px] border border-[#1C7C54] bg-[#e5f4ec] px-4 py-3">
          <div>
            <p className="text-sm font-black text-[#17392b]">
              {formatAgentDisplayName(activeAgentId)} is certified.
            </p>
            <p className="text-xs font-semibold text-[#617269]">
              Advance the Workshop to focus on the next agent.
            </p>
          </div>
          <button
            type="button"
            onClick={onAdvanceWorkshop}
            disabled={isBusy}
            className="rounded-[6px] border border-[#1C7C54] bg-[#1C7C54] px-4 py-2 text-sm font-black text-white transition hover:bg-[#17392b] disabled:opacity-50"
          >
            Advance Workshop →
          </button>
        </div>
      ) : null}
    </section>
  );
}
