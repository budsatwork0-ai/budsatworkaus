'use client';

import dynamic from 'next/dynamic';

// Existing BudLeadsWorkspace promoted to standalone route.
// Component handles its own data fetching via useDashboardData('full').
const BudLeadsWorkspace = dynamic(
  () => import('../insights/leads/BudLeadsWorkspace'),
  { ssr: false },
);

export default function LeadsPage() {
  return <BudLeadsWorkspace />;
}
