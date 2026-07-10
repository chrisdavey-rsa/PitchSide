import React, { useState } from "react";
import { motion } from "motion/react";
import { Award } from "lucide-react";
import { UserProfile, League } from "../../types";

interface LeagueManagerProps {
  user: UserProfile;
  activeLeagueId: string | null;
  setActiveLeagueId: (id: string | null) => void;
  userLeagues?: League[];
  onJoinLeague?: () => void;
  onCreateLeague?: () => void;
  onViewLeagues?: () => void;
}

type TabType = "joined" | "create" | "join" | "view";

export default function LeagueManager({
  user,
  activeLeagueId,
  setActiveLeagueId,
  userLeagues = [],
  onJoinLeague,
  onCreateLeague,
  onViewLeagues,
}: LeagueManagerProps) {
  const [leagueTab, setLeagueTab] = useState<TabType>("joined");
  const isUserInAnyLeague = userLeagues.length > 0;

  if (activeLeagueId) {
    const activeLeague = userLeagues.find((l) => l.id === activeLeagueId);
    return (
      <motion.div
        key="league-detail-page"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="bg-slate-900/60 rounded-3xl border border-slate-800/70 p-6 flex flex-col justify-between">
          <button
            onClick={() => setActiveLeagueId(null)}
            className="text-[11px] font-mono font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 w-max px-2.5 py-1 rounded cursor-pointer transition-colors"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-display text-white mt-4">
            {activeLeague?.name ?? "League"}
          </h1>
          <p className="text-slate-400 text-xs mt-2">
            League details are managed through the full dashboard view.
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      transition={{ duration: 0.5, ease: "easeInOut" }}
      className={`bg-slate-900/60 rounded-2xl border border-slate-800/70 p-5 flex flex-col justify-between relative overflow-hidden backdrop-blur-xs min-h-[180px] transition-all ${
        !isUserInAnyLeague
          ? "ring-2 ring-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.2)]"
          : ""
      }`}
    >
      <div>
        <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
          <div className="flex items-center gap-1.5">
            <Award className="w-4 h-4 text-yellow-500" />
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
              Leagues
            </h3>
          </div>
          {isUserInAnyLeague && (
            <div className="flex gap-1 text-[10px] font-mono bg-slate-950/80 p-0.5 rounded border border-slate-800/60">
              {(["joined", "view", "join", "create"] as TabType[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setLeagueTab(tab)}
                  className={`px-1.5 py-0.5 rounded transition-all cursor-pointer capitalize ${
                    leagueTab === tab
                      ? "bg-slate-800 text-white font-bold"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-3">
          {!isUserInAnyLeague ? (
            <div className="text-center py-6">
              <p className="text-sm font-bold text-white mb-1">Get Started Here!</p>
              <p className="text-xs text-slate-400 mb-4">
                You need to be in a league to start predicting.
              </p>
              <button
                onClick={onViewLeagues}
                className="text-[10px] font-mono font-bold bg-purple-500 px-3 py-2 rounded-lg text-white cursor-pointer"
              >
                View Leagues
              </button>
            </div>
          ) : leagueTab === "joined" ? (
            <div className="space-y-1.5 max-h-[160px] overflow-y-auto">
              {userLeagues.map((league) => (
                <div
                  key={league.id}
                  onClick={() => setActiveLeagueId(league.id)}
                  className="flex items-center justify-between p-2.5 bg-slate-950/40 hover:bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl cursor-pointer transition-all"
                >
                  <div className="space-y-0.5 truncate pr-2">
                    <h4 className="text-xs font-bold text-white truncate">{league.name}</h4>
                  </div>
                </div>
              ))}
            </div>
          ) : leagueTab === "join" ? (
            <div className="text-center py-6">
              <p className="text-xs text-slate-400 mb-3">
                Have a league code? Join an existing private league.
              </p>
              <button
                onClick={onJoinLeague}
                className="text-[10px] font-mono font-bold bg-blue-600 px-3 py-2 rounded-lg text-white cursor-pointer"
              >
                Enter League Code
              </button>
            </div>
          ) : leagueTab === "create" ? (
            <div className="text-center py-6">
              <p className="text-xs text-slate-400 mb-3">
                Start a new private league and invite your friends.
              </p>
              <button
                onClick={onCreateLeague}
                className="text-[10px] font-mono font-bold bg-emerald-600 px-3 py-2 rounded-lg text-white cursor-pointer"
              >
                Create League
              </button>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-xs text-slate-400 mb-3">
                Browse all available public leagues.
              </p>
              <button
                onClick={onViewLeagues}
                className="text-[10px] font-mono font-bold bg-slate-700 px-3 py-2 rounded-lg text-white cursor-pointer"
              >
                Browse Leagues
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
