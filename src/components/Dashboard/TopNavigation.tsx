import React from "react";
import { motion } from "motion/react";
import { UserCheck, HelpCircle, Lock, LogOut, Users } from "lucide-react";
import { UserProfile } from "../../types";
import PitchSideLogo from "../PitchSideLogo";
import { useUnreadMessages } from "../../hooks/useUnreadMessages";
import { RadialOrigin, radialOriginFromEvent } from "../../radial";

interface TopNavigationProps {
  user: UserProfile;
  onLogout: () => void;
  onOpenRules: (origin?: RadialOrigin) => void;
  onOpenAdmin: () => void;
  onOpenAccount: (origin?: RadialOrigin) => void;
  onOpenLeagues: (origin?: RadialOrigin) => void;
  onResetState: () => void;
  isUserInAnyLeague?: boolean;
}

export default function TopNavigation({
  user,
  onLogout,
  onOpenRules,
  onOpenAdmin,
  onOpenAccount,
  onOpenLeagues,
  onResetState,
  isUserInAnyLeague = true,
}: TopNavigationProps) {
  const unreadMessagesCount = useUnreadMessages(user?.id);
  const highlightLeagues = !isUserInAnyLeague;

  return (
    <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-800/80 p-4 sm:px-6 flex items-center justify-between shadow-xl">
      <div className="flex items-center gap-3">
        <div onClick={onResetState} className="cursor-pointer">
          <PitchSideLogo size="md" autoplay={false} />
        </div>
        {user.isAdmin && (
          <span className="bg-purple-500/15 border border-purple-500/30 text-purple-400 font-mono text-[9px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">
            ADMINISTRATOR
          </span>
        )}
      </div>

      <div id="tour-nav-buttons" className="hidden md:flex items-center gap-2 sm:gap-4">
        <motion.button
          layoutId="nav-leagues-btn"
          id="tour-league-manager"
          onClick={(e) => onOpenLeagues(radialOriginFromEvent(e))}
          className={`relative overflow-hidden text-xs text-slate-300 hover:text-white bg-slate-800/60 p-2 sm:px-3 sm:py-1.5 rounded-lg cursor-pointer transition-colors flex items-center gap-1.5 font-medium ${
            highlightLeagues
              ? "ring-2 ring-emerald-400 shadow-[0_0_18px_rgba(16,185,129,0.35)] text-white"
              : ""
          }`}
        >
          {highlightLeagues && (
            <span className="pointer-events-none absolute inset-0 -translate-x-full bg-linear-to-r from-transparent via-emerald-300/25 to-transparent animate-[shimmer_2.2s_ease-in-out_infinite]" />
          )}
          <Users className="w-4 h-4 text-yellow-500" />
          <span>Leagues</span>
        </motion.button>

        <motion.button
          layoutId="nav-account-btn"
          id="nav-account-btn"
          onClick={(e) => onOpenAccount(radialOriginFromEvent(e))}
          className="text-xs text-slate-300 hover:text-white bg-slate-800/60 p-2 sm:px-3 sm:py-1.5 rounded-lg cursor-pointer transition-colors flex items-center gap-1.5 font-medium relative"
        >
          <UserCheck className="w-4 h-4 text-emerald-450" />
          <span>Account</span>
          {unreadMessagesCount > 0 && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse border-2 border-slate-900" />
          )}
        </motion.button>

        <motion.button
          layoutId="nav-rules-btn"
          id="nav-rules-btn"
          onClick={(e) => onOpenRules(radialOriginFromEvent(e))}
          className="text-xs text-slate-300 hover:text-white bg-slate-800/60 p-2 sm:px-3 sm:py-1.5 rounded-lg cursor-pointer transition-colors flex items-center gap-1.5 font-medium"
        >
          <HelpCircle className="w-4 h-4 text-blue-400" />
          <span className="hidden sm:inline">Rules Guide</span>
        </motion.button>

        {user.isAdmin && (
          <button
            id="nav-admin-toggle-btn"
            onClick={onOpenAdmin}
            className="text-xs text-white bg-purple-600 hover:bg-purple-700 active:translate-y-[0.5px] border border-purple-500 py-1.5 px-3 rounded-lg flex items-center gap-1.5 font-semibold transition-all shadow-[0_4px_12px_rgba(147,51,234,0.3)] cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5 text-white" />
            <span>Admin Area</span>
          </button>
        )}

        <button
          id="nav-logout-btn"
          onClick={onLogout}
          className="text-xs text-slate-400 hover:text-red-400 bg-slate-950/60 p-2 rounded-lg cursor-pointer transition-colors"
          title="Log out from PitchSide"
        >
          <LogOut className="w-4.5 h-4.5" />
        </button>
      </div>
    </div>
  );
}
