import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  UserCheck,
  HelpCircle,
  Lock,
  LogOut,
  Users,
  Trophy,
  ChevronDown,
  Menu,
} from "lucide-react";
import {
  EmergingSportNav,
  useUserRole,
  type SportKey,
} from "../../sports/emerging";
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
  /** Unified workspace sport (football | rugby | golf | formula1). */
  onSelectSport?: (sport: SportKey) => void;
  selectedSport?: SportKey | null;
  desktopMainView?: DesktopMainView;
  onSelectDesktopView?: (view: DesktopMainView) => void;
  isUserInAnyLeague?: boolean;
  /** Force-open the Settings menu (used by the desktop onboarding tour). */
  forceSettingsOpen?: boolean;
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
  desktopMainView = "predictions",
  onSelectDesktopView,
  isUserInAnyLeague = true,
  forceSettingsOpen = false,
}: TopNavigationProps) {
  const highlightLeagues = !isUserInAnyLeague;
  const [predictionsOpen, setPredictionsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const predictionsRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const userRole = useUserRole(user.id, user.isAdmin);

  useEffect(() => {
    if (forceSettingsOpen) {
      setSettingsOpen(true);
      setPredictionsOpen(false);
    }
  }, [forceSettingsOpen]);

  useEffect(() => {
    if (!predictionsOpen && !settingsOpen) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        predictionsOpen &&
        predictionsRef.current &&
        !predictionsRef.current.contains(target)
      ) {
        setPredictionsOpen(false);
      }
      if (
        settingsOpen &&
        settingsRef.current &&
        !settingsRef.current.contains(target)
      ) {
        setSettingsOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPredictionsOpen(false);
        setSettingsOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [predictionsOpen, settingsOpen]);

  const handleEmergingSportSelect = (sport: SportKey) => {
    onSelectDesktopView?.("predictions");
    onSelectSport?.(sport);
    setPredictionsOpen(false);
  };

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
          <div
            ref={predictionsRef}
            className={`relative ${predictionsOpen ? "z-50" : ""}`}
          >
            <motion.button
              layoutId="nav-predictions-btn"
              id="tour-sports-switcher"
              type="button"
              onClick={() => {
                onSelectDesktopView?.("predictions");
                setPredictionsOpen((o) => !o);
                setSettingsOpen(false);
              }}
              aria-expanded={predictionsOpen}
              aria-haspopup="menu"
              className={`text-xs hover:text-white bg-slate-800/60 px-3 py-1.5 rounded-lg cursor-pointer transition-colors flex items-center gap-1.5 font-medium ${
                desktopMainView === "predictions" || predictionsOpen
                  ? "text-white ring-1 ring-slate-600"
                  : "text-slate-300"
              }`}
            >
              <PitchSideMark size={18} className="rounded-md shrink-0" />
              <span>Predictions</span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-500 transition-transform ${
                  predictionsOpen ? "rotate-180" : ""
                }`}
              />
            </motion.button>

            <AnimatePresence>
              {predictionsOpen && (
                <motion.div
                  role="menu"
                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className="absolute right-0 top-full mt-2 z-[60] w-72 rounded-xl border border-slate-700/80 bg-slate-950/95 backdrop-blur-xl shadow-2xl shadow-black/40 p-1.5 overflow-hidden"
                >
                  <EmergingSportNav
                    userId={user.id}
                    userRole={userRole}
                    selectedSport={selectedSport}
                    onSelectSport={handleEmergingSportSelect}
                    showCoreSports
                    className="border-0 bg-transparent p-0 rounded-none"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <motion.button
            layoutId="nav-leaderboards-btn"
            id="tour-leaderboards"
            type="button"
            onClick={() => {
              setPredictionsOpen(false);
              setSettingsOpen(false);
              onSelectDesktopView?.("leaderboards");
            }}
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

          <div
            id="tour-settings-menu"
            ref={settingsRef}
            className={`relative ${settingsOpen ? "z-50" : ""}`}
          >
            <button
              id="nav-settings-btn"
              type="button"
              aria-label="Settings"
              aria-expanded={settingsOpen}
              aria-haspopup="menu"
              onClick={() => {
                if (forceSettingsOpen) return;
                setSettingsOpen((o) => !o);
                setPredictionsOpen(false);
              }}
              className={`text-slate-300 hover:text-white bg-slate-800/60 p-2 rounded-lg cursor-pointer transition-colors ${
                settingsOpen ? "text-white ring-1 ring-slate-600" : ""
              }`}
            >
              <Menu className="w-5 h-5" />
            </button>

            <AnimatePresence>
              {settingsOpen && (
                <motion.div
                  role="menu"
                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className="absolute right-0 top-full mt-2 z-[60] w-48 rounded-xl border border-slate-700/80 bg-slate-950/95 backdrop-blur-xl shadow-2xl shadow-black/40 p-1.5 overflow-hidden"
                >
                  <button
                    type="button"
                    role="menuitem"
                    id="nav-account-btn"
                    onClick={(e) => {
                      setSettingsOpen(false);
                      onOpenAccount(radialOriginFromEvent(e));
                    }}
                    className="w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-2.5 text-slate-300 hover:bg-slate-800/80 hover:text-white transition-colors cursor-pointer"
                  >
                    <UserCheck className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-semibold">Account</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    id="nav-rules-btn"
                    onClick={(e) => {
                      setSettingsOpen(false);
                      onOpenRules(radialOriginFromEvent(e));
                    }}
                    className="w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-2.5 text-slate-300 hover:bg-slate-800/80 hover:text-white transition-colors cursor-pointer"
                  >
                    <HelpCircle className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-semibold">Rules</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            id="nav-logout-btn"
            type="button"
            onClick={() => setLogoutConfirmOpen(true)}
            className="text-xs text-slate-400 hover:text-red-400 bg-slate-950/60 p-2 rounded-lg cursor-pointer transition-colors"
            title="Log out from PitchSide"
          >
            <LogOut className="w-4.5 h-4.5" />
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
