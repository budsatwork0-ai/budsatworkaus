'use client';

import { useState } from 'react';
import type { DevOsResponse } from '@/app/api/dev-os/route';
import { BudTerminal } from './BudTerminal';
import { DevOsTab } from './DevOsTab';
import { DesignSystemTab } from './DesignSystemTab';
import { GraphifyTab } from './GraphifyTab';
import { EvidenceTab } from './EvidenceTab';

type Section = 'terminal' | 'dev-os' | 'design' | 'graphify' | 'evidence' | 'architecture';
type Badge = 'Active' | 'Read Only' | 'Report' | 'Placeholder';

const BADGE_STYLE: Record<Badge, string> = {
  'Active':      'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  'Read Only':   'border-white/10 bg-white/[0.04] text-white/40',
  'Report':      'border-sky-500/30 bg-sky-500/10 text-sky-400',
  'Placeholder': 'border-slate-500/20 bg-slate-500/[0.06] text-slate-400',
};

const SECTIONS: { key: Section; label: string; sub: string; badge: Badge }[] = [
  { key: 'terminal',     label: 'Terminal',      sub: 'Interactive Bud chat and commands',            badge: 'Active'      },
  { key: 'graphify',     label: 'Graphify',       sub: 'Knowledge-graph map of the codebase',          badge: 'Read Only'   },
  { key: 'dev-os',       label: 'Dev OS',         sub: 'Agent workflow reference and session history', badge: 'Read Only'   },
  { key: 'design',       label: 'Design System',  sub: 'Design system tokens and integrity audit',     badge: 'Report'      },
  { key: 'evidence',     label: 'Evidence',       sub: 'Terminal output, deploy records, QA results',  badge: 'Report'      },
  { key: 'architecture', label: 'Architecture',   sub: 'System map, design decisions, ADR log',        badge: 'Placeholder' },
];

/* ── Architecture stub ───────────────────────────────────────────────────── */

function ArchitectureStub() {
  return (
    <div className="space-y-3">
      {/* Status banner */}
      <div className="flex items-center gap-2.5 rounded-xl border border-slate-500/20 bg-slate-500/[0.05] px-4 py-3">
        <span className="inline-flex items-center rounded border border-slate-500/25 bg-slate-500/10 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider text-slate-400">
          Planned
        </span>
        <p className="text-[12px] text-white/50">
          This section is not yet live. Resources below are available now via other tools.
        </p>
      </div>

      {/* What will be here */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">
          Planned contents
        </p>
        <ul className="space-y-2 text-sm text-white/55">
          <li className="flex items-start gap-2">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-white/20" />
            <span><strong className="text-white/70">System map</strong> — visual dependency graph derived from Graphify (use Graphify tab now)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-white/20" />
            <span><strong className="text-white/70">ADR log</strong> — architecture decision records from <code className="rounded bg-white/[0.06] px-1 text-[11px] text-white/60">Buds At Work/01 Architecture/</code></span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-white/20" />
            <span><strong className="text-white/70">Wiki</strong> — generated from <code className="rounded bg-white/[0.06] px-1 text-[11px] text-white/60">graphify-out/wiki/index.md</code> (run deep extract first)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-white/20" />
            <span><strong className="text-white/70">Autonomy pipeline</strong> — <code className="rounded bg-white/[0.06] px-1 text-[11px] text-white/60">mission-control-autonomy/</code> is designed but not yet mounted</span>
          </li>
        </ul>
      </div>

      {/* Current workarounds */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30 mb-2">
          Access architecture context now
        </p>
        <div className="space-y-1.5 font-mono text-[11px] text-white/45">
          <p><span className="text-white/25">graphify →</span> query &quot;&lt;concept&gt;&quot; — scoped subgraph</p>
          <p><span className="text-white/25">graphify →</span> path &quot;&lt;A&gt;&quot; &quot;&lt;B&gt;&quot; — trace dependencies</p>
          <p><span className="text-white/25">vault →</span> Buds At Work/01 Architecture/</p>
          <p><span className="text-white/25">claude.md →</span> architecture principles and anti-patterns</p>
        </div>
      </div>
    </div>
  );
}

/* ── main component ───────────────────────────────────────────────────────── */

export function DevTab({ devOs }: { devOs: DevOsResponse }) {
  const [section, setSection] = useState<Section>('terminal');

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center gap-2.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/25">
          Development Command
        </span>
        <span className="inline-flex items-center rounded border border-white/10 bg-white/[0.04] px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider text-white/40">
          Development
        </span>
      </div>

      {/* Tool picker */}
      <div className="flex flex-wrap gap-2">
        {SECTIONS.map(({ key, label, sub, badge }) => {
          const active = section === key;
          const isPlaceholder = badge === 'Placeholder';
          return (
            <button
              key={key}
              onClick={() => setSection(key)}
              className={`rounded-xl border px-4 py-3 text-left transition ${
                active
                  ? 'border-white/20 bg-white/[0.06]'
                  : isPlaceholder
                    ? 'border-white/[0.04] bg-transparent opacity-60 hover:opacity-80'
                    : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]'
              }`}
            >
              <div className="mb-0.5 flex items-center gap-2">
                <p className={`text-sm font-semibold ${active ? 'text-white' : 'text-white/55'}`}>{label}</p>
                <span className={`inline-flex items-center rounded border px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider ${BADGE_STYLE[badge]}`}>
                  {badge}
                </span>
              </div>
              <p className="text-[11px] text-white/35">{sub}</p>
            </button>
          );
        })}
      </div>

      {section === 'terminal'     && <BudTerminal />}
      {section === 'graphify'     && <GraphifyTab />}
      {section === 'dev-os'       && <DevOsTab devOs={devOs} />}
      {section === 'design'       && <DesignSystemTab />}
      {section === 'evidence'     && <EvidenceTab />}
      {section === 'architecture' && <ArchitectureStub />}
    </div>
  );
}
