import React, { useMemo, useState } from "react";
import { Trophy, ArrowUpDown, X } from "lucide-react";
import { Match, SportType, UserProfile } from "../../types";
import { calculatePoints } from "../../utils";
import { getCountryFlag } from "../AccountPortal/data";
import type { LeaderboardItem, LeaderboardScope } from "./Leaderboard";
import type { LeaderboardRecord } from "../../supabase";
import {
  StandingsHorizon,
  isMatchInHorizon,
  seasonHorizonLabel,
} from "../../lib/leagueStandings";
import { mapLeaderboardForSport } from "../../hooks/usePitchsideQueries";

type SortKey = "name" | "points";
type SortDir = "asc" | "desc";

interface LeaderboardsPageProps {
  user: UserProfile;
  leaderboardList: LeaderboardRecord[];
  allMatches: Match[];
  provisionalByUser?: Record<string, number>;
  scope?: LeaderboardScope;
  setScope?: (scope: LeaderboardScope) => void;
  hasPrivateLeague?: boolean;
  leagueName?: string;
  /** Pre-filtered league-scoped season rows (when scope === league). */
  leagueSeasonRows?: LeaderboardItem[];
  globalSeasonRows?: LeaderboardItem[];
}

function recomputedHorizonRows(
  records: LeaderboardRecord[],
  matches: Match[],
  sport: SportType,
  horizon: StandingsHorizon,
  currentUserId: string,
): LeaderboardItem[] {
  const matchById = new Map(matches.map((m) => [m.id, m]));

  const rows = records
    .map((rec) => {
      let points = 0;
      let made = 0;
      let correct = 0;

      Object.entries(rec.predictions || {}).forEach(([matchId, pred]) => {
        if (!pred?.submitted) return;
        const match = matchById.get(matchId);
        if (!match || match.sport !== sport) return;
        if (!isMatchInHorizon(match, horizon)) return;
        if (match.homeScore === undefined || match.awayScore === undefined) return;

        const pts = calculatePoints(
          match.sport,
          pred.home,
          pred.away,
          match.homeScore,
          match.awayScore,
        );
        made += 1;
        points += pts;
        if (pts > 0) correct += 1;
      });

      if (made === 0) return null;

      return {
        ...rec,
        displayPoints: points,
        displayPredictions: made,
        displayAccuracy: `${Math.round((correct / made) * 100)}%`,
        displayGhostPoints: points,
        displayDropsUsed: 0,
        displayDropsAllowed: 0,
        displayProvisionalPoints: 0,
        rank: 0,
        isCurrentUser: rec.isCurrentUser || rec.playerId === currentUserId,
      } as LeaderboardItem;
    })
    .filter((r): r is LeaderboardItem => r !== null);

  rows.sort((a, b) => b.displayPoints - a.displayPoints);
  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

/**
 * Dedicated Leaderboards shell (mobile Boards tab / desktop Leaderboards view).
 */
export default function LeaderboardsPage({
  user,
  leaderboardList,
  allMatches,
  provisionalByUser = {},
  scope = "global",
  setScope,
  hasPrivateLeague = false,
  leagueName,
  leagueSeasonRows,
  globalSeasonRows,
}: LeaderboardsPageProps) {
  const [sport, setSport] = useState<SportType>(
    () => user.preferredSport ?? SportType.FOOTBALL,
  );
  const [horizon, setHorizon] = useState<StandingsHorizon>("season");
  const [sortKey, setSortKey] = useState<SortKey>("points");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [formPlayer, setFormPlayer] = useState<LeaderboardItem | null>(null);

  const baseRows = useMemo(() => {
    if (horizon === "season") {
      if (scope === "league" && leagueSeasonRows) {
        return leagueSeasonRows.filter((r) =>
          sport === SportType.FOOTBALL
            ? r.displayPredictions >= 0
            : r.displayPredictions >= 0,
        );
      }
      if (globalSeasonRows && scope === "global") {
        // Re-map when sport changes from parent season cache for the active sport.
        return mapLeaderboardForSport(
          leaderboardList,
          sport,
          user.id,
          provisionalByUser,
        );
      }
      return mapLeaderboardForSport(
        leaderboardList,
        sport,
        user.id,
        provisionalByUser,
      );
    }

    return recomputedHorizonRows(
      leaderboardList,
      allMatches,
      sport,
      horizon,
      user.id,
    );
  }, [
    horizon,
    scope,
    leagueSeasonRows,
    globalSeasonRows,
    leaderboardList,
    sport,
    user.id,
    provisionalByUser,
    allMatches,
  ]);

  // When league scope + season, parent rows are already sport-filtered — refresh
  // from leaderboardList filtered to league members is handled upstream.
  const seasonLeagueAware = useMemo(() => {
    if (horizon !== "season" || scope !== "league" || !leagueSeasonRows) {
      return baseRows;
    }
    // leagueSeasonRows from parent use globalLeaderboardSport — remap locally.
    return mapLeaderboardForSport(
      leaderboardList.filter((r) =>
        leagueSeasonRows.some((l) => l.playerId === r.playerId),
      ),
      sport,
      user.id,
      provisionalByUser,
    );
  }, [
    horizon,
    scope,
    leagueSeasonRows,
    baseRows,
    leaderboardList,
    sport,
    user.id,
    provisionalByUser,
  ]);

  const displayRows = useMemo(() => {
    const source = horizon === "season" && scope === "league" ? seasonLeagueAware : baseRows;
    const sorted = [...source];
    sorted.sort((a, b) => {
      if (sortKey === "name") {
        const cmp = a.nickname.localeCompare(b.nickname);
        return sortDir === "asc" ? cmp : -cmp;
      }
      const cmp = a.displayPoints - b.displayPoints;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [baseRows, seasonLeagueAware, horizon, scope, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  };

  const horizonOptions: { id: StandingsHorizon; label: string }[] = [
    { id: "season", label: seasonHorizonLabel() },
    { id: "month", label: "This Month" },
    { id: "week", label: "This Week" },
  ];

  const openPlayerForm = (player: LeaderboardItem) => {
    console.log("[LeaderboardsPage] player form drill-down", {
      playerId: player.playerId,
      nickname: player.nickname,
      sport,
      horizon,
    });
    setFormPlayer(player);
  };

  return (
    <div className="space-y-4 w-full">
      <div className="flex items-center gap-2 px-0.5">
        <Trophy className="w-5 h-5 text-amber-400" />
        <div>
          <h1 className="text-xl font-display font-extrabold text-white tracking-tight">
            Leaderboards
          </h1>
          <p className="text-xs text-slate-500 font-sans">
            {scope === "league"
              ? leagueName || "My League"
              : "Global PitchSide rankings"}
          </p>
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Sport"
        className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-950/70 border border-slate-800"
      >
        {(
          [
            { id: SportType.FOOTBALL, label: "Football" },
            { id: SportType.RUGBY, label: "Rugby" },
          ] as const
        ).map((tab) => {
          const active = sport === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSport(tab.id)}
              className={`py-2.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                active
                  ? tab.id === SportType.FOOTBALL
                    ? "bg-blue-600 text-white shadow-md"
                    : "bg-amber-600 text-white shadow-md"
                  : "text-slate-500 hover:text-slate-300 hover:bg-slate-900"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div
        role="tablist"
        aria-label="Time horizon"
        className="flex gap-1.5 overflow-x-auto pb-0.5"
      >
        {horizonOptions.map((opt) => {
          const active = horizon === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setHorizon(opt.id)}
              className={`shrink-0 px-3.5 py-2 rounded-full text-[10px] font-mono font-bold uppercase tracking-wide border transition-colors cursor-pointer ${
                active
                  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                  : "bg-slate-950/50 border-slate-800 text-slate-500 hover:text-slate-300"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {hasPrivateLeague && setScope && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setScope("league")}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase cursor-pointer ${
              scope === "league"
                ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                : "text-slate-500 border border-slate-800"
            }`}
          >
            My League
          </button>
          <button
            type="button"
            onClick={() => setScope("global")}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase cursor-pointer ${
              scope === "global"
                ? "bg-slate-800 text-white border border-slate-700"
                : "text-slate-500 border border-slate-800"
            }`}
          >
            Global
          </button>
        </div>
      )}

      <div className="bg-slate-900/60 rounded-2xl border border-slate-800 overflow-hidden">
        <div className="grid grid-cols-[2.5rem_1fr_4.5rem] gap-2 px-3 py-2.5 border-b border-slate-800 text-[10px] font-mono uppercase tracking-wider text-slate-500">
          <span>#</span>
          <button
            type="button"
            onClick={() => toggleSort("name")}
            className="inline-flex items-center gap-1 text-left hover:text-slate-300 cursor-pointer"
          >
            Name
            <ArrowUpDown className="w-3 h-3 opacity-60" />
            {sortKey === "name" && (
              <span className="text-emerald-400">{sortDir === "asc" ? "A–Z" : "Z–A"}</span>
            )}
          </button>
          <button
            type="button"
            onClick={() => toggleSort("points")}
            className="inline-flex items-center justify-end gap-1 hover:text-slate-300 cursor-pointer"
          >
            Points
            <ArrowUpDown className="w-3 h-3 opacity-60" />
            {sortKey === "points" && (
              <span className="text-emerald-400">
                {sortDir === "desc" ? "Hi" : "Lo"}
              </span>
            )}
          </button>
        </div>

        {displayRows.length === 0 ? (
          <p className="py-12 text-center text-xs text-slate-500 font-mono px-4">
            No settled results in this window yet.
          </p>
        ) : (
          <ul className="divide-y divide-slate-800/60">
            {displayRows.map((item, idx) => {
              const isYou =
                item.isCurrentUser || item.playerId === user.id;
              return (
                <li key={item.playerId}>
                  <button
                    type="button"
                    onClick={() => openPlayerForm(item)}
                    className={`w-full grid grid-cols-[2.5rem_1fr_4.5rem] gap-2 items-center px-3 py-3 text-left cursor-pointer transition-colors ${
                      isYou
                        ? "bg-emerald-500/5 hover:bg-emerald-500/10"
                        : "hover:bg-slate-950/40"
                    }`}
                  >
                    <span className="font-mono text-[11px] text-slate-500">
                      #{sortKey === "points" && sortDir === "desc" ? item.rank : idx + 1}
                    </span>
                    <span className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={`font-semibold text-sm truncate ${
                          isYou ? "text-emerald-300" : "text-slate-100"
                        }`}
                      >
                        {item.nickname}
                      </span>
                      <span className="text-sm shrink-0" title={item.nationality}>
                        {getCountryFlag(item.nationality)}
                      </span>
                    </span>
                    <span
                      className={`text-right font-display font-bold text-sm tabular-nums ${
                        isYou ? "text-emerald-400" : "text-white"
                      }`}
                    >
                      {item.displayPoints}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Stub: recent weekly form modal */}
      {formPlayer && (
        <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-6 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                  Recent form
                </p>
                <h3 className="text-lg font-display font-extrabold text-white">
                  {formPlayer.nickname}
                </h3>
                <p className="text-xs text-slate-400 font-mono mt-1">
                  {formPlayer.displayPoints} pts · {formPlayer.displayPredictions}{" "}
                  picks · {formPlayer.displayAccuracy} accuracy
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFormPlayer(null)}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/50 px-4 py-8 text-center">
              <p className="text-xs text-slate-500 font-sans leading-relaxed">
                Weekly form &amp; recent scores for {formPlayer.nickname} will
                appear here. (Placeholder)
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFormPlayer(null)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-bold uppercase cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
