import React, { useMemo } from "react";
import { Trophy, Users, Globe } from "lucide-react";
import { UserProfile, SportType } from "../../types";
import { getCountryFlag } from "../AccountPortal/data";

export interface LeaderboardItem {
  playerId: string;
  rank: number;
  nickname: string;
  nationality: string;
  displayPredictions: number;
  displayAccuracy: string;
  displayPoints: number;
  displayGhostPoints: number;
  displayDropsUsed: number;
  displayDropsAllowed: number;
  isCurrentUser: boolean;
  isProfilePublic: boolean;
}

export type LeaderboardScope = "league" | "global";

interface LeaderboardProps {
  user: UserProfile;
  displayLeaderboard: LeaderboardItem[];
  globalLeaderboardSport: SportType;
  setGlobalLeaderboardSport: (sport: SportType) => void;
  onViewProfile: (player: LeaderboardItem) => void;
  triggerToast: (message: string) => void;
  /** Current leaderboard scope (My League vs Global). */
  scope?: LeaderboardScope;
  setScope?: (scope: LeaderboardScope) => void;
  /** Whether the user belongs to at least one private league. */
  hasPrivateLeague?: boolean;
  /** Name of the private league shown under the "My League" tab. */
  leagueName?: string;
}

type DisplayRow =
  | { kind: "player"; item: LeaderboardItem }
  | { kind: "ellipsis" };

export default function Leaderboard({
  user,
  displayLeaderboard,
  globalLeaderboardSport,
  setGlobalLeaderboardSport,
  onViewProfile,
  triggerToast,
  scope = "global",
  setScope,
  hasPrivateLeague = false,
  leagueName,
}: LeaderboardProps) {
  // Neighborhood view: once the current user drops out of the Top 5, condense
  // the table to the Top 3, an ellipsis, then the player directly above them,
  // the user, and the player directly below — a localized target to chase.
  const rows: DisplayRow[] = useMemo(() => {
    const list = displayLeaderboard;
    const meIndex = list.findIndex(
      (i) => i.isCurrentUser || i.playerId === user.id,
    );

    // Inside the Top 5 (or not on the board) → show the full standings.
    if (meIndex < 5) {
      return list.map((item) => ({ kind: "player", item }) as DisplayRow);
    }

    const out: DisplayRow[] = [];
    list.slice(0, 3).forEach((item) => out.push({ kind: "player", item }));

    const neighborStart = meIndex - 1;
    if (neighborStart > 3) out.push({ kind: "ellipsis" });

    list
      .slice(neighborStart, meIndex + 2)
      .forEach((item) => out.push({ kind: "player", item }));

    return out;
  }, [displayLeaderboard, user.id]);

  const title =
    scope === "league"
      ? `${leagueName || "My League"} Standings`
      : "Consolidated PitchSide Leaderboard";

  const renderPlayerRow = (item: LeaderboardItem) => {
    const isYou = item.isCurrentUser || item.playerId === user.id;
    return (
      <tr
        key={item.playerId}
        className={`transition-colors border-b border-slate-800/40 ${
          isYou
            ? "bg-emerald-500/5 hover:bg-emerald-500/10"
            : "hover:bg-slate-950/20"
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
        <td
          className={`py-3 px-3 font-semibold flex items-center gap-1.5 ${
            isYou ? "text-white" : "text-slate-200"
          }`}
        >
          <button
            onClick={() => {
              if (item.isProfilePublic) {
                onViewProfile(item);
              } else {
                triggerToast("🔒 This player's profile is private.");
              }
            }}
            className="hover:underline cursor-pointer"
          >
            {item.nickname}
          </button>
          <span
            className="text-sm shrink-0 font-sans"
            title={item.nationality || "United Kingdom"}
          >
            {getCountryFlag(item.nationality)}
          </span>
          {item.displayDropsAllowed > 0 ? (
            <span
              className={`shrink-0 rounded-full border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider ${
                item.displayDropsAllowed - item.displayDropsUsed > 0
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  : "border-slate-700 bg-slate-800/60 text-slate-500"
              }`}
              title={`Forgiveness drops remaining for this sport. Your worst results are removed from your total, up to ${item.displayDropsAllowed} for the competitions you've entered.`}
            >
              Drops: {item.displayDropsAllowed - item.displayDropsUsed}
            </span>
          ) : (
            <span
              className="shrink-0 rounded-full border border-slate-800 bg-slate-900/60 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-slate-600"
              title="This sport's competitions don't allow any dropped results."
            >
              No drops
            </span>
          )}
        </td>
        <td className="py-3 px-3 text-center font-mono text-slate-300">
          {item.displayPredictions}
        </td>
        <td className="py-3 px-3 text-center font-mono text-slate-300">
          {item.displayAccuracy}
        </td>
        <td
          className="py-3 px-3 text-right font-mono text-slate-600"
          title="Total points if your worst weeks weren't dropped."
        >
          {item.displayGhostPoints}
        </td>
        <td
          className={`py-3 px-3 text-right font-display font-semibold text-sm ${
            isYou ? "text-emerald-400" : "text-slate-300"
          }`}
        >
          {item.displayPoints}
        </td>
      </tr>
    );
  };

  return (
    <div className="bg-slate-900/60 rounded-3xl border border-slate-800 p-6 shadow-xl">
      <div className="flex flex-col gap-4 mb-4 border-b border-slate-800/80 pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            <h3 className="text-sm font-bold font-display text-white uppercase tracking-wider">
              {title}
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

        {/* My League vs Global scope tabs (only when the user has a private league) */}
        {hasPrivateLeague && setScope && (
          <div className="flex items-center gap-2 bg-slate-950/50 p-1 rounded-lg border border-slate-800 self-start">
            <button
              onClick={() => setScope("league")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                scope === "league"
                  ? "bg-emerald-500/15 text-emerald-300 shadow-sm"
                  : "text-slate-500 hover:text-slate-300 hover:bg-slate-900/50"
              }`}
            >
              <Users className="w-3.5 h-3.5" /> My League
            </button>
            <button
              onClick={() => setScope("global")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                scope === "global"
                  ? "bg-slate-800 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-300 hover:bg-slate-900/50"
              }`}
            >
              <Globe className="w-3.5 h-3.5" /> Global
            </button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-sans">
          <thead>
            <tr className="border-b border-slate-800 font-mono text-slate-500 text-[10px] uppercase">
              <th className="py-2.5 px-3">Rank</th>
              <th className="py-2.5 px-3">Player</th>
              <th className="py-2.5 px-3 text-center">Guesses Saved</th>
              <th className="py-2.5 px-3 text-center">Prediction Accuracy</th>
              <th
                className="py-2.5 px-3 text-right"
                title="Total points if your worst weeks weren't dropped."
              >
                Ghost Points
              </th>
              <th className="py-2.5 px-3 text-right">Overall Points</th>
            </tr>
          </thead>
          <tbody>
            {displayLeaderboard.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-slate-500 text-xs font-sans">
                  {scope === "league"
                    ? "No predictions recorded yet in this league for this sport."
                    : "No predictions recorded yet for this sport. Be the first to lock a prediction!"}
                </td>
              </tr>
            ) : (
              rows.map((row, idx) =>
                row.kind === "ellipsis" ? (
                  <tr key={`ellipsis-${idx}`} className="border-b border-slate-800/40">
                    <td
                      colSpan={6}
                      className="py-2 text-center text-slate-600 font-mono text-sm tracking-[0.4em] select-none"
                    >
                      • • •
                    </td>
                  </tr>
                ) : (
                  renderPlayerRow(row.item)
                ),
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
