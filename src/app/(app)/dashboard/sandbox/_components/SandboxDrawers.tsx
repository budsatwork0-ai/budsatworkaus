'use client';

import type { SandboxScenarioTemplate } from '@/lib/sandbox/scenarios';
import type { HealthData, HistoryRow, Lesson, PackResult } from '../_lib/types';
import { isPass, pct } from '../_lib/format';
import { ActionComparePanel, CloseButton, DrawerSection, EmptyState, LessonCard, MiniMetric, SummaryLine } from './ui';
import { RunHistoryTable, RootCauseCard, ProposalCard } from './SandboxTabs';

export function AgentDetailDrawer({
  agentId,
  health,
  history,
  lessons,
  scenarios,
  onClose,
  onSelectRun,
}: {
  agentId: string;
  health: HealthData | null;
  history: HistoryRow[];
  lessons: Lesson[];
  scenarios: SandboxScenarioTemplate[];
  onClose: () => void;
  onSelectRun: (row: HistoryRow) => void;
}) {
  const rootCauses = (health?.activeRootCauses ?? health?.rootCauses ?? []).filter((rc) => rc.agentId === agentId);
  const proposals = (health?.proposals ?? []).filter((proposal) => proposal.affectedAgent === agentId);
  const runs = history.filter((row) => row.scenario.agentId === agentId).slice(0, 12);
  const agentLessons = lessons.filter((lesson) => lesson.agentId === agentId).slice(0, 12);
  const failing = (health?.failingScenarios ?? []).filter((scenario) => scenario.agentId === agentId);
  const agentScenarios = scenarios.filter((scenario) => scenario.agentId === agentId);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <aside role="dialog" aria-modal="true" aria-label={`Agent detail for ${agentId}`} className="fixed bottom-0 right-0 top-0 z-50 w-full max-w-2xl overflow-y-auto bg-white px-5 py-5 shadow-[-20px_0_60px_rgba(15,61,46,0.18)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#7f9187]">Agent detail</p>
            <h2 className="text-xl font-black text-[#17392b]">{agentId}</h2>
            <p className="text-sm font-semibold text-[#617269]">{agentScenarios.length} scenario templates</p>
          </div>
          <CloseButton onClose={onClose} />
        </div>
        <div className="mt-4 grid gap-4">
          <DrawerSection title={`Failing scenarios (${failing.length})`}>
            {failing.length > 0 ? failing.map((scenario) => (
              <SummaryLine key={scenario.scenarioId} label={scenario.title} value={`F1 ${scenario.f1.toFixed(2)} - ${new Date(scenario.scoredAt).toLocaleString()}`} />
            )) : <EmptyState message="No current failing scenarios for this agent." />}
          </DrawerSection>
          <DrawerSection title="Recent runs">
            <RunHistoryTable history={runs} onSelect={onSelectRun} />
          </DrawerSection>
          <DrawerSection title={`Lessons (${agentLessons.length})`}>
            {agentLessons.length > 0 ? agentLessons.map((lesson) => <LessonCard key={lesson.id} lesson={lesson} />) : <EmptyState message="No lessons for this agent." />}
          </DrawerSection>
          <DrawerSection title={`Root causes (${rootCauses.length})`}>
            {rootCauses.length > 0 ? rootCauses.map((rc) => <RootCauseCard key={rc.key} rootCause={rc} />) : <EmptyState message="No active root causes for this agent." />}
          </DrawerSection>
          <DrawerSection title={`Proposals (${proposals.length})`}>
            {proposals.length > 0 ? proposals.map((proposal) => <ProposalCard key={proposal.id} proposal={proposal} />) : <EmptyState message="No proposals for this agent." />}
          </DrawerSection>
        </div>
      </aside>
    </>
  );
}

export function ScenarioResultDrawer({ result, onClose }: { result: PackResult; onClose: () => void }) {
  const actualActionTypes = result.result.proposedActions.map((action) => action.action_type).filter(Boolean);
  const expectedSet = new Set(result.expectedActionTypes);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <aside role="dialog" aria-modal="true" aria-label={`Scenario result for ${result.scenarioTitle}`} className="fixed bottom-0 right-0 top-0 z-50 w-full max-w-xl overflow-y-auto bg-white px-5 py-5 shadow-[-20px_0_60px_rgba(15,61,46,0.18)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#7f9187]">Scenario Result</p>
            <h2 className="text-xl font-black text-[#17392b]">{result.scenarioTitle}</h2>
            <p className="text-sm font-semibold text-[#617269]">{result.agentId}</p>
          </div>
          <CloseButton onClose={onClose} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MiniMetric label="Result" value={isPass(result.result) ? 'PASS' : 'FAIL'} />
          <MiniMetric label="Precision" value={pct(result.result.score.precisionScore)} />
          <MiniMetric label="Recall" value={pct(result.result.score.recallScore)} />
          <MiniMetric label="F1" value={result.result.score.f1Score.toFixed(2)} />
        </div>
        <div className="mt-4 grid gap-3">
          <ActionComparePanel title="Expected Actions" actions={result.expectedActionTypes} />
          <ActionComparePanel title="Actual Actions" actions={actualActionTypes} expectedSet={expectedSet} />
        </div>
        <section className="mt-4 rounded-[8px] border border-[#dfe9e2] bg-[#f4faf6] px-4 py-3">
          <h3 className="text-sm font-black text-[#17392b]">Summary</h3>
          <p className="mt-1 text-sm font-semibold text-[#617269]">{result.result.summary || 'No summary returned.'}</p>
        </section>
        <section className="mt-4 rounded-[8px] border border-[#dfe9e2] px-4 py-3">
          <h3 className="text-sm font-black text-[#17392b]">Proposed Action Details</h3>
          {result.result.proposedActions.length > 0 ? (
            <div className="mt-2 grid gap-2">
              {result.result.proposedActions.map((action, index) => (
                <div key={`${action.action_type}-${index}`} className="rounded-[8px] bg-[#f4faf6] px-3 py-2">
                  <p className="text-xs font-black text-[#17392b]">{action.action_type}</p>
                  {action.preview ? <p className="text-xs font-semibold text-[#617269]">{action.preview}</p> : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm font-semibold text-[#7f9187]">No actions proposed.</p>
          )}
        </section>
      </aside>
    </>
  );
}
