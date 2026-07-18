import React from 'react';
import { User, Trophy, Mail, Lock, Award, AlertTriangle, ChevronRight } from 'lucide-react';

export type AccountTab =
  | 'general'
  | 'change-email'
  | 'change-password'
  | 'historic-scores'
  | 'leagues'
  | 'delete-account';

interface SidebarNavProps {
  activeTab: AccountTab;
  setActiveTab: (tab: AccountTab) => void;
  setStatusMsg: (msg: { text: string; mode: 'success' | 'error' | 'none' }) => void;
  /** Player username (nickname) shown under the ACCOUNT heading. */
  username?: string;
}

export const SidebarNav: React.FC<SidebarNavProps> = ({
  activeTab,
  setActiveTab,
  setStatusMsg,
  username,
}) => {
  return (
    <div className="hidden md:flex w-full md:w-64 bg-slate-950/40 p-5 md:p-6 border-b md:border-b-0 md:border-r border-slate-800/80 flex-col justify-between shrink-0 relative mt-1 overflow-y-auto md:overflow-y-visible">
      <div className="space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-800/50">
          <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-400">
            <User className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold font-display text-white tracking-wide uppercase">ACCOUNT</h3>
            {username ? (
              <p className="text-xs text-slate-400 font-mono truncate mt-0.5" title={username}>
                {username}
              </p>
            ) : null}
          </div>
        </div>

        <div className="space-y-1 mb-6">
          <span className="text-[10px] font-extrabold text-slate-500 font-mono uppercase tracking-widest pl-2 block mb-2">
            Leagues
          </span>
          <button
            type="button"
            onClick={() => {
              setActiveTab('leagues');
              setStatusMsg({ text: '', mode: 'none' });
            }}
            className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold font-mono flex items-center justify-between transition-all cursor-pointer ${
              activeTab === 'leagues'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'text-slate-400 hover:bg-slate-900/40 hover:text-white border border-transparent'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Trophy className="w-4 h-4 shrink-0" />
              <span>My Leagues</span>
            </div>
            <ChevronRight className={`w-3 h-3 text-slate-500 ${activeTab === 'leagues' ? 'text-emerald-400' : ''}`} />
          </button>
        </div>

        <div className="space-y-1">
          <span className="text-[10px] font-extrabold text-slate-500 font-mono uppercase tracking-widest pl-2 block mb-2">
            Preferences
          </span>
          
          <button
            type="button"
            onClick={() => {
              setActiveTab('general');
              setStatusMsg({ text: '', mode: 'none' });
            }}
            className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold font-mono flex items-center justify-between transition-all cursor-pointer ${
              activeTab === 'general'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'text-slate-400 hover:bg-slate-900/40 hover:text-white border border-transparent'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <User className="w-4 h-4 shrink-0" />
              <span>General / Account</span>
            </div>
            <ChevronRight className={`w-3 h-3 text-slate-500 ${activeTab === 'general' ? 'text-emerald-400' : ''}`} />
          </button>

          {/* Security ops — desktop only (≥768px). Parent already hides this whole sidebar on mobile. */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('change-email');
              setStatusMsg({ text: '', mode: 'none' });
            }}
            className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold font-mono flex items-center justify-between transition-all cursor-pointer ${
              activeTab === 'change-email'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'text-slate-400 hover:bg-slate-900/40 hover:text-white border border-transparent'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Mail className="w-4 h-4 shrink-0" />
              <span>Change Email</span>
            </div>
            <ChevronRight className={`w-3 h-3 text-slate-500 ${activeTab === 'change-email' ? 'text-emerald-400' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('change-password');
              setStatusMsg({ text: '', mode: 'none' });
            }}
            className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold font-mono flex items-center justify-between transition-all cursor-pointer ${
              activeTab === 'change-password'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'text-slate-400 hover:bg-slate-900/40 hover:text-white border border-transparent'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Lock className="w-4 h-4 shrink-0" />
              <span>Change Password</span>
            </div>
            <ChevronRight className={`w-3 h-3 text-slate-500 ${activeTab === 'change-password' ? 'text-emerald-400' : ''}`} />
          </button>

          <div className="pt-3 border-t border-slate-800/40 mt-3">
            <span className="text-[10px] font-extrabold text-slate-500 font-mono uppercase tracking-widest pl-2 block mb-2">
              Statistics
            </span>
            <button
              type="button"
              onClick={() => {
                setActiveTab('historic-scores');
                setStatusMsg({ text: '', mode: 'none' });
              }}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold font-mono flex items-center justify-between transition-all cursor-pointer ${
                activeTab === 'historic-scores'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'text-slate-400 hover:bg-slate-900/40 hover:text-white border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Award className="w-4 h-4 shrink-0" />
                <span>Historic Scores</span>
              </div>
              <ChevronRight className={`w-3 h-3 text-slate-500 ${activeTab === 'historic-scores' ? 'text-emerald-400' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-800/40 mt-6">
        <button
          id="nav-delete-account-btn"
          type="button"
          onClick={() => {
            setActiveTab('delete-account');
            setStatusMsg({ text: '', mode: 'none' });
          }}
          className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold font-mono flex items-center justify-between transition-all cursor-pointer ${
            activeTab === 'delete-account'
              ? 'bg-red-500/10 text-red-400 border border-red-500/20'
              : 'text-red-400 hover:bg-red-950/20 hover:text-red-400 border border-transparent'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Delete Account</span>
          </div>
          <ChevronRight className={`w-3 h-3 ${activeTab === 'delete-account' ? 'text-red-450' : 'text-slate-500/45'}`} />
        </button>
      </div>
    </div>
  );
};
