'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BUD_CLUSTERS } from '@/lib/bud/types';
import type { AgentHealthLabel } from '@/lib/bud/health';

type AgentLifecycleState =
  | 'active' | 'idle' | 'awaiting_review' | 'degraded'
  | 'blocked' | 'overloaded' | 'dormant' | 'retired';

interface AgentRow {
  id: string;
  name: string;
  category: string;
  status: string;
}

interface Props {
  agents: AgentRow[];
  agentStates: Record<string, AgentLifecycleState>;
  agentHealth: Record<string, { label: AgentHealthLabel; score: number }>;
}

const LIFECYCLE_DOT: Record<AgentLifecycleState, string> = {
  active:          'bg-emerald-400 animate-pulse',
  idle:            'bg-slate-300',
  awaiting_review: 'bg-amber-400',
  degraded:        'bg-red-400 animate-pulse',
  blocked:         'bg-orange-400',
  overloaded:      'bg-amber-500 animate-pulse',
  dormant:         'bg-slate-200',
  retired:         'bg-slate-200',
};

const HEALTH_BADGE: Record<AgentHealthLabel, string> = {
  healthy:      'text-emerald-600 bg-emerald-50 border-emerald-100',
  watch:        'text-amber-600 bg-amber-50 border-amber-100',
  needs_repair: 'text-orange-600 bg-orange-50 border-orange-100',
  broken:       'text-red-600 bg-red-50 border-red-100',
  inactive:     'text-slate-400 bg-slate-50 border-slate-100',
};

const CLUSTER_COLORS: Record<string, string> = {
  Ops:            'text-violet-600',
  Growth:         'text-emerald-600',
  Intelligence:   'text-blue-600',
  Finance:        'text-teal-600',
  Infrastructure: 'text-slate-600',
  Customer:       'text-orange-600',
};

export function AgentHierarchy({ agents, agentStates, agentHealth }: Props) {
  const [openClusters, setOpenClusters] = useState<Set<string>>(new Set(['Ops']));
  const agentMap = new Map(agents.map((a) => [a.id, a]));

  function toggleCluster(name: string) {
    setOpenClusters((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  return (
    <div className="space-y-2">
      {/* Bud at the top */}
      <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
        <span className="text-[11px] font-semibold text-white">Bud</span>
        <span className="text-[10px] text-slate-400 ml-1">Autonomous Orchestrator</span>
        <span className="ml-auto text-[9px] font-medium text-emerald-400 bg-emerald-950 border border-emerald-800 rounded-full px-1.5 py-0.5">
          Active
        </span>
      </div>

      {/* Clusters */}
      {Object.entries(BUD_CLUSTERS).map(([clusterName, agentIds]) => {
        const isOpen = openClusters.has(clusterName);
        const clusterAgents = agentIds
          .map((id) => agentMap.get(id))
          .filter((a): a is AgentRow => a !== undefined);

        const degradedCount = clusterAgents.filter((a) =>
          ['degraded', 'overloaded', 'blocked'].includes(agentStates[a.id] ?? 'idle'),
        ).length;
        const activeCount = clusterAgents.filter((a) => agentStates[a.id] === 'active').length;
        const colorClass = CLUSTER_COLORS[clusterName] ?? 'text-slate-600';

        return (
          <div key={clusterName} className="rounded-xl border border-black/[0.06] overflow-hidden">
            <button
              onClick={() => toggleCluster(clusterName)}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-black/[0.02] transition-colors text-left"
            >
              <span className={`text-[10px] font-semibold uppercase tracking-wide ${colorClass}`}>
                {clusterName}
              </span>
              <span className="text-[10px] text-slate-400">{clusterAgents.length} agents</span>
              {activeCount > 0 && (
                <span className="text-[9px] font-medium text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-full px-1.5 py-0.5">
                  {activeCount} active
                </span>
              )}
              {degradedCount > 0 && (
                <span className="text-[9px] font-medium text-red-600 bg-red-50 border border-red-100 rounded-full px-1.5 py-0.5">
                  {degradedCount} degraded
                </span>
              )}
              <span className="ml-auto text-[10px] text-slate-400">{isOpen ? '▲' : '▼'}</span>
            </button>

            {isOpen && (
              <div className="px-3 pb-2 space-y-1 border-t border-black/[0.04]">
                {clusterAgents.map((agent) => {
                  const lifecycle = agentStates[agent.id] ?? 'dormant';
                  const health = agentHealth[agent.id];
                  const dot = LIFECYCLE_DOT[lifecycle] ?? 'bg-slate-300';
                  const healthBadge = health ? HEALTH_BADGE[health.label] : HEALTH_BADGE.inactive;
                  const healthLabel = health?.label ?? 'inactive';

                  return (
                    <Link
                      key={agent.id}
                      href={`/dashboard/agents/${agent.id}`}
                      className="flex items-center gap-2 py-1.5 hover:bg-black/[0.02] rounded-lg px-1 -mx-1 transition-colors"
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${dot} flex-shrink-0`} />
                      <span className="text-[11px] text-slate-700 truncate flex-1">{agent.name}</span>
                      <span className={`text-[9px] font-medium border rounded-full px-1.5 py-0.5 flex-shrink-0 ${healthBadge}`}>
                        {healthLabel.replace('_', ' ')}
                      </span>
                    </Link>
                  );
                })}
                {clusterAgents.length === 0 && (
                  <p className="text-[10px] text-slate-400 py-1 italic">No agents in this cluster</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
