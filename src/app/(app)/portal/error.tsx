'use client';

import { ErrorDisplay } from '@/components/ErrorDisplay';

export default function PortalError({
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
      title="Portal Error"
      variant="default"
    />
  );
}
