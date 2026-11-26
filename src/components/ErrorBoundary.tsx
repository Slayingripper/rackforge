import { Component, type ReactNode } from 'react';

interface ErrorBoundaryState { error: Error | null }

export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div role="alert" className="flex min-h-screen items-center justify-center bg-ink p-6 text-white">
          <div className="max-w-md rounded-2xl border border-danger/30 bg-panel p-7 text-center shadow-panel">
            <h1 className="text-xl font-semibold">The rack view could not render</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted">A rendering error was isolated before it could destroy the workspace. Your local autosave should still be intact.</p>
            <button type="button" onClick={() => { this.setState({ error: null }); window.location.reload(); }} className="mt-5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-ink">Reload workspace</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
