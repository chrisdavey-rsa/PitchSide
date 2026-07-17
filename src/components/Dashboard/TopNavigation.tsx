import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { UserCheck, HelpCircle, Lock, LogOut, Users, Target, ChevronDown } from "lucide-react";
import { UserProfile, SportType } from "../../types";
import PitchSideLogo from "../PitchSideLogo";
import { RadialOrigin, radialOriginFromEvent } from "../../radial";
import LogoutConfirmModal from "../LogoutConfirmModal";

interface TopNavigationProps {
  user: UserProfile;
  onLogout: () => void;
  onOpenRules: (origin?: RadialOrigin) => void;
  onOpenAdmin: () => void;
  onOpenAccount: (origin?: RadialOrigin) => void;
  onOpenLeagues: (origin?: RadialOrigin) => void;
  onResetState: () => void;
  onSelectSport?: (sport: SportType) => void;
  selectedSport?: SportType | null;
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
  onSelectSport,
  selectedSport = null,
  isUserInAnyLeague = true,
}: TopNavigationProps) {
  const highlightLeagues = !isUserInAnyLeague;
  const [sportsOpen, setSportsOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const sportsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sportsOpen) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (sportsRef.current && !sportsRef.current.contains(e.target as Node)) {
        setSportsOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSportsOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [sportsOpen]);

  return (
    <div className="relative z-30 bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-800/80 p-4 sm:px-6 flex items-center justify-between shadow-xl">
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

      {/* Desktop utility bar only — Log Out stays here, never on mobile top chrome */}
      <div id="tour-nav-buttons" className="hidden md:flex items-center gap-2 sm:gap-4">
        <div ref={sportsRef} className={`relative ${sportsOpen ? "z-50" : ""}`}>
          <motion.button
            layoutId="nav-sports-btn"
            id="tour-sports-switcher"
            type="button"
            onClick={() => setSportsOpen((o) => !o)}
            aria-expanded={sportsOpen}
            aria-haspopup="menu"
            className={`text-xs text-slate-300 hover:text-white bg-slate-800/60 p-2 sm:px-3 sm:py-1.5 rounded-lg cursor-pointer transition-colors flex items-center gap-1.5 font-medium ${
              sportsOpen ? "text-white ring-1 ring-slate-600" : ""
            }`}
          >
            <Target className="w-4 h-4 text-sky-400" />
            <span>Sports</span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-500 transition-transform ${sportsOpen ? "rotate-180" : ""}`}
            />
          </motion.button>

          <AnimatePresence>
            {sportsOpen && (
              <motion.div
                role="menu"
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="absolute left-0 top-full mt-2 z-[60] w-56 rounded-xl border border-slate-700/80 bg-slate-950/95 backdrop-blur-xl shadow-2xl shadow-black/40 p-1.5 overflow-hidden"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onSelectSport?.(SportType.FOOTBALL);
                    setSportsOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-3 transition-colors cursor-pointer ${
                    selectedSport === SportType.FOOTBALL
                      ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/25"
                      : "text-slate-300 hover:bg-slate-800/80 hover:text-white border border-transparent"
                  }`}
                >
                  <span className="text-base leading-none" aria-hidden>
                    ⚽
                  </span>
                  <div className="min-w-0">
                    <span className="block text-xs font-semibold">Football</span>
                    <span className="block text-[10px] text-slate-500 font-mono">Active</span>
                  </div>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onSelectSport?.(SportType.RUGBY);
                    setSportsOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-3 transition-colors cursor-pointer mt-0.5 ${
                    selectedSport === SportType.RUGBY
                      ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/25"
                      : "text-slate-300 hover:bg-slate-800/80 hover:text-white border border-transparent"
                  }`}
                >
                  <span className="text-base leading-none" aria-hidden>
                    🏉
                  </span>
                  <div className="min-w-0">
                    <span className="block text-xs font-semibold">Rugby</span>
                    <span className="block text-[10px] text-slate-500 font-mono">Active</span>
                  </div>
                </button>

                {/* Explicitly non-interactive coming-soon card */}
                <div
                  role="presentation"
                  aria-disabled="true"
                  className="mt-1.5 mx-0.5 rounded-lg border border-slate-800/90 bg-slate-900/40 px-3 py-2.5 flex items-center gap-3 opacity-45 select-none pointer-events-none grayscale"
                >
                  <span className="text-base leading-none" aria-hidden>
                    ⛳
                  </span>
                  <div className="min-w-0">
                    <span className="block text-xs font-semibold text-slate-400">Golf</span>
                    <span className="block text-[10px] text-slate-500 font-mono italic">
                      Coming soon...
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

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
          className="text-xs text-slate-300 hover:text-white bg-slate-800/60 p-2 sm:px-3 sm:py-1.5 rounded-lg cursor-pointer transition-colors flex items-center gap-1.5 font-medium"
        >
          <UserCheck className="w-4 h-4 text-emerald-450" />
          <span>Account</span>
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
          onClick={() => setLogoutConfirmOpen(true)}
          className="text-xs text-slate-400 hover:text-red-400 bg-slate-950/60 p-2 rounded-lg cursor-pointer transition-colors"
          title="Log out from PitchSide"
        >
          <LogOut className="w-4.5 h-4.5" />
        </button>
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
