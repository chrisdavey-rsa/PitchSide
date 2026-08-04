import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trophy, ChevronUp, ChevronDown } from "lucide-react";
import { Match, SportType, UserProfile } from "../../types";
import { getCountryFlag } from "../AccountPortal/data";
import type { LeaderboardItem, LeaderboardScope } from "./leaderboardTypes";
import {
  dbFetchGlobalLeaderboardHorizon,
  type LeaderboardRecord,
} from "../../supabase";
import {
  StandingsHorizon,
  seasonHorizonLabel,
} from "../../lib/leagueStandings";
import { mapLeaderboardForSport } from "../../hooks/usePitchsideQueries";
import LeaderboardPlayerLabel from "./LeaderboardPlayerLabel";
import LeaderboardPlayerProfileModal from "./LeaderboardPlayerProfileModal";
import {
  SportIcon,
  isEmergingSport,
  isSportAccessible,
  useUserRole,
  type SportKey,
} from "../../sports/emerging";

type SortKey = "name" | "points" | "accuracy";
type SortDir = "asc" | "desc";

type SortConfig = {
  key: SortKey;
  direction: SortDir;
};

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

function parseAccuracyPercent(accuracy: string): number {
  const n = Number.parseFloat(String(accuracy).replace("%", ""));
  return Number.isFinite(n) ? n : 0;
}

function SortCaret({
  active,
  direction,
}: {
  active: boolean;
  direction: SortDir;
}) {
  if (!active) {
    return <ChevronDown className="w-3 h-3 opacity-30" aria-hidden />;
  }
  return direction === "desc" ? (
    <ChevronDown className="w-3 h-3 text-emerald-400" aria-hidden />
  ) : (
    <ChevronUp className="w-3 h-3 text-emerald-400" aria-hidden />
  );
}

/**
 * Dedicated Leaderboards shell (mobile Boards tab / desktop Leaderboards view).
 */
export default function LeaderboardsPage({
  user,
  leaderboardList,
  allMatches: _allMatches,
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
  const [boardSport, setBoardSport] = useState<SportKey>(() => {
    const preferred = user.preferredSport as SportKey | undefined;
    return preferred === "rugby" ? "rugby" : "football";
  });
  const [horizon, setHorizon] = useState<StandingsHorizon>("season");
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "points",
    direction: "desc",
  });
  const [formPlayer, setFormPlayer] = useState<LeaderboardItem | null>(null);

  useEffect(() => {
    if (!syncSportFromParent || !activeSport) return;
    setBoardSport((prev) => (prev === activeSport ? prev : activeSport));
  }, [syncSportFromParent, activeSport]);

  useEffect(() => {
    if (isSportAccessible(boardSport, userRole)) return;
    setBoardSport((prev) => (prev === "football" ? prev : "football"));
  }, [boardSport, userRole]);

  const coreSport = coreSportFromKey(boardSport);
  const emergingSelected = isEmergingSport(boardSport);

  // Wider completed window for week/month point sums (season uses RPC totals).
  const { data: horizonLeaderboard = [] } = useQuery({
    queryKey: ["leaderboard", "horizon", horizon, user.id],
    queryFn: () =>
      dbFetchGlobalLeaderboardHorizon(
        horizon === "month" ? "month" : "week",
        user.id,
      ),
    enabled: !emergingSelected && (horizon === "week" || horizon === "month"),
    staleTime: 60_000,
  });

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

    // This Week / This Month — server-side sum within date bounds.
    return mapLeaderboardForSport(
      horizonLeaderboard,
      coreSport,
      user.id,
      {},
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
    horizonLeaderboard,
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

    const filtered = [...source];
    const { key, direction } = sortConfig;

    filtered.sort((a, b) => {
      if (key === "name") {
        const cmp = a.nickname.localeCompare(b.nickname);
        return direction === "asc" ? cmp : -cmp;
      }
      if (key === "accuracy") {
        const aPct = parseAccuracyPercent(a.displayAccuracy);
        const bPct = parseAccuracyPercent(b.displayAccuracy);
        if (aPct !== bPct) {
          return direction === "asc" ? aPct - bPct : bPct - aPct;
        }
        // Tie-break: points, then settled picks.
        if (a.displayPoints !== b.displayPoints) {
          return direction === "asc"
            ? a.displayPoints - b.displayPoints
            : b.displayPoints - a.displayPoints;
        }
        return b.displaySettledPredictions - a.displaySettledPredictions;
      }
      // Total points (default) — cascade: points → Perfect Predictions → Strike Rate → name.
      if (a.displayPoints !== b.displayPoints) {
        return direction === "asc"
          ? a.displayPoints - b.displayPoints
          : b.displayPoints - a.displayPoints;
      }
      if (a.displayPerfectHits !== b.displayPerfectHits) {
        return direction === "asc"
          ? a.displayPerfectHits - b.displayPerfectHits
          : b.displayPerfectHits - a.displayPerfectHits;
      }
      const aStrike =
        a.displaySettledPredictions > 0
          ? a.displayPoints / a.displaySettledPredictions
          : 0;
      const bStrike =
        b.displaySettledPredictions > 0
          ? b.displayPoints / b.displaySettledPredictions
          : 0;
      if (aStrike !== bStrike) {
        return direction === "asc" ? aStrike - bStrike : bStrike - aStrike;
      }
      return a.nickname.localeCompare(b.nickname);
    });

    return filtered.map((row, i) => ({ ...row, rank: i + 1 }));
  }, [baseRows, seasonLeagueAware, horizon, scope, sortConfig]);

  const sportTabs: { id: SportKey; label: string; comingSoon?: boolean }[] = [
    { id: "football", label: "Football" },
    { id: "rugby", label: "Rugby" },
  ];
  if (showEmergingSportTabs) {
    sportTabs.push(
      { id: "formula1", label: "F1", comingSoon: true },
      { id: "golf", label: "Golf", comingSoon: true },
    );
  }

  const toggleSort = (key: SortKey) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return {
          key,
          direction: prev.direction === "asc" ? "desc" : "asc",
        };
      }
      return {
        key,
        direction: key === "name" ? "asc" : "desc",
      };
    });
  };

  const horizonOptions: { id: StandingsHorizon; label: string }[] = [
    { id: "week", label: "This Week" },
    { id: "month", label: "This Month" },
    { id: "season", label: seasonHorizonLabel() },
  ];

  const openPlayerForm = (player: LeaderboardItem) => {
    setFormPlayer(player);
  };

  const colGrid =
    "grid grid-cols-[2.25rem_minmax(0,1fr)_4.5rem_4.25rem] gap-2";

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
            const active = boardSport === tab.id && !tab.comingSoon;
            if (tab.comingSoon) {
              return (
                <span
                  key={tab.id}
                  role="tab"
                  aria-selected={false}
                  aria-disabled="true"
                  title="Coming soon"
                  className="flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider opacity-50 pointer-events-none cursor-not-allowed text-slate-500"
                >
                  <SportIcon sport={tab.id} colored className="h-5 w-5 opacity-60" />
                  <span className="flex flex-col items-start leading-tight">
                    <span>{tab.label}</span>
                    <span className="text-[8px] font-mono normal-case tracking-wider text-slate-600">
                      Coming Soon
                    </span>
                  </span>
                </span>
              );
            }
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
                      : "bg-amber-600 text-white shadow-md"
                    : "text-slate-500 hover:text-slate-300 hover:bg-slate-900"
                }`}
              >
                <SportIcon sport={tab.id} colored className="h-5 w-5" />
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
        data-no-swipe="true"
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
        <div
          className={`${colGrid} px-3 py-2.5 border-b border-slate-800 text-[10px] font-mono uppercase tracking-wider text-slate-500`}
        >
          <span>#</span>
          <button
            type="button"
            onClick={() => toggleSort("name")}
            className="inline-flex items-center gap-1 text-left hover:text-slate-300 cursor-pointer min-w-0"
            aria-sort={
              sortConfig.key === "name"
                ? sortConfig.direction === "asc"
                  ? "ascending"
                  : "descending"
                : "none"
            }
          >
            Name
            <SortCaret
              active={sortConfig.key === "name"}
              direction={sortConfig.direction}
            />
          </button>
          <button
            type="button"
            onClick={() => toggleSort("accuracy")}
            className={`inline-flex items-center justify-end gap-0.5 text-right hover:text-slate-300 cursor-pointer ${
              sortConfig.key === "accuracy" ? "text-emerald-400" : ""
            }`}
            aria-sort={
              sortConfig.key === "accuracy"
                ? sortConfig.direction === "asc"
                  ? "ascending"
                  : "descending"
                : "none"
            }
          >
            Accuracy %
            <SortCaret
              active={sortConfig.key === "accuracy"}
              direction={sortConfig.direction}
            />
          </button>
          <button
            type="button"
            onClick={() => toggleSort("points")}
            className={`inline-flex items-center justify-end gap-0.5 text-right hover:text-slate-300 cursor-pointer ${
              sortConfig.key === "points" ? "text-emerald-400" : ""
            }`}
            aria-sort={
              sortConfig.key === "points"
                ? sortConfig.direction === "asc"
                  ? "ascending"
                  : "descending"
                : "none"
            }
          >
            Total Pts
            <SortCaret
              active={sortConfig.key === "points"}
              direction={sortConfig.direction}
            />
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
            {displayRows.map((item) => {
              const isYou =
                item.isCurrentUser || item.playerId === user.id;
              return (
                <li key={item.playerId}>
                  <button
                    type="button"
                    onClick={() => openPlayerForm(item)}
                    className={`w-full ${colGrid} items-center px-3 py-3 text-left cursor-pointer transition-colors ${
                      isYou
                        ? "bg-emerald-500/5 hover:bg-emerald-500/10"
                        : "hover:bg-slate-950/40"
                    }`}
                  >
                    <span className="font-mono text-[11px] text-slate-500">
                      #{item.rank}
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
                        isYou ? "text-emerald-400" : "text-slate-200"
                      }`}
                    >
                      {item.displayAccuracy}
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

      {formPlayer && (
        <LeaderboardPlayerProfileModal
          playerId={formPlayer.playerId}
          records={
            horizon === "week" || horizon === "month"
              ? horizonLeaderboard
              : leaderboardList
          }
          nickname={formPlayer.nickname}
          firstName={formPlayer.firstName}
          surname={formPlayer.surname}
          nationality={formPlayer.nationality}
          onClose={() => setFormPlayer(null)}
        />
      )}
    </div>
  );
}
