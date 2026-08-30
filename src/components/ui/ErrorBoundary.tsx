"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (process.env.NODE_ENV === "development") {
      // Preserve a quiet production experience while allowing local debugging.
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("app-error", {
            detail: { error, info },
          }),
        );
      }
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex min-h-[260px] items-center justify-center p-8">
            <div className="max-w-md rounded-2xl border border-line bg-panel p-6 text-center shadow-[0_10px_35px_rgba(20,24,31,0.04)]">
              <div className="font-mono text-[0.68rem] uppercase tracking-[0.12em] text-graphite-soft">
                System notice
              </div>
              <h2 className="mt-3 text-xl font-semibold text-ink">Something went wrong</h2>
              <p className="mt-2 text-sm leading-6 text-graphite">
                The analytics panel hit an unexpected rendering problem. Refresh the view or try a simpler question.
              </p>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
