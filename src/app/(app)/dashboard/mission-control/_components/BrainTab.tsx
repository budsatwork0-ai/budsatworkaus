'use client';

import { useState } from 'react';
import { GraphifyTab } from './GraphifyTab';
import { EvidenceTab } from './EvidenceTab';

type Section = 'graphify' | 'evidence';

const SECTIONS: { key: Section; label: string; sub: string }[] = [
  { key: 'graphify', label: 'Graphify', sub: 'Knowledge-graph map of the codebase' },
  { key: 'evidence', label: 'Evidence log', sub: 'Terminal output, deploy records, QA results' },
];

export function BrainTab() {
  const [section, setSection] = useState<Section>('graphify');

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
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

      {section === 'graphify' && <GraphifyTab />}
      {section === 'evidence' && <EvidenceTab />}
    </div>
  );
}
