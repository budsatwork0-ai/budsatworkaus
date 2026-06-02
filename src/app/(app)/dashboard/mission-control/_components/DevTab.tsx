'use client';

import { useState } from 'react';
import type { DevOsResponse } from '@/app/api/dev-os/route';
import { BudTerminal } from './BudTerminal';
import { DevOsTab } from './DevOsTab';
import { DesignSystemTab } from './DesignSystemTab';

type Section = 'terminal' | 'dev-os' | 'design';

const SECTIONS: { key: Section; label: string; sub: string }[] = [
  { key: 'terminal', label: 'Terminal', sub: 'Interactive Bud chat and commands' },
  { key: 'dev-os',   label: 'Dev OS',   sub: 'Agent workflow reference and session history' },
  { key: 'design',   label: 'Design',   sub: 'Design system tokens, integrity audit' },
];

export function DevTab({ devOs }: { devOs: DevOsResponse }) {
  const [section, setSection] = useState<Section>('terminal');

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

      {section === 'terminal' && <BudTerminal />}
      {section === 'dev-os'   && <DevOsTab devOs={devOs} />}
      {section === 'design'   && <DesignSystemTab />}
    </div>
  );
}
