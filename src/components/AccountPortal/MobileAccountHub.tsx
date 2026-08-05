import React, { useState } from 'react';
import {
  X,
  User,
  BookOpen,
  ChevronDown,
  ShieldAlert,
  LogOut,
  Lock,
} from 'lucide-react';
import { UserProfile, League, Competition } from '../../types';
import { btnClose } from '../../ui';
import LogoutConfirmModal from '../LogoutConfirmModal';

interface MobileAccountHubProps {
  user: UserProfile;
  userLeagues: League[];
  selectedSeason: string;
  setSelectedSeason: (season: string) => void;
  getCompetitions: () => Competition[];
  onSelectLeague?: (leagueId: string) => void;
  onUpdateUser: (updated: UserProfile) => void;
  onOpenRules: () => void;
  /** Admin console — only wired when `user.isAdmin`. */
  onOpenAdmin?: () => void;
  /** Omit in embedded tab mode — no close control. */
  onClose?: () => void;
  onLogout?: () => void;
  /** When true (mobile bottom-nav tab), use document scroll instead of a nested scrollport. */
  embedded?: boolean;
  /**
   * Compact profile + shortcuts only. Feature tabs (leagues / history / support)
   * live in SidebarNav + the main content pane on all breakpoints.
   */
  compact?: boolean;
}

export const MobileAccountHub: React.FC<MobileAccountHubProps> = ({
  user,
  userLeagues,
  onOpenRules,
  onOpenAdmin,
  onClose,
  onLogout,
  embedded = false,
  compact: _compact = false,
}) => {
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const initials =
    (user.nickname || `${user.firstName?.[0] ?? ''}${user.surname?.[0] ?? ''}` || '?')
      .slice(0, 2)
      .toUpperCase();
  const displayName = user.nickname || `${user.firstName} ${user.surname}`.trim();
  const activeLeagueCount = userLeagues.length;

  return (
    <div
      className={
        embedded
          ? 'flex flex-col w-full md:hidden pb-2 touch-pan-y'
          : 'flex flex-col w-full md:hidden pb-2 shrink-0'
      }
    >
      <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-800/70 shrink-0">
        <div className="min-w-0">
          <h4 className="text-base font-extrabold font-display text-white tracking-wide uppercase">
            Account Hub
          </h4>
          <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">
            Profile &amp; participation
          </p>
        </div>
        {onClose && (
          <button
            id="acc-close-btn-mobile"
            onClick={onClose}
            className={btnClose}
            title="Return to Dashboard"
            type="button"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="w-full px-5 py-4 space-y-4 touch-pan-y">
        <div className="relative overflow-hidden rounded-2xl border border-slate-800/80 bg-linear-to-br from-slate-900 via-slate-950 to-emerald-950/30 p-4">
          <div className="pointer-events-none absolute -right-8 -top-8 w-28 h-28 rounded-full bg-[radial-gradient(circle,rgba(16,185,129,0.18)_0%,transparent_70%)]" />
          <div className="relative flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <span className="text-base font-bold font-display text-emerald-400 tracking-wide">
                {initials}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <User className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                  Player profile
                </span>
              </div>
              <h3 className="text-base font-bold font-display text-white truncate leading-tight">
                {displayName}
              </h3>
              <p className="text-[11px] text-slate-400 truncate mt-0.5 font-mono">{user.email}</p>
            </div>
          </div>
          <div className="relative mt-3 flex items-center gap-2">
            <div className="flex-1 rounded-xl bg-slate-950/60 border border-slate-800/60 px-3 py-2 text-center">
              <span className="block text-[9px] font-mono uppercase tracking-widest text-slate-500 mb-0.5">
                Leagues
              </span>
              <span className="text-sm font-bold text-emerald-400 font-display">
                {activeLeagueCount}
              </span>
            </div>
            <div className="flex-1 rounded-xl bg-slate-950/60 border border-slate-800/60 px-3 py-2 text-center min-w-0">
              <span className="block text-[9px] font-mono uppercase tracking-widest text-slate-500 mb-0.5">
                Preferred Sport
              </span>
              <span className="text-sm font-bold text-slate-200 font-display capitalize truncate block">
                {user.preferredSport ?? '—'}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenRules();
            }}
            className="w-full text-left rounded-xl border border-slate-800/80 bg-slate-900/50 hover:bg-slate-900 hover:border-blue-500/30 px-4 py-3 flex items-center gap-3 transition-colors cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4 text-blue-400" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-white">Rules &amp; Gameplay Guide</span>
              <span className="block text-[10px] text-slate-500 font-mono mt-0.5">
                Scoring formulas, margins &amp; power-ups
              </span>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-600 -rotate-90 shrink-0" />
          </button>

          {user.isAdmin && onOpenAdmin && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenAdmin();
              }}
              className="w-full text-left rounded-xl border border-purple-500/30 bg-purple-950/30 hover:bg-purple-950/50 px-4 py-3 flex items-center gap-3 transition-colors cursor-pointer"
            >
              <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center shrink-0">
                <Lock className="w-4 h-4 text-purple-300" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-white">Admin</span>
                <span className="block text-[10px] text-slate-500 font-mono mt-0.5">
                  Fixtures, players &amp; scoring tools
                </span>
              </div>
            </button>
          )}
        </div>

        <div
          role="status"
          className="rounded-2xl border border-amber-500/25 bg-linear-to-br from-amber-950/40 via-slate-950/80 to-slate-950 p-4 flex gap-3"
        >
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
            <ShieldAlert className="w-4.5 h-4.5 text-amber-400" />
          </div>
          <div className="min-w-0">
            <span className="block text-[10px] font-mono uppercase tracking-widest text-amber-500/90 font-bold mb-1.5">
              Security Modifications
            </span>
            <p className="text-xs text-slate-300 leading-relaxed">
              Changing passwords, email configuration, or Account Deletion are safety-restricted
              operations requiring a desktop computer login.
            </p>
          </div>
        </div>

        {onLogout && (
          <button
            type="button"
            onClick={() => setLogoutConfirmOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-800 text-slate-400 hover:text-red-400 hover:border-red-500/30 hover:bg-red-950/20 transition-colors text-xs font-semibold font-mono uppercase tracking-wider cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Log out
          </button>
        )}
      </div>

      {onLogout && (
        <LogoutConfirmModal
          open={logoutConfirmOpen}
          onCancel={() => setLogoutConfirmOpen(false)}
          onConfirm={() => {
            setLogoutConfirmOpen(false);
            onLogout();
          }}
        />
      )}
    </div>
  );
};
