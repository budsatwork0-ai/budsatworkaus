'use client';

import dynamic from 'next/dynamic';

// Existing MarketingStudioTab promoted to standalone route.
// Component handles its own data fetching and graceful degradation
// (renders an activation empty-state if migration 077_marketing_studio.sql is not applied).
const MarketingStudioTab = dynamic(
  () => import('../components/tabs/MarketingStudioTab'),
  { ssr: false },
);

export default function MarketingPage() {
  return <MarketingStudioTab />;
}
