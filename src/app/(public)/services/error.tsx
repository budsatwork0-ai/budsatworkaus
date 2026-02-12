'use client';

import { ErrorDisplay } from '@/components/ErrorDisplay';

export default function ServicesError({
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
      title="Quote Builder Error"
      variant="services"
    />
  );
}
