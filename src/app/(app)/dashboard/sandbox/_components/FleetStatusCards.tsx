'use client';

import { useState } from 'react';
import type { AgentRow, FleetBucket, OperatorIntelligence, TrendDirection } from '../_lib/types';
import { fmtF1, pct } from '../_lib/format';
import { promotionReason, trendLabel } from '../_lib/agents';
import { CloseButton, EmptyState, PromotionChip, SmallButton, TrendBadge } from './ui';

export function FleetStatusCards({
  buckets,
  onFilter,
  intelligence,
}: {
  buckets: Record<FleetBucket, AgentRow[]>;
  onFilter: (bucket: FleetBucket) => void;
  intelligence: OperatorIntelligence;
}) {
  const [expandedBucket, setExpandedBucket] = useState<FleetBucket | null>(null);
  const [query, setQuery] = useState('');
  const cards: Array<{ key: FleetBucket; title: string; description: string; tone: string; trend: TrendDirection }> = [
    { key: 'promote', title: 'Ready to Promote', description: 'Passing, stable, and no active blockers', tone: 'border-[#b5d6c5] bg-[#f5fbf7]', trend: intelligence.readyToPromoteTrend },
    { key: 'investigate', title: 'Investigate', description: 'Root causes, regressions, or low confidence', tone: 'border-amber-300 bg-amber-50', trend: intelligence.rootCausesTrend },
    { key: 'blocked', title: 'Blocked', description: 'Critical issue or failing scenario blocks promotion', tone: 'border-red-200 bg-red-50', trend: intelligence.rootCausesTrend },
    { key: 'monitor', title: 'Healthy / Monitor', description: 'Healthy enough to observe, not promote yet', tone: 'border-[#dfe9e2] bg-white', trend: 'unchanged' },
  ];
  const expandedAgents = expandedBucket ? buckets[expandedBucket] : [];
  const filteredExpandedAgents = expandedAgents.filter((agent) => {
    const search = query.trim().toLowerCase();
    if (!search) return true;
    return (
      agent.agentId.toLowerCase().includes(search) ||
      promotionReason(agent).toLowerCase().includes(search) ||
      agent.recommendation.toLowerCase().includes(search)
    );
  });

  return (
    <>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const agents = buckets[card.key];
          const topAgents = agents.slice(0, 3);
          const hiddenCount = Math.max(0, agents.length - topAgents.length);
          return (
            <div
              key={card.key}
              className={`rounded-[8px] border px-4 py-4 shadow-[0_12px_32px_rgba(15,61,46,0.05)] ${card.tone}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-black text-[#17392b]">{card.title}</p>
                    <TrendBadge direction={card.trend} period="vs yesterday" />
                  </div>
                  <p className="text-xs font-semibold text-[#617269]">{card.description}</p>
                </div>
                <span className="text-2xl font-black text-[#17392b]">{agents.length}</span>
              </div>
              <div className="mt-3 grid gap-2">
                {topAgents.length > 0 ? topAgents.map((agent) => (
                  <div key={agent.agentId} className="rounded-[6px] bg-white/70 px-2 py-1.5">
                    <p className="truncate text-xs font-black text-[#17392b]">{agent.agentId}</p>
                    <p className="truncate text-[11px] font-semibold text-[#617269]">{promotionReason(agent)}</p>
                  </div>
                )) : <p className="text-xs font-bold text-[#7f9187]">None</p>}
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                {hiddenCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setExpandedBucket(card.key);
                      setQuery('');
                    }}
                    className="text-xs font-black text-[#1C7C54] hover:text-[#17392b]"
                  >
                    +{hiddenCount} more
                  </button>
                ) : <span />}
                <button type="button" onClick={() => onFilter(card.key)} className="text-xs font-black text-[#17392b] hover:text-[#1C7C54]">
                  View Agents →
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {expandedBucket ? (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setExpandedBucket(null)} />
          <aside role="dialog" aria-modal="true" aria-label="Fleet agents" className="fixed bottom-3 right-3 top-3 z-50 w-[calc(100vw-1.5rem)] max-w-xl overflow-y-auto rounded-[8px] bg-white px-5 py-5 shadow-[-20px_0_60px_rgba(15,61,46,0.18)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#7f9187]">Fleet agents</p>
                <h2 className="text-xl font-black text-[#17392b]">{cards.find((card) => card.key === expandedBucket)?.title}</h2>
                <p className="text-sm font-semibold text-[#617269]">{expandedAgents.length} agents in this bucket</p>
              </div>
              <CloseButton onClose={() => setExpandedBucket(null)} />
            </div>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search agents or reasons"
              className="mt-4 w-full rounded-[6px] border border-[#dfe9e2] px-3 py-2 text-sm font-semibold text-[#17392b] outline-none transition focus:border-[#1C7C54]"
            />
            <div className="mt-4 grid gap-2">
              {filteredExpandedAgents.map((agent) => (
                <div key={agent.agentId} className="rounded-[8px] border border-[#dfe9e2] px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-black text-[#17392b]">{agent.agentId}</p>
                    <PromotionChip status={agent.status} />
                  </div>
                  <p className="mt-1 text-xs font-semibold text-[#617269]">{promotionReason(agent)}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#7f9187]">F1 {fmtF1(agent.f1)} · Pass {agent.passRate === null ? 'No pass rate' : pct(agent.passRate)} · {trendLabel(agent.trend)}</p>
                </div>
              ))}
              {filteredExpandedAgents.length === 0 ? <EmptyState message="No agents match this search." /> : null}
            </div>
            <div className="mt-4">
              <SmallButton onClick={() => {
                onFilter(expandedBucket);
                setExpandedBucket(null);
              }}>
                View Agents →
              </SmallButton>
            </div>
          </aside>
        </>
      ) : null}
    </>
  );
}
