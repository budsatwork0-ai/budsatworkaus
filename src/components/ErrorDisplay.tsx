'use client';

import { useEffect } from 'react';

interface ErrorDisplayProps {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  showHomeButton?: boolean;
  variant?: 'default' | 'dashboard' | 'services';
}

// Categorize errors for user-friendly messages
function getErrorMessage(error: Error): string {
  const message = error.message?.toLowerCase() || '';

  if (message.includes('fetch') || message.includes('network')) {
    return 'Network error. Please check your connection and try again.';
  }
  if (message.includes('supabase') || message.includes('database')) {
    return 'Database temporarily unavailable. Please try again in a moment.';
  }
  if (message.includes('unauthorized') || message.includes('401')) {
    return 'You need to sign in to access this page.';
  }
  if (message.includes('forbidden') || message.includes('403')) {
    return 'You do not have permission to access this resource.';
  }
  if (message.includes('not found') || message.includes('404')) {
    return 'The requested resource could not be found.';
  }
  if (message.includes('timeout')) {
    return 'The request timed out. Please try again.';
  }

  // Don't expose raw error messages in production
  if (process.env.NODE_ENV === 'production') {
    return 'An unexpected error occurred. Please try again.';
  }

  return error.message || 'An unexpected error occurred.';
}

// Get variant-specific styles
function getVariantStyles(variant: ErrorDisplayProps['variant']) {
  switch (variant) {
    case 'dashboard':
      return {
        container: 'bg-white/90 border border-black/5 shadow-lg',
        title: 'text-emerald-800',
        button: 'bg-emerald-600 hover:bg-emerald-700',
      };
    case 'services':
      return {
        container: 'bg-gradient-to-br from-white to-slate-50 border border-slate-200',
        title: 'text-slate-900',
        button: 'bg-emerald-600 hover:bg-emerald-700',
      };
    default:
      return {
        container: 'bg-white',
        title: 'text-slate-900',
        button: 'bg-emerald-600 hover:bg-emerald-700',
      };
  }
}

export function ErrorDisplay({
  error,
  reset,
  title = 'Something went wrong',
  showHomeButton = true,
  variant = 'default',
}: ErrorDisplayProps) {
  const styles = getVariantStyles(variant);

  useEffect(() => {
    // Log errors for debugging
    console.error('Error caught by boundary:', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });

    // Future: Send to error tracking service (Sentry, LogRocket, etc.)
    // if (typeof window !== 'undefined' && window.Sentry) {
    //   window.Sentry.captureException(error);
    // }
  }, [error]);

  const errorMessage = getErrorMessage(error);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div className={`text-center max-w-md rounded-2xl px-8 py-10 ${styles.container}`}>
        {/* Error Icon */}
        <div className="mx-auto mb-6 w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-red-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        <h2 className={`text-2xl font-semibold mb-3 ${styles.title}`}>{title}</h2>
        <p className="text-slate-600 mb-6 text-sm leading-relaxed">{errorMessage}</p>

        {/* Error ID for support */}
        {error.digest && (
          <p className="text-xs text-slate-400 mb-6">
            Error ID: <code className="font-mono">{error.digest}</code>
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className={`px-5 py-2.5 text-white rounded-lg transition-colors font-medium ${styles.button}`}
          >
            Try again
          </button>
          {showHomeButton && (
            <a
              href="/"
              className="px-5 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
            >
              Go home
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default ErrorDisplay;
