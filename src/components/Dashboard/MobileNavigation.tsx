import React from "react";
import { UserCheck, HelpCircle, Users, Trophy } from "lucide-react";
import { UserProfile } from "../../types";
import PitchSideMark from "../PitchSideMark";

export type MobileNavTab =
  | "leagues"
  | "leaderboards"
  | "predictions"
  | "account"
  | "rules";

interface MobileNavigationProps {
  user: UserProfile;
  activeTab: MobileNavTab;
  onSelectTab: (tab: MobileNavTab) => void;
  isUserInAnyLeague?: boolean;
}

const tabBase =
  "flex flex-col items-center justify-end gap-0.5 min-w-0 flex-1 py-1 cursor-pointer";

export default function MobileNavigation({
  user,
  activeTab,
  onSelectTab,
  isUserInAnyLeague = true,
}: MobileNavigationProps) {
  const highlightLeagues = !isUserInAnyLeague;
  void user;

  return (
    <nav
      id="tour-mobile-nav"
      aria-label="Main"
      className="md:hidden fixed bottom-0 left-0 right-0 w-full bg-slate-950/95 backdrop-blur-lg border-t border-slate-800 z-[110] safe-area-pb pointer-events-auto"
    >
      <div className="relative flex items-end justify-between px-1 pt-2 pb-2 max-w-lg mx-auto">
        <button
          id="tour-mobile-leagues"
          type="button"
          aria-current={activeTab === "leagues" ? "page" : undefined}
          onClick={() => onSelectTab("leagues")}
          className={`${tabBase} ${
            highlightLeagues
              ? "text-emerald-300"
              : activeTab === "leagues"
                ? "text-white"
                : "text-slate-500"
          }`}
        >
          <Users
            className={`w-5 h-5 ${
              highlightLeagues
                ? "text-emerald-400"
                : activeTab === "leagues"
                  ? "text-yellow-400"
                  : "text-slate-500"
            }`}
          />
          <span className="text-[9px] font-medium font-sans truncate w-full text-center">
            Leagues
          </span>
        </button>

        <button
          id="tour-mobile-boards"
          type="button"
          aria-current={activeTab === "leaderboards" ? "page" : undefined}
          onClick={() => onSelectTab("leaderboards")}
          className={`${tabBase} ${
            activeTab === "leaderboards" ? "text-white" : "text-slate-500"
          }`}
        >
          <Trophy
            className={`w-5 h-5 ${
              activeTab === "leaderboards" ? "text-amber-400" : "text-slate-500"
            }`}
          />
          <span className="text-[9px] font-medium font-sans truncate w-full text-center">
            Boards
          </span>
        </button>

        <div id="tour-mobile-predictions" className="relative flex-1 flex justify-center -mt-5">
          <button
            type="button"
            aria-label="Predictions"
            aria-current={activeTab === "predictions" ? "page" : undefined}
            onClick={() => onSelectTab("predictions")}
            className="flex flex-col items-center gap-0.5 cursor-pointer"
          >
            <span
              className={`relative flex items-center justify-center w-14 h-14 rounded-2xl shadow-lg shadow-emerald-950/50 border ${
                activeTab === "predictions"
                  ? "border-emerald-400/60 bg-slate-900 ring-2 ring-emerald-500/40"
                  : "border-slate-700 bg-slate-900"
              }`}
            >
              <PitchSideMark size={40} className="rounded-xl" />
            </span>
            <span
              className={`text-[9px] font-bold font-sans ${
                activeTab === "predictions" ? "text-emerald-300" : "text-slate-400"
              }`}
            >
              Predictions
            </span>
          </button>
        </div>

        <button
          id="tour-mobile-account"
          type="button"
          aria-current={activeTab === "account" ? "page" : undefined}
          onClick={() => onSelectTab("account")}
          className={`${tabBase} ${
            activeTab === "account" ? "text-white" : "text-slate-500"
          }`}
        >
          <UserCheck
            className={`w-5 h-5 ${
              activeTab === "account" ? "text-emerald-400" : "text-slate-500"
            }`}
          />
          <span className="text-[9px] font-medium font-sans truncate w-full text-center">
            Account
          </span>
        </button>

        <button
          id="tour-mobile-rules"
          type="button"
          aria-current={activeTab === "rules" ? "page" : undefined}
          onClick={() => onSelectTab("rules")}
          className={`${tabBase} ${
            activeTab === "rules" ? "text-white" : "text-slate-500"
          }`}
        >
          <HelpCircle
            className={`w-5 h-5 ${
              activeTab === "rules" ? "text-blue-400" : "text-slate-500"
            }`}
          />
          <span className="text-[9px] font-medium font-sans truncate w-full text-center">
            Rules
          </span>
        </button>
      </div>
    </nav>
  );
}
