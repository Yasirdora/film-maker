"use client";

/**
 * ErrorBoundary — lightweight class-component error catcher.
 *
 * Wraps any subtree so a rendering error in a child component
 * degrades gracefully instead of crashing the entire page.
 * Exposes an optional `fallback` prop; defaults to a minimal
 * "something went wrong" message with a retry button.
 *
 * React still requires a class component for `componentDidCatch` /
 * `getDerivedStateFromError` — there's no hook equivalent.
 */

import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
    /** Rendered when a child throws during rendering. */
    fallback?: ReactNode;
    children: ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
}

export class ErrorBoundary extends Component<
    ErrorBoundaryProps,
    ErrorBoundaryState
> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(): ErrorBoundaryState {
        return { hasError: true };
    }

    componentDidCatch(error: Error, info: ErrorInfo): void {
        console.error("[ErrorBoundary]", error, info.componentStack);
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) return this.props.fallback;

            return (
                <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
                    <p className="text-sm text-ws-icon">
                        Something went wrong displaying this content.
                    </p>
                    <button
                        type="button"
                        onClick={() => this.setState({ hasError: false })}
                        className="rounded-lg bg-white/[0.08] px-3 py-1.5 text-xs text-ws-icon transition-colors hover:bg-white/[0.14] hover:text-white"
                    >
                        Try again
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
