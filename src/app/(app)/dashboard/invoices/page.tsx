'use client';

import dynamic from 'next/dynamic';

const MoneyFlowWorkspace = dynamic(() => import('./MoneyFlowWorkspace'), {
  ssr: false,
  loading: () => <div className="h-96 w-full animate-pulse rounded-2xl bg-slate-100" />,
});

export default function MoneyPage() {
  return <MoneyFlowWorkspace />;
}
