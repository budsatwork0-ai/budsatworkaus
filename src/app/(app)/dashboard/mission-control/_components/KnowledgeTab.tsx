'use client';

import { useState } from 'react';
import { ObsidianTab } from './ObsidianTab';
import { EvidenceTab } from './EvidenceTab';

type Section = 'notes' | 'evidence';

const SECTIONS: { key: Section; label: string; sub: string }[] = [
  { key: 'notes',    label: 'Architecture notes', sub: 'Obsidian vault — systems, components, refactor plans' },
  { key: 'evidence', label: 'Evidence log',        sub: 'Terminal output, deployment records, QA results' },
];

export function KnowledgeTab() {
  const [section, setSection] = useState<Section>('notes');

  return (
    <div className="space-y-4">
      {/* Section switcher */}
      <div className="flex gap-2">
        {SECTIONS.map(({ key, label, sub }) => {
          const active = section === key;
          return (
            <button
              key={key}
              onClick={() => setSection(key)}
              className={`flex-1 rounded-xl border px-4 py-3 text-left transition ${
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

      {/* Content — each tab manages its own fetch */}
      {section === 'notes'    && <ObsidianTab />}
      {section === 'evidence' && <EvidenceTab />}
    </div>
  );
}
