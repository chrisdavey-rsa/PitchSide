import React, { useRef, useState } from "react";
import { motion } from "motion/react";
import {
  UserCheck,
  HelpCircle,
  Lock,
  LogOut,
  Users,
  Trophy,
} from "lucide-react";
import { UserProfile } from "../../types";
import PitchSideLogo from "../PitchSideLogo";
import PitchSideMark from "../PitchSideMark";
import { RadialOrigin, radialOriginFromEvent } from "../../radial";
import LogoutConfirmModal from "../LogoutConfirmModal";

export type DesktopMainView = "predictions" | "leaderboards";

interface TopNavigationProps {
  user: UserProfile;
  onLogout: () => void;
  onOpenRules: (origin?: RadialOrigin) => void;
  onOpenAdmin: () => void;
  onOpenAccount: (origin?: RadialOrigin) => void;
  onOpenLeagues: (origin?: RadialOrigin) => void;
  onResetState: () => void;
  desktopMainView?: DesktopMainView;
  onSelectDesktopView?: (view: DesktopMainView) => void;
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
  desktopMainView = "predictions",
  onSelectDesktopView,
  isUserInAnyLeague = true,
}: TopNavigationProps) {
  const highlightLeagues = !isUserInAnyLeague;
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const accountRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="relative z-30 bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-800/80 p-4 sm:px-6 shadow-xl">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div onClick={onResetState} className="cursor-pointer shrink-0">
            <PitchSideLogo size="md" autoplay={false} />
          </div>
          {user.isAdmin && (
            <span className="hidden md:inline-flex bg-purple-500/15 border border-purple-500/30 text-purple-400 font-mono text-[9px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">
              ADMINISTRATOR
            </span>
          )}
        </div>

        <div id="tour-nav-buttons" className="hidden md:flex items-center gap-2 sm:gap-3">
          <motion.button
            layoutId="nav-predictions-btn"
            id="tour-match-predictor"
            type="button"
            onClick={() => onSelectDesktopView?.("predictions")}
            className={`text-xs hover:text-white bg-slate-800/60 px-3 py-1.5 rounded-lg cursor-pointer transition-colors flex items-center gap-1.5 font-medium ${
              desktopMainView === "predictions"
                ? "text-white ring-1 ring-slate-600"
                : "text-slate-300"
            }`}
          >
            <PitchSideMark size={18} className="rounded-md shrink-0" />
            <span>Predictions</span>
          </motion.button>

          <motion.button
            layoutId="nav-leaderboards-btn"
            id="tour-leaderboards"
            type="button"
            onClick={() => onSelectDesktopView?.("leaderboards")}
            className={`text-xs hover:text-white bg-slate-800/60 px-3 py-1.5 rounded-lg cursor-pointer transition-colors flex items-center gap-1.5 font-medium ${
              desktopMainView === "leaderboards"
                ? "text-white ring-1 ring-slate-600"
                : "text-slate-300"
            }`}
          >
            <Trophy className="w-4 h-4 text-amber-400" />
            <span>Leaderboards</span>
          </motion.button>

          <motion.button
            layoutId="nav-leagues-btn"
            id="tour-league-manager"
            type="button"
            onClick={(e) => onOpenLeagues(radialOriginFromEvent(e))}
            className={`relative overflow-hidden text-xs text-slate-300 hover:text-white bg-slate-800/60 px-3 py-1.5 rounded-lg cursor-pointer transition-colors flex items-center gap-1.5 font-medium ${
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

          <button
            ref={accountRef}
            id="nav-account-btn"
            type="button"
            onClick={(e) => onOpenAccount(radialOriginFromEvent(e))}
            className="text-xs text-slate-300 hover:text-white bg-slate-800/60 px-3 py-1.5 rounded-lg cursor-pointer transition-colors flex items-center gap-1.5 font-medium"
          >
            <UserCheck className="w-4 h-4 text-emerald-400" />
            <span>Account</span>
          </button>

          <button
            id="nav-rules-btn"
            type="button"
            onClick={(e) => onOpenRules(radialOriginFromEvent(e))}
            className="text-xs text-slate-300 hover:text-white bg-slate-800/60 px-3 py-1.5 rounded-lg cursor-pointer transition-colors flex items-center gap-1.5 font-medium"
          >
            <HelpCircle className="w-4 h-4 text-blue-400" />
            <span>Rules</span>
          </button>

          {user.isAdmin && (
            <button
              id="nav-admin-toggle-btn"
              type="button"
              onClick={onOpenAdmin}
              className="text-xs text-white bg-purple-600 hover:bg-purple-700 active:translate-y-[0.5px] border border-purple-500 py-1.5 px-3 rounded-lg flex items-center gap-1.5 font-semibold transition-all shadow-[0_4px_12px_rgba(147,51,234,0.3)] cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5 text-white" />
              <span>Admin</span>
            </button>
          )}

          <button
            id="nav-logout-btn"
            type="button"
            onClick={() => setLogoutConfirmOpen(true)}
            className="text-xs text-slate-400 hover:text-red-400 bg-slate-950/60 p-2 rounded-lg cursor-pointer transition-colors"
            aria-label="Log out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      <LogoutConfirmModal
        open={logoutConfirmOpen}
        onCancel={() => setLogoutConfirmOpen(false)}
        onConfirm={() => {
          setLogoutConfirmOpen(false);
          onLogout();
        }}
      />
    </div>
  );
}
