'use client';

import { ErrorDisplay } from '@/components/ErrorDisplay';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorDisplay
      error={error}
      reset={reset}
      title="Dashboard Error"
      variant="dashboard"
    />
  );
}
