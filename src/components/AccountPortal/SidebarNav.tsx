import React from 'react';
import {
  User,
  Trophy,
  Mail,
  Lock,
  Award,
  AlertTriangle,
  ChevronRight,
  Layers,
  LifeBuoy,
} from 'lucide-react';

export type AccountTab =
  | 'general'
  | 'change-email'
  | 'change-password'
  | 'historic-scores'
  | 'tournaments'
  | 'leagues'
  | 'contact-support'
  | 'delete-account';

/** Account-management tabs disabled on mobile (&lt;768px). */
export const MOBILE_RESTRICTED_ACCOUNT_TABS: readonly AccountTab[] = [
  'general',
  'change-email',
  'change-password',
  'delete-account',
] as const;

/** Core feature tabs available on all screen sizes. */
export const MOBILE_ALLOWED_ACCOUNT_TABS: readonly AccountTab[] = [
  'tournaments',
  'leagues',
  'historic-scores',
  'contact-support',
] as const;

export const MOBILE_ACCOUNT_FALLBACK_TAB: AccountTab = 'historic-scores';

export function isMobileRestrictedAccountTab(tab: AccountTab): boolean {
  return (MOBILE_RESTRICTED_ACCOUNT_TABS as readonly string[]).includes(tab);
}

interface SidebarNavProps {
  activeTab: AccountTab;
  setActiveTab: (tab: AccountTab) => void;
  setStatusMsg: (msg: { text: string; mode: 'success' | 'error' | 'none' }) => void;
  /** Player username (nickname) shown under the ACCOUNT heading. */
  username?: string;
}

function navBtnClass(active: boolean, tone: 'emerald' | 'blue' | 'red' = 'emerald') {
  if (tone === 'red') {
    return active
      ? 'bg-red-500/10 text-red-400 border border-red-500/20'
      : 'text-red-400 hover:bg-red-950/20 hover:text-red-400 border border-transparent';
  }
  if (tone === 'blue') {
    return active
      ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
      : 'text-slate-400 hover:bg-slate-900/40 hover:text-white border border-transparent';
  }
  return active
    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
    : 'text-slate-400 hover:bg-slate-900/40 hover:text-white border border-transparent';
}

/** Desktop sidebar only — mobile uses `MobileAccountAccordion`. */
export const SidebarNav: React.FC<SidebarNavProps> = ({
  activeTab,
  setActiveTab,
  setStatusMsg,
  username,
}) => {
  const go = (tab: AccountTab) => {
    setActiveTab(tab);
    setStatusMsg({ text: '', mode: 'none' });
  };

  return (
    <div className="hidden md:flex w-full md:w-64 bg-slate-950/40 p-5 md:p-6 border-b md:border-b-0 md:border-r border-slate-800/80 flex-col justify-between shrink-0 relative overflow-y-auto">
      <div className="space-y-6 min-w-0">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-800/50">
          <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-400">
            <User className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold font-display text-white tracking-wide uppercase">
              ACCOUNT
            </h3>
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
            onClick={() => go('tournaments')}
            className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold font-mono flex items-center justify-between transition-all cursor-pointer ${navBtnClass(activeTab === 'tournaments')}`}
          >
            <div className="flex items-center gap-2.5">
              <Layers className="w-4 h-4 shrink-0" />
              <span>Leagues and Competitions</span>
            </div>
            <ChevronRight className={`w-3 h-3 ${activeTab === 'tournaments' ? 'text-emerald-400' : 'text-slate-500'}`} />
          </button>
          <button
            type="button"
            onClick={() => go('leagues')}
            className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold font-mono flex items-center justify-between transition-all cursor-pointer ${navBtnClass(activeTab === 'leagues')}`}
          >
            <div className="flex items-center gap-2.5">
              <Trophy className="w-4 h-4 shrink-0" />
              <span>My Leagues</span>
            </div>
            <ChevronRight className={`w-3 h-3 ${activeTab === 'leagues' ? 'text-emerald-400' : 'text-slate-500'}`} />
          </button>
        </div>

        <div className="space-y-1 mb-6">
          <span className="text-[10px] font-extrabold text-slate-500 font-mono uppercase tracking-widest pl-2 block mb-2">
            Statistics
          </span>
          <button
            type="button"
            onClick={() => go('historic-scores')}
            className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold font-mono flex items-center justify-between transition-all cursor-pointer ${navBtnClass(activeTab === 'historic-scores')}`}
          >
            <div className="flex items-center gap-2.5">
              <Award className="w-4 h-4 shrink-0" />
              <span>Prediction History</span>
            </div>
            <ChevronRight className={`w-3 h-3 ${activeTab === 'historic-scores' ? 'text-emerald-400' : 'text-slate-500'}`} />
          </button>
        </div>

        <div className="space-y-1">
          <span className="text-[10px] font-extrabold text-slate-500 font-mono uppercase tracking-widest pl-2 block mb-2">
            Preferences
          </span>
          <button
            type="button"
            onClick={() => go('general')}
            className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold font-mono flex items-center justify-between transition-all cursor-pointer ${navBtnClass(activeTab === 'general')}`}
          >
            <div className="flex items-center gap-2.5">
              <User className="w-4 h-4 shrink-0" />
              <span>General / Account</span>
            </div>
            <ChevronRight className={`w-3 h-3 ${activeTab === 'general' ? 'text-emerald-400' : 'text-slate-500'}`} />
          </button>
          <button
            type="button"
            onClick={() => go('change-email')}
            className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold font-mono flex items-center justify-between transition-all cursor-pointer ${navBtnClass(activeTab === 'change-email')}`}
          >
            <div className="flex items-center gap-2.5">
              <Mail className="w-4 h-4 shrink-0" />
              <span>Change Email</span>
            </div>
            <ChevronRight className={`w-3 h-3 ${activeTab === 'change-email' ? 'text-emerald-400' : 'text-slate-500'}`} />
          </button>
          <button
            type="button"
            onClick={() => go('change-password')}
            className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold font-mono flex items-center justify-between transition-all cursor-pointer ${navBtnClass(activeTab === 'change-password')}`}
          >
            <div className="flex items-center gap-2.5">
              <Lock className="w-4 h-4 shrink-0" />
              <span>Change Password</span>
            </div>
            <ChevronRight className={`w-3 h-3 ${activeTab === 'change-password' ? 'text-emerald-400' : 'text-slate-500'}`} />
          </button>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-800/40 mt-6 space-y-1">
        <button
          type="button"
          onClick={() => go('contact-support')}
          className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold font-mono flex items-center justify-between transition-all cursor-pointer ${navBtnClass(activeTab === 'contact-support', 'blue')}`}
        >
          <div className="flex items-center gap-2.5">
            <LifeBuoy className="w-4 h-4 shrink-0" />
            <span>Contact Support</span>
          </div>
          <ChevronRight className={`w-3 h-3 ${activeTab === 'contact-support' ? 'text-blue-400' : 'text-slate-500'}`} />
        </button>
        <button
          id="nav-delete-account-btn"
          type="button"
          onClick={() => go('delete-account')}
          className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold font-mono flex items-center justify-between transition-all cursor-pointer ${navBtnClass(activeTab === 'delete-account', 'red')}`}
        >
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Delete Account</span>
          </div>
          <ChevronRight className={`w-3 h-3 ${activeTab === 'delete-account' ? 'text-red-400' : 'text-slate-500/45'}`} />
        </button>
      </div>
    </div>
  );
};
