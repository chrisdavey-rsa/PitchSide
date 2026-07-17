import React from 'react';
import {
  Shield,
  Users,
  Trophy,
  Database,
  AlertTriangle,
  CheckCircle2,
  X,
  BarChart3,
} from 'lucide-react';

export type AdminTab =
  | 'dashboard'
  | 'analytics'
  | 'players'
  | 'fixtures'
  | 'competitions'
  | 'backups'
  | 'leagues'
  | 'predictions';

interface AdminLayoutProps {
  onClose: () => void;
  activeTab: AdminTab;
  setActiveTab: (tab: AdminTab) => void;
  successMsg: string;
  errorMsg: string;
  fixtureCount: number;
  playerCount: number;
  archiveCount: number;
  children: React.ReactNode;
}

const TABS: { id: AdminTab; label: (counts: { fixture: number; player: number; archive: number }) => string; icon: React.FC<any>; color: 'purple' | 'blue' | 'emerald' | 'cyan' }[] = [
  { id: 'dashboard',      label: () => 'Game Health Analytics',                    icon: AlertTriangle, color: 'purple' },
  { id: 'analytics',      label: () => 'Analytics & Insights',                     icon: BarChart3,     color: 'cyan' },
  { id: 'players',        label: ({ player }) => `Players (${player})`,            icon: Users,         color: 'purple' },
  { id: 'fixtures',       label: ({ fixture }) => `Fixtures & Scoring (${fixture})`, icon: Trophy,      color: 'blue' },
  { id: 'competitions',   label: () => 'Competitions',                             icon: Trophy,        color: 'blue' },
  { id: 'backups',        label: ({ archive }) => `Archived Backups (${archive})`, icon: Database,      color: 'emerald' },
  { id: 'leagues',        label: () => 'Mini-Leagues',                             icon: Users,         color: 'purple' },
  { id: 'predictions',    label: () => 'Predictions',                              icon: Database,      color: 'purple' },
];

const ACTIVE_STYLES: Record<'purple' | 'blue' | 'emerald' | 'cyan', string> = {
  purple:  'bg-purple-500/10 border-purple-500/25 text-purple-400 font-bold',
  blue:    'bg-blue-500/10 border-blue-500/25 text-blue-400 font-bold',
  emerald: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400 font-bold',
  cyan:    'bg-cyan-500/10 border-cyan-500/25 text-cyan-400 font-bold',
};

export default function AdminLayout({
  onClose,
  activeTab,
  setActiveTab,
  successMsg,
  errorMsg,
  fixtureCount,
  playerCount,
  archiveCount,
  children,
}: AdminLayoutProps) {
  const counts = { fixture: fixtureCount, player: playerCount, archive: archiveCount };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-6xl overflow-hidden shadow-2xl relative my-auto flex flex-col h-[min(90vh,880px)]">
        {/* Animated top border */}
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-linear-to-r from-purple-500 via-indigo-500 to-blue-500 animate-border-glow" />

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800/80 bg-slate-900 shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-purple-500/10 p-2 rounded-lg border border-purple-500/20">
              <Shield className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold font-display text-white uppercase tracking-wider">
                PitchSide Administrative Terminal
              </h3>
              <p className="text-[10px] text-slate-500 font-mono tracking-widest uppercase">
                SECURE ACCESS SEGMENT // SECURE DATABASE UTILITIES
              </p>
            </div>
          </div>
          <button
            id="admin-close-btn"
            onClick={onClose}
            className="text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800 p-2 rounded-full cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body: left nav + content */}
        <div className="flex flex-1 min-h-0">
          {/* Left-hand tab rail */}
          <nav
            aria-label="Admin sections"
            className="w-[11.5rem] sm:w-56 shrink-0 bg-slate-950 border-r border-slate-800 overflow-y-auto py-3 px-2 sm:px-2.5 flex flex-col gap-1"
          >
            <span className="px-2.5 pb-2 text-[9px] font-mono uppercase tracking-widest text-slate-600 font-bold">
              Modules
            </span>
            {TABS.map(({ id, label, icon: Icon, color }) => {
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  id={`tab-${id}-btn`}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={`w-full text-left text-[11px] sm:text-xs font-mono px-2.5 py-2.5 rounded-lg border cursor-pointer transition-all flex items-start gap-2 tracking-wide font-bold ${
                    isActive
                      ? ACTIVE_STYLES[color]
                      : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/80'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span className="leading-snug uppercase">{label(counts)}</span>
                </button>
              );
            })}
          </nav>

          {/* Main content column */}
          <div className="flex-1 min-w-0 flex flex-col min-h-0">
            {successMsg && (
              <div
                id="admin-toast-alert"
                className="bg-emerald-950/85 border-b border-emerald-500/30 text-emerald-300 font-mono text-[10px] px-5 py-2 flex items-center gap-2 animate-fade-in justify-center uppercase font-bold tracking-wider shrink-0"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}
            {errorMsg && (
              <div className="bg-red-950/85 border-b border-red-500/30 text-red-300 font-mono text-[10px] px-5 py-2 flex items-center gap-2 animate-fade-in justify-center uppercase font-bold tracking-wider shrink-0">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 bg-slate-900/30">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
