'use client';

import dynamic from 'next/dynamic';

// The old, detailed money workspace. Hidden from the menu.
const MoneyFlowWorkspace = dynamic(() => import('../MoneyFlowWorkspace'), { ssr: false });

export default function AllMoneyPage() {
  return <MoneyFlowWorkspace />;
}
