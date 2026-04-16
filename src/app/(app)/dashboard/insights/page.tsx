'use client';

import { useState } from 'react';
import { brand } from '@/app/ui/theme';
import ReportsPage from '../reports/page';
import VisitorsTab from '../components/tabs/VisitorsTab';

type Tab = 'reports' | 'visitors';

const TABS: { key: Tab; label: string }[] = [
  { key: 'reports',  label: 'Reports'  },
  { key: 'visitors', label: 'Visitors' },
];

export default function InsightsPage() {
  const [tab, setTab] = useState<Tab>('reports');

  return (
    <div>
      <div className="px-4 md:px-10 lg:px-12 pb-4">
        <div className="flex gap-1 p-1 rounded-xl bg-white/60 border border-black/5 w-fit">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors"
              style={
                tab === t.key
                  ? { background: brand.primary, color: 'white' }
                  : { color: brand.muted }
              }
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'reports' && (
        <div className="px-4 md:px-10 lg:px-12 pb-14">
          <ReportsPage />
        </div>
      )}
      {tab === 'visitors' && (
        <div className="px-4 md:px-10 lg:px-12 pb-14">
          <VisitorsTab />
        </div>
      )}
    </div>
  );
}
