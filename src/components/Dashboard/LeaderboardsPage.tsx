import React, { useEffect, useMemo, useState } from "react";
import { Trophy, ArrowUpDown, X } from "lucide-react";
import { Match, SportType, UserProfile } from "../../types";
import { calculatePoints } from "../../utils";
import { getCountryFlag } from "../AccountPortal/data";
import type { LeaderboardItem, LeaderboardScope } from "./leaderboardTypes";
import type { LeaderboardRecord } from "../../supabase";
import {
  StandingsHorizon,
  isMatchInHorizon,
  seasonHorizonLabel,
} from "../../lib/leagueStandings";
import { mapLeaderboardForSport } from "../../hooks/usePitchsideQueries";
import LeaderboardPlayerLabel, {
  formatPlayerRealName,
} from "./LeaderboardPlayerLabel";
import {
  SportIcon,
  isEmergingSport,
  isSportAccessible,
  useUserRole,
  type SportKey,
} from "../../sports/emerging";

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
  /**
   * When set with `syncSportFromParent`, rankings follow Dashboard `activeSport`
   * and the local sport toggle is hidden (sidebar embed).
   */
  activeSport?: SportKey;
  syncSportFromParent?: boolean;
  /** Dedicated Leaderboards page: show Golf/F1 toggles for admins. */
  showEmergingSportTabs?: boolean;
}

function coreSportFromKey(sport: SportKey): SportType | null {
  if (sport === "football") return SportType.FOOTBALL;
  if (sport === "rugby") return SportType.RUGBY;
  return null;
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
  activeSport,
  syncSportFromParent = false,
  showEmergingSportTabs = false,
}: LeaderboardsPageProps) {
  const userRole = useUserRole(user.id, user.isAdmin);
  const [boardSport, setBoardSport] = useState<SportKey>(
    () => (user.preferredSport as SportKey | undefined) ?? "football",
  );
  const [horizon, setHorizon] = useState<StandingsHorizon>("season");
  const [sortKey, setSortKey] = useState<SortKey>("points");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [formPlayer, setFormPlayer] = useState<LeaderboardItem | null>(null);

  useEffect(() => {
    if (syncSportFromParent && activeSport) {
      setBoardSport(activeSport);
    }
  }, [syncSportFromParent, activeSport]);

  useEffect(() => {
    if (!isSportAccessible(boardSport, userRole)) {
      setBoardSport("football");
    }
  }, [boardSport, userRole]);

  const coreSport = coreSportFromKey(boardSport);
  const emergingSelected = isEmergingSport(boardSport);

  const baseRows = useMemo(() => {
    if (emergingSelected || !coreSport) return [];

    if (horizon === "season") {
      if (scope === "league" && leagueSeasonRows) {
        return leagueSeasonRows.filter((r) => r.displayPredictions >= 0);
      }
      if (globalSeasonRows && scope === "global") {
        return mapLeaderboardForSport(
          leaderboardList,
          coreSport,
          user.id,
          provisionalByUser,
        );
      }
      return mapLeaderboardForSport(
        leaderboardList,
        coreSport,
        user.id,
        provisionalByUser,
      );
    }

    return recomputedHorizonRows(
      leaderboardList,
      allMatches,
      coreSport,
      horizon,
      user.id,
    );
  }, [
    emergingSelected,
    coreSport,
    horizon,
    scope,
    leagueSeasonRows,
    globalSeasonRows,
    leaderboardList,
    user.id,
    provisionalByUser,
    allMatches,
  ]);

  const seasonLeagueAware = useMemo(() => {
    if (
      emergingSelected ||
      !coreSport ||
      horizon !== "season" ||
      scope !== "league" ||
      !leagueSeasonRows
    ) {
      return baseRows;
    }
    return mapLeaderboardForSport(
      leaderboardList.filter((r) =>
        leagueSeasonRows.some((l) => l.playerId === r.playerId),
      ),
      coreSport,
      user.id,
      provisionalByUser,
    );
  }, [
    emergingSelected,
    coreSport,
    horizon,
    scope,
    leagueSeasonRows,
    baseRows,
    leaderboardList,
    user.id,
    provisionalByUser,
  ]);

  const displayRows = useMemo(() => {
    const source =
      horizon === "season" && scope === "league" ? seasonLeagueAware : baseRows;
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

  const sportTabs: { id: SportKey; label: string }[] = [
    { id: "football", label: "Football" },
    { id: "rugby", label: "Rugby" },
  ];
  if (showEmergingSportTabs && userRole === "admin") {
    sportTabs.push(
      { id: "formula1", label: "Formula 1" },
      { id: "golf", label: "Golf" },
    );
  }

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

      {!syncSportFromParent && (
        <div
          role="tablist"
          aria-label="Sport"
          className={`grid gap-1.5 p-1 rounded-xl bg-slate-950/70 border border-slate-800 ${
            sportTabs.length > 2 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2"
          }`}
        >
          {sportTabs.map((tab) => {
            const active = boardSport === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setBoardSport(tab.id)}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                  active
                    ? tab.id === "football"
                      ? "bg-blue-600 text-white shadow-md"
                      : tab.id === "rugby"
                        ? "bg-amber-600 text-white shadow-md"
                        : tab.id === "formula1"
                          ? "bg-red-600/90 text-white shadow-md"
                          : "bg-emerald-600 text-white shadow-md"
                    : "text-slate-500 hover:text-slate-300 hover:bg-slate-900"
                }`}
              >
                <SportIcon sport={tab.id} colored className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      {syncSportFromParent && (
        <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider px-0.5">
          Rankings ·{" "}
          <span className="text-slate-300">
            {boardSport === "formula1"
              ? "Formula 1"
              : boardSport.charAt(0).toUpperCase() + boardSport.slice(1)}
          </span>
        </p>
      )}

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

        {emergingSelected ? (
          <p className="py-12 text-center text-xs text-slate-500 font-mono px-4">
            Rankings for this sport unlock with the public launch.
          </p>
        ) : displayRows.length === 0 ? (
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
                    <span className="flex items-center gap-2 min-w-0">
                      <span
                        className="text-sm shrink-0 leading-none"
                        title={item.nationality}
                        aria-hidden
                      >
                        {getCountryFlag(item.nationality)}
                      </span>
                      <LeaderboardPlayerLabel
                        nickname={item.nickname}
                        firstName={item.firstName}
                        surname={item.surname}
                        nicknameClassName={`text-sm ${
                          isYou ? "text-emerald-300" : "text-slate-100"
                        }`}
                        className="min-w-0 flex-1"
                      />
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
                {formatPlayerRealName(formPlayer.firstName, formPlayer.surname) ? (
                  <p className="text-[11px] font-light tracking-[0.04em] text-slate-500 mt-0.5">
                    {formatPlayerRealName(formPlayer.firstName, formPlayer.surname)}
                  </p>
                ) : null}
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
