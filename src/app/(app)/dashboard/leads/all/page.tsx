'use client';

import dynamic from 'next/dynamic';

// The old, detailed leads workspace. Hidden from the menu.
const BudLeadsWorkspace = dynamic(
  () => import('../../insights/leads/BudLeadsWorkspace'),
  { ssr: false },
);

export default function AllLeadsPage() {
  return <BudLeadsWorkspace />;
}
