'use client';

import React from 'react';

type Props = {
  children: React.ReactNode;
  /** Optional label shown in the fallback UI, e.g. "Schedule tab" */
  label?: string;
};

type State = { hasError: boolean; message: string | null };

/**
 * ErrorBoundary
 * Wraps any dashboard section so that a runtime error in one panel
 * cannot crash the entire page. Shows a minimal inline fallback.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: null };
  }

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error(
      `[ErrorBoundary]${this.props.label ? ` (${this.props.label})` : ''}`,
      error,
      info.componentStack,
    );
  }

  handleReset = () => this.setState({ hasError: false, message: null });

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-[20px] border border-red-100 bg-red-50 px-5 py-4 text-sm text-red-700">
          <p className="font-semibold">
            {this.props.label ? `${this.props.label} failed to load` : 'This section failed to load'}
          </p>
          {this.state.message && (
            <p className="mt-1 text-xs text-red-500">{this.state.message}</p>
          )}
          <button
            onClick={this.handleReset}
            className="mt-3 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
