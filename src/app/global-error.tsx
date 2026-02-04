'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex items-center justify-center bg-white text-slate-900">
        <div className="text-center px-6">
          <h2 className="text-2xl font-semibold mb-4">Something went wrong</h2>
          <p className="text-slate-600 mb-6">{error.message || 'An unexpected error occurred.'}</p>
          <button
            onClick={reset}
            className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
