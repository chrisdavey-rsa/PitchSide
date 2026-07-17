import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  User,
  BookOpen,
  Trophy,
  ChevronDown,
  ShieldAlert,
  LogOut,
} from 'lucide-react';
import { UserProfile, League, Competition } from '../../types';
import { MyLeagues } from './MyLeagues';
import { btnClose } from '../../ui';
import LogoutConfirmModal from '../LogoutConfirmModal';

interface MobileAccountHubProps {
  user: UserProfile;
  userLeagues: League[];
  selectedSeason: string;
  setSelectedSeason: (season: string) => void;
  getCompetitions: () => Competition[];
  onSelectLeague?: (leagueId: string) => void;
  onOpenRules: () => void;
  onClose: () => void;
  onLogout?: () => void;
}

export const MobileAccountHub: React.FC<MobileAccountHubProps> = ({
  user,
  userLeagues,
  selectedSeason,
  setSelectedSeason,
  getCompetitions,
  onSelectLeague,
  onOpenRules,
  onClose,
  onLogout,
}) => {
  const [leaguesOpen, setLeaguesOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const initials =
    (user.nickname || `${user.firstName?.[0] ?? ''}${user.surname?.[0] ?? ''}` || '?')
      .slice(0, 2)
      .toUpperCase();
  const displayName = user.nickname || `${user.firstName} ${user.surname}`.trim();
  const activeLeagueCount = userLeagues.length;

  return (
    <div className="flex flex-col h-full md:hidden pb-2">
      <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-800/70 shrink-0">
        <div className="min-w-0">
          <h4 className="text-base font-extrabold font-display text-white tracking-wide uppercase">
            Account Hub
          </h4>
          <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">
            Profile &amp; participation
          </p>
        </div>
        <button
          id="acc-close-btn-mobile"
          onClick={onClose}
          className={btnClose}
          title="Return to Dashboard"
          type="button"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 space-y-5">
        {/* Personal header */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-800/80 bg-linear-to-br from-slate-900 via-slate-950 to-emerald-950/30 p-5">
          <div className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none" />
          <div className="relative flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0 shadow-[0_0_24px_rgba(16,185,129,0.15)]">
              <span className="text-lg font-bold font-display text-emerald-400 tracking-wide">
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
              <h3 className="text-lg font-bold font-display text-white truncate leading-tight">
                {displayName}
              </h3>
              <p className="text-xs text-slate-400 truncate mt-0.5 font-mono">{user.email}</p>
            </div>
          </div>
          <div className="relative mt-4 flex items-center gap-3">
            <div className="flex-1 rounded-xl bg-slate-950/60 border border-slate-800/60 px-3 py-2.5 text-center">
              <span className="block text-[9px] font-mono uppercase tracking-widest text-slate-500 mb-0.5">
                Leagues
              </span>
              <span className="text-sm font-bold text-emerald-400 font-display">{activeLeagueCount}</span>
            </div>
            <div className="flex-1 rounded-xl bg-slate-950/60 border border-slate-800/60 px-3 py-2.5 text-center">
              <span className="block text-[9px] font-mono uppercase tracking-widest text-slate-500 mb-0.5">
                Preferred Sport
              </span>
              <span className="text-sm font-bold text-slate-200 font-display capitalize truncate">
                {user.preferredSport ?? '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Shortcuts */}
        <div className="space-y-2">
          <span className="text-[10px] font-extrabold text-slate-500 font-mono uppercase tracking-widest pl-1 block">
            Shortcuts
          </span>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenRules();
            }}
            className="w-full text-left rounded-xl border border-slate-800/80 bg-slate-900/50 hover:bg-slate-900 hover:border-blue-500/30 px-4 py-3.5 flex items-center gap-3 transition-colors cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0 group-hover:bg-blue-500/15 transition-colors">
              <BookOpen className="w-4.5 h-4.5 text-blue-400" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-white">Rules &amp; Gameplay Guide</span>
              <span className="block text-[10px] text-slate-500 font-mono mt-0.5">
                Scoring formulas, margins &amp; power-ups
              </span>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-600 -rotate-90 shrink-0" />
          </button>

          <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 overflow-hidden">
            <button
              type="button"
              onClick={() => setLeaguesOpen((o) => !o)}
              className="w-full text-left px-4 py-3.5 flex items-center gap-3 transition-colors cursor-pointer hover:bg-slate-900/80"
              aria-expanded={leaguesOpen}
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <Trophy className="w-4.5 h-4.5 text-emerald-400" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-white">League participation</span>
                <span className="block text-[10px] text-slate-500 font-mono mt-0.5">
                  {activeLeagueCount === 0
                    ? 'No active leagues yet'
                    : `${activeLeagueCount} active league${activeLeagueCount === 1 ? '' : 's'}`}
                </span>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${leaguesOpen ? 'rotate-180' : ''}`}
              />
            </button>

            <AnimatePresence initial={false}>
              {leaguesOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: 'easeInOut' }}
                  className="overflow-hidden border-t border-slate-800/60"
                >
                  <div className="p-3">
                    <MyLeagues
                      userLeagues={userLeagues}
                      selectedSeason={selectedSeason}
                      setSelectedSeason={setSelectedSeason}
                      getCompetitions={getCompetitions}
                      onSelectLeague={onSelectLeague}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Security restriction banner */}
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

      <div className="text-[10px] font-mono text-slate-500 text-center py-3 border-t border-slate-800/40 select-none shrink-0">
        PITCHSIDE • 2026
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
