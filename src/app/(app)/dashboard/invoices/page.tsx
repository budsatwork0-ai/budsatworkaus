'use client';

import { useState } from 'react';
import { brand } from '@/app/ui/theme';
import { useDashboardData } from '../hooks/useDashboardData';
import OverviewTab from '../components/tabs/OverviewTab';
import ReceivablesTab from '../components/tabs/ReceivablesTab';
import PayablesTab from '../components/tabs/PayablesTab';
import SettlementsTab from '../components/tabs/SettlementsTab';
import SubscriptionsPage from '../subscriptions/page';

type Tab = 'overview' | 'invoices' | 'expenses' | 'settlements' | 'subscriptions';

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview',      label: 'Overview'         },
  { key: 'invoices',      label: 'Invoices'          },
  { key: 'expenses',      label: 'Expenses'          },
  { key: 'settlements',   label: 'NAB Settlements'   },
  { key: 'subscriptions', label: 'Subscriptions'     },
];

export default function MoneyPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const { metrics, receivables, payables, payouts, recentActivity, isLoading } = useDashboardData();

  return (
    <div className="grid gap-6 w-full px-4 md:px-10 lg:px-12 pb-14">
      {/* Tab strip */}
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

      {tab === 'overview' && (
        <OverviewTab
          metrics={metrics}
          recentActivity={recentActivity}
          isLoading={isLoading}
        />
      )}

      {tab === 'invoices' && (
        <ReceivablesTab
          receivables={receivables}
          isLoading={isLoading}
          onRowClick={() => {}}
        />
      )}

      {tab === 'expenses' && (
        <PayablesTab
          payables={payables}
          isLoading={isLoading}
          onRowClick={() => {}}
        />
      )}

      {tab === 'settlements' && (
        <SettlementsTab
          payouts={payouts}
          isLoading={isLoading}
        />
      )}

      {tab === 'subscriptions' && <SubscriptionsPage />}
    </div>
  );
}
