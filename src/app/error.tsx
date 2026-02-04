'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold mb-4">Something went wrong</h2>
        <p className="text-slate-600 mb-6">{error.message || 'An unexpected error occurred.'}</p>
        <button
          onClick={reset}
          className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
