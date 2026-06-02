'use client';

import { useState } from 'react';
import type { DevOsResponse } from '@/app/api/dev-os/route';
import { EvidenceTab } from './EvidenceTab';
import { GraphifyTab } from './GraphifyTab';
import { ImprovementsTab } from './ImprovementsTab';
import { DevOsTab } from './DevOsTab';

/**
 * Knowledge hub — consolidates every reference / intelligence surface behind
 * one top-level tab so the console nav stays at three operational tabs
 * (Overview · Terminal · Knowledge).
 *
 * Sections:
 *   notes        — Obsidian architecture vault
 *   evidence     — terminal output / deploy / QA evidence log
 *   graphify     — knowledge-graph architecture report
 *   improvements — tracked improvement backlog
 *   dev-os       — development agent layer + session history
 */

type Section = 'evidence' | 'graphify' | 'improvements' | 'dev-os';

const SECTIONS: { key: Section; label: string; sub: string }[] = [
  { key: 'evidence',     label: 'Evidence log',        sub: 'Terminal output, deployment records, QA results' },
  { key: 'graphify',     label: 'Graphify',            sub: 'Knowledge-graph map of the codebase' },
  { key: 'improvements', label: 'Improvements',        sub: 'Tracked backlog of fixes and refactors' },
  { key: 'dev-os',       label: 'Dev OS',              sub: 'Development agent layer + session history' },
];

export function KnowledgeTab({ devOs }: { devOs: DevOsResponse }) {
  const [section, setSection] = useState<Section>('evidence');

  return (
    <div className="space-y-4">
      {/* Section switcher */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {SECTIONS.map(({ key, label, sub }) => {
          const active = section === key;
          return (
            <button
              key={key}
              onClick={() => setSection(key)}
              className={`rounded-xl border px-4 py-3 text-left transition ${
                active
                  ? 'border-white/20 bg-white/[0.06]'
                  : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]'
              }`}
            >
              <p className={`text-sm font-semibold ${active ? 'text-white' : 'text-white/55'}`}>{label}</p>
              <p className="mt-0.5 text-[11px] text-white/35">{sub}</p>
            </button>
          );
        })}
      </div>

      {/* Content — each section manages its own fetch */}
      {section === 'evidence'     && <EvidenceTab />}
      {section === 'graphify'     && <GraphifyTab />}
      {section === 'improvements' && <ImprovementsTab />}
      {section === 'dev-os'       && <DevOsTab devOs={devOs} />}
    </div>
  );
}
