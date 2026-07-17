import React, { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

/**
 * Catches render-time crashes so users see a recovery UI instead of a blank page.
 */
export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error?.message || "An unexpected error occurred.",
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("PitchSide render crash:", error, info.componentStack);
  }

  private handleReload = () => {
    window.location.assign("/");
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="max-w-md w-full rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl space-y-4">
          <h1 className="text-xl font-extrabold font-display text-white">
            Something went wrong
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            PitchSide hit an unexpected error while loading. Reloading usually
            clears it — if it keeps happening, try signing out or clearing site
            data for this domain.
          </p>
          {this.state.message && (
            <p className="text-[11px] font-mono text-red-300/80 bg-red-950/30 border border-red-500/20 rounded-lg px-3 py-2 break-words">
              {this.state.message}
            </p>
          )}
          <button
            type="button"
            onClick={this.handleReload}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold font-display text-sm py-3 rounded-xl cursor-pointer transition-colors"
          >
            Reload PitchSide
          </button>
        </div>
      </div>
    );
  }
}
