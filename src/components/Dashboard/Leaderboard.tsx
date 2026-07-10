/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Trophy } from "lucide-react";
import { UserProfile, SportType } from "../../types";

interface LeaderboardProps {
  user: UserProfile;
  // In production, pass down the displayLeaderboard array from a custom hook like useLeaderboard()
}

export default function Leaderboard({ user }: LeaderboardProps) {
  const [globalLeaderboardSport, setGlobalLeaderboardSport] = useState<SportType>(SportType.FOOTBALL);

  // Mock data structure based on your original calculation map
  const mockLeaderboard = [
    { playerId: "1", rank: 1, nickname: "Admin", nationality: "gb", displayPredictions: 15, displayAccuracy: "65%", displayPoints: 120, isCurrentUser: false },
    { playerId: user.id, rank: 2, nickname: user.nickname, nationality: "gb", displayPredictions: 12, displayAccuracy: "60%", displayPoints: 110, isCurrentUser: true }
  ];

  return (
    <div className="bg-slate-900/60 rounded-3xl border border-slate-800 p-6 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          <h3 className="text-sm font-bold font-display text-white uppercase tracking-wider">
            Consolidated PitchSide Leaderboard
          </h3>
        </div>
        <div className="flex items-center gap-2 bg-slate-950/50 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setGlobalLeaderboardSport(SportType.FOOTBALL)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
              globalLeaderboardSport === SportType.FOOTBALL
                ? "bg-slate-800 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-300 hover:bg-slate-900/50"
            }`}
          >
            <span className="text-sm">⚽</span> Football
          </button>
          <button
            onClick={() => setGlobalLeaderboardSport(SportType.RUGBY)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
              globalLeaderboardSport === SportType.RUGBY
                ? "bg-slate-800 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-300 hover:bg-slate-900/50"
            }`}
          >
            <span className="text-sm">🏉</span> Rugby
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-sans">
          <thead>
            <tr className="border-b border-slate-800 font-mono text-slate-500 text-[10px] uppercase">
              <th className="py-2.5 px-3">Rank</th>
              <th className="py-2.5 px-3">Player</th>
              <th className="py-2.5 px-3 text-center">Guesses Saved</th>
              <th className="py-2.5 px-3 text-center">Prediction Accuracy</th>
              <th className="py-2.5 px-3 text-right">Overall Points</th>
            </tr>
          </thead>
          <tbody>
            {mockLeaderboard.map((item) => {
              const isYou = item.isCurrentUser;
              return (
                <tr
                  key={item.playerId}
                  className={`transition-colors border-b border-slate-800/40 ${
                    isYou ? "bg-emerald-500/5 hover:bg-emerald-500/10" : "hover:bg-slate-950/20"
                  }`}
                >
                  <td className="py-3 px-3">
                    {isYou ? (
                      <span className="flex items-center justify-center w-5.5 h-5.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold text-[10px]">
                        ★
                      </span>
                    ) : (
                      <span className="font-mono text-slate-400">#{item.rank}</span>
                    )}
                  </td>
                  <td className={`py-3 px-3 font-semibold ${isYou ? "text-white" : "text-slate-200"}`}>
                    {item.nickname}
                  </td>
                  <td className="py-3 px-3 text-center font-mono text-slate-300">
                    {item.displayPredictions}
                  </td>
                  <td className="className=py-3 px-3 text-center font-mono text-slate-300">
                    {item.displayAccuracy}
                  </td>
                  <td className={`py-3 px-3 text-right font-display font-semibold text-sm ${isYou ? "text-emerald-400" : "text-slate-300"}`}>
                    {item.displayPoints}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}