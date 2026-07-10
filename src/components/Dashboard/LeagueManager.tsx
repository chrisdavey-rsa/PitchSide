/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { motion } from "motion/react";
import { Award, Trophy, ChevronRight } from "lucide-react";
import { UserProfile, League } from "../../types";
import { getCompetitions } from "../../competitions";

interface LeagueManagerProps {
  user: UserProfile;
  activeLeagueId: string | null;
  setActiveLeagueId: (id: string | null) => void;
  userLeagues?: League[];
}

type TabType = "joined" | "create" | "join" | "view";

export default function LeagueManager({
  user,
  activeLeagueId,
  setActiveLeagueId,
  userLeagues = [],
}: LeagueManagerProps) {
  const [leagueTab, setLeagueTab] = useState<TabType>("joined");
  const isUserInAnyLeague = userLeagues.length > 0;

  // If a specific league is active, we render the Detailed League View (Standings, Rivalries)
  if (activeLeagueId) {
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
              Detailed League Dashboard
            </h1>
            <p className="text-slate-400 text-xs mt-2">
                This area will house the specific Standings Table and the Live Match Comparison Matrix for League ID: {activeLeagueId}.
            </p>
            {/* Note: Insert your existing Standings Map and Participant Loops here */}
        </div>
      </motion.div>
    );
  }

  // Otherwise, render the Console to manage, view, or join leagues
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
              {["joined", "view", "join", "create"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setLeagueTab(tab as TabType)}
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

        {/* Tab Content Router */}
        <div className="mt-3">
          {!isUserInAnyLeague ? (
             <div className="text-center py-6">
                 <p className="text-sm font-bold text-white mb-1">Get Started Here!</p>
                 <p className="text-xs text-slate-400 mb-4">You need to be in a league to start predicting.</p>
                 <button onClick={() => setLeagueTab("view")} className="text-[10px] font-mono font-bold bg-purple-500 px-3 py-2 rounded-lg text-white">View Leagues</button>
             </div>
          ) : leagueTab === "joined" ? (
             <div className="space-y-1.5 max-h-[160px] overflow-y-auto">
                {userLeagues.map((league) => (
                  <div
                    key={league.id}
                    onClick={() => setActiveLeagueId(league.id)}
                    className="flex items-center justify-between p-2.5 bg-slate-950/40 hover:bg-slate-950 border border-slate-850 hover:border-slate-800 rounded-xl cursor-pointer transition-all"
                  >
                    <div className="space-y-0.5 truncate pr-2">
                      <h4 className="text-xs font-bold text-white truncate">{league.name}</h4>
                    </div>
                  </div>
                ))}
             </div>
          ) : (
              <div className="text-center py-6 text-xs text-slate-500">
                  {/* Insert forms for Create/Join/View All Leagues here */}
                  Render {leagueTab} component form here.
              </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}