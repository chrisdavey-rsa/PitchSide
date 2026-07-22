import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Trophy, ChevronRight, Target, Loader2, ChevronDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Match, SportType, UserProfile } from "../../types";
import { dbFetchMatches } from "../../supabase";
import {
  useLeaderboardQuery,
  useLeagueMembersQuery,
  useLeagueStandingsPredictionsQuery,
} from "../../hooks/usePitchsideQueries";
import { getCountryFlag } from "./shared";
import {
  StandingsHorizon,
  buildLeagueSportStandings,
  countSubmittedForSport,
  seasonHorizonLabel,
  type LeaguePredictionRow,
  type LeagueStandingRow,
} from "../../lib/leagueStandings";
import { selectVisibleRankedMembers } from "../../lib/leagueMemberVisibility";
import { isGlobalLeague } from "../../lib/leaguesConfig";
import type { PredictionEntry } from "../../supabase";
import LeaderboardPlayerLabel from "./LeaderboardPlayerLabel";
import { SportIcon } from "../../sports/emerging";

interface LeagueHubStandingsProps {
  leagueId: string;
  user: UserProfile;
  registeredUsers: UserProfile[];
  activeLeagueMembers: string[];
  /** Local draft/locked picks — used for instant unlock after submit. */
  userPredictions: Record<string, PredictionEntry>;
  /** Horizon matches (may be incomplete for season totals). */
  horizonMatches: Match[];
  expandedStandingsUser: string | null;
  setExpandedStandingsUser: (id: string | null) => void;
}

function defaultSportTab(preferred?: SportType | null): SportType {
  return preferred === SportType.RUGBY ? SportType.RUGBY : SportType.FOOTBALL;
}

export default function LeagueHubStandings({
  leagueId,
  user,
  registeredUsers,
  activeLeagueMembers,
  userPredictions,
  horizonMatches,
  expandedStandingsUser,
  setExpandedStandingsUser,
}: LeagueHubStandingsProps) {
  const [sportTab, setSportTab] = useState<SportType>(() =>
    defaultSportTab(user.preferredSport),
  );
  const [horizon, setHorizon] = useState<StandingsHorizon>("season");
  /** Private leagues: extra others beyond the initial top-9 (+10 per click). */
  const [extraOthers, setExtraOthers] = useState(0);
  const isGlobal = isGlobalLeague(leagueId);

  useEffect(() => {
    setSportTab(defaultSportTab(user.preferredSport));
  }, [user.preferredSport]);

  useEffect(() => {
    setExtraOthers(0);
  }, [leagueId, sportTab, horizon]);

  // Private leagues: one batched predictions query. Global: reuse leaderboard RPC (no N+1 / full roster).
  const { data: predictionRows = [], isLoading: predsLoading } =
    useLeagueStandingsPredictionsQuery(
      isGlobal ? null : leagueId,
      isGlobal ? [] : activeLeagueMembers,
    );

  const { data: leaderboardList = [], isLoading: leaderboardLoading } =
    useLeaderboardQuery(user.id, horizonMatches);

  const { data: memberProfiles = [], isLoading: membersLoading } =
    useLeagueMembersQuery(leagueId);

  const { data: completedMatches = [], isLoading: matchesLoading } = useQuery({
    queryKey: ["completedMatches", "leagueStandings"],
    queryFn: () =>
      dbFetchMatches({ horizonDays: null, status: "completed" }),
    staleTime: 60_000,
    enabled: !isGlobal,
  });

  const matchesForEngine = useMemo(() => {
    const byId = new Map<string, Match>();
    completedMatches.forEach((m) => byId.set(m.id, m));
    horizonMatches.forEach((m) => {
      if (!byId.has(m.id)) byId.set(m.id, m);
    });
    return Array.from(byId.values());
  }, [completedMatches, horizonMatches]);

  const memberIds = useMemo(() => {
    if (memberProfiles.length > 0) {
      return memberProfiles.map((m) => m.id);
    }
    return activeLeagueMembers;
  }, [memberProfiles, activeLeagueMembers]);

  const nicknameById = useMemo(() => {
    const map: Record<string, string> = {};
    registeredUsers.forEach((u) => {
      map[u.id] = u.nickname;
    });
    memberProfiles.forEach((u) => {
      map[u.id] = u.nickname;
    });
    leaderboardList.forEach((u) => {
      if (u.nickname && !map[u.playerId]) map[u.playerId] = u.nickname;
    });
    return map;
  }, [registeredUsers, memberProfiles, leaderboardList]);

  const nationalityById = useMemo(() => {
    const map: Record<string, string> = {};
    registeredUsers.forEach((u) => {
      if (u.nationality) map[u.id] = u.nationality;
    });
    memberProfiles.forEach((u) => {
      if (u.nationality) map[u.id] = u.nationality;
    });
    leaderboardList.forEach((u) => {
      if (u.nationality && !map[u.playerId]) map[u.playerId] = u.nationality;
    });
    return map;
  }, [registeredUsers, memberProfiles, leaderboardList]);

  const firstNameById = useMemo(() => {
    const map: Record<string, string> = {};
    registeredUsers.forEach((u) => {
      if (u.firstName) map[u.id] = u.firstName;
    });
    memberProfiles.forEach((u) => {
      if (u.firstName) map[u.id] = u.firstName;
    });
    leaderboardList.forEach((u) => {
      if (u.firstName && !map[u.playerId]) map[u.playerId] = u.firstName;
    });
    return map;
  }, [registeredUsers, memberProfiles, leaderboardList]);

  const surnameById = useMemo(() => {
    const map: Record<string, string> = {};
    registeredUsers.forEach((u) => {
      if (u.surname) map[u.id] = u.surname;
    });
    memberProfiles.forEach((u) => {
      if (u.surname) map[u.id] = u.surname;
    });
    leaderboardList.forEach((u) => {
      if (u.surname && !map[u.playerId]) map[u.playerId] = u.surname;
    });
    return map;
  }, [registeredUsers, memberProfiles, leaderboardList]);

  /** Merge local locked picks so unlock updates immediately after submit. */
  const mergedPredictionRows = useMemo((): LeaguePredictionRow[] => {
    const rows: LeaguePredictionRow[] = predictionRows.map((r) => ({ ...r }));
    const seen = new Set(rows.map((r) => `${r.userId}:${r.matchId}`));

    Object.entries(userPredictions).forEach(([matchId, pred]) => {
      if (!pred.submitted) return;
      const key = `${user.id}:${matchId}`;
      if (seen.has(key)) return;
      const match = matchesForEngine.find((m) => m.id === matchId);
      if (!match) return;
      rows.push({
        userId: user.id,
        matchId,
        sport: match.sport,
        home: pred.home,
        away: pred.away,
        submitted: true,
        pointsWon: null,
      });
      seen.add(key);
    });

    return rows;
  }, [predictionRows, userPredictions, user.id, matchesForEngine]);

  const viewerPickCount = countSubmittedForSport(
    mergedPredictionRows,
    user.id,
    sportTab,
  );
  // Global board is always visible; private boards unlock after first pick.
  const unlocked = isGlobal || viewerPickCount > 0;

  const standings = useMemo((): LeagueStandingRow[] => {
    if (!unlocked) return [];

    if (isGlobal) {
      // Global members list: every league member (including 0 predictions),
      // alphabetical by nickname — not filtered/ranked by pick count.
      const isFootball = sportTab === SportType.FOOTBALL;
      const lbById = new Map(leaderboardList.map((r) => [r.playerId, r]));

      return [...memberIds]
        .map((playerId) => {
          const lb = lbById.get(playerId);
          const made = isFootball
            ? (lb?.predictionsFootball ?? 0)
            : (lb?.predictionsRugby ?? 0);
          const points = isFootball
            ? (lb?.pointsFootball ?? 0)
            : (lb?.pointsRugby ?? 0);
          const accuracy =
            made > 0
              ? isFootball
                ? (lb?.accuracyFootball ?? "0%")
                : (lb?.accuracyRugby ?? "0%")
              : "0%";
          return {
            playerId,
            nickname: nicknameById[playerId] || lb?.nickname || "Player",
            firstName: firstNameById[playerId] || lb?.firstName || "",
            surname: surnameById[playerId] || lb?.surname || "",
            nationality: nationalityById[playerId] || lb?.nationality,
            points,
            predictionsMade: made,
            accuracy,
            correctOutcomes: 0,
            perfectHits: 0,
          };
        })
        .sort((a, b) =>
          a.nickname.localeCompare(b.nickname, undefined, {
            sensitivity: "base",
          }),
        );
    }

    return buildLeagueSportStandings({
      memberIds,
      nicknameById,
      firstNameById,
      surnameById,
      nationalityById,
      predictions: mergedPredictionRows,
      matches: matchesForEngine,
      sport: sportTab,
      horizon,
    });
  }, [
    unlocked,
    isGlobal,
    leaderboardList,
    sportTab,
    memberIds,
    nicknameById,
    firstNameById,
    surnameById,
    nationalityById,
    mergedPredictionRows,
    matchesForEngine,
    horizon,
  ]);

  const { visible: visibleStandings, rankById, canShowMore, additionalCount } =
    useMemo(
      () =>
        selectVisibleRankedMembers(standings, user.id, {
          isGlobal,
          extraOthers,
        }),
      [standings, user.id, isGlobal, extraOthers],
    );

  const sportLabel = sportTab === SportType.FOOTBALL ? "Football" : "Rugby";
  const loading = isGlobal
    ? membersLoading || leaderboardLoading
    : predsLoading || matchesLoading;

  const horizonOptions: { id: StandingsHorizon; label: string }[] = [
    { id: "season", label: seasonHorizonLabel() },
    { id: "month", label: "This Month" },
    { id: "week", label: "This Week" },
  ];

  return (
    <div className="bg-slate-900/60 rounded-2xl border border-slate-800/70 p-5 flex flex-col gap-4 backdrop-blur-xs">
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-800/65">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-slate-400" />
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
            {isGlobal ? "Members" : "Standings"}
          </h3>
        </div>
      </div>

      {/* Dual-pillar sport tabs — no Overall/Combined */}
      <div
        role="tablist"
        aria-label="Sport standings"
        className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-950/70 border border-slate-800"
      >
        {(
          [
            { id: SportType.FOOTBALL, label: "Football" },
            { id: SportType.RUGBY, label: "Rugby" },
          ] as const
        ).map((tab) => {
          const active = sportTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setSportTab(tab.id);
                setExpandedStandingsUser(null);
              }}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                active
                  ? tab.id === SportType.FOOTBALL
                    ? "bg-blue-600 text-white shadow-md"
                    : "bg-amber-600 text-white shadow-md"
                  : "text-slate-500 hover:text-slate-300 hover:bg-slate-900"
              }`}
            >
              <SportIcon sport={tab.id} colored className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {unlocked && !isGlobal && (
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
                onClick={() => {
                  setHorizon(opt.id);
                  setExpandedStandingsUser(null);
                }}
                className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wide border transition-colors cursor-pointer ${
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
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-xs font-mono">Loading standings…</span>
        </div>
      ) : !unlocked ? (
        <div className="rounded-2xl border border-dashed border-slate-700/80 bg-slate-950/40 px-5 py-10 text-center space-y-3">
          <div className="mx-auto w-11 h-11 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center">
            <Target className="w-5 h-5 text-slate-500" />
          </div>
          <p className="text-sm font-display font-semibold text-slate-200 leading-relaxed max-w-[260px] mx-auto">
            You haven&apos;t entered the {sportLabel} arena yet. Lock in your
            first prediction to unlock this leaderboard and challenge your group!
          </p>
        </div>
      ) : standings.length === 0 ? (
        <div className="rounded-xl border border-slate-800/70 bg-slate-950/30 px-4 py-8 text-center">
          <p className="text-xs text-slate-500 font-mono leading-relaxed">
            {isGlobal
              ? "No members in the Global League yet."
              : `No settled ${sportLabel.toLowerCase()} results in this window yet. Check back after matchdays finish.`}
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {visibleStandings.map((member) => {
            const isMe = member.playerId === user.id;
            const userFlag = getCountryFlag(member.nationality);
            const rank = rankById.get(member.playerId) ?? 0;

            return (
              <div key={member.playerId} className="group flex flex-col gap-1">
                <div
                  onClick={() =>
                    setExpandedStandingsUser(
                      expandedStandingsUser === member.playerId
                        ? null
                        : member.playerId,
                    )
                  }
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer select-none ${
                    isMe
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                      : "bg-slate-950/45 border-slate-850/60 hover:bg-slate-950/70 hover:border-slate-800"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                    <span
                      className={`font-mono text-[10px] font-black min-w-5 h-5 flex items-center justify-center rounded-full shrink-0 ${
                        isGlobal
                          ? "text-slate-500"
                          : rank === 1
                            ? "bg-yellow-500/20 text-yellow-300"
                            : rank === 2
                              ? "bg-slate-400/20 text-slate-300"
                              : "text-slate-500"
                      }`}
                    >
                      #{rank}
                    </span>
                    <span
                      className="text-sm shrink-0 leading-none"
                      title={member.nationality || "United Kingdom"}
                      aria-hidden
                    >
                      {userFlag}
                    </span>
                    <div className="flex items-start gap-1.5 min-w-0 flex-1">
                      <LeaderboardPlayerLabel
                        nickname={member.nickname}
                        firstName={member.firstName}
                        surname={member.surname}
                        nicknameClassName={`text-xs ${isMe ? "text-emerald-300" : "text-slate-200"}`}
                        className="min-w-0 flex-1"
                      />
                      {isMe && (
                        <span className="text-[8px] font-mono bg-emerald-500/20 text-emerald-450 font-bold px-1.5 py-0.2 rounded shrink-0 self-start mt-0.5">
                          YOU
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0 pr-1">
                    <div className="text-right font-mono text-[11px] flex items-center gap-1.5">
                      <span
                        className={`font-bold text-xs ${isMe ? "text-emerald-450" : "text-white"}`}
                      >
                        {member.points} pts
                      </span>
                      <ChevronRight
                        className={`w-3 h-3 text-slate-500 transition-transform ${expandedStandingsUser === member.playerId ? "rotate-90" : ""}`}
                      />
                    </div>
                    <div className="flex gap-2 text-[9px] font-mono font-medium text-slate-500">
                      <span>{member.predictionsMade} Picks</span>
                      <span>{member.accuracy}</span>
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {expandedStandingsUser === member.playerId && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-slate-950/85 border border-slate-850/80 rounded-xl p-3 mx-1 text-[11px] font-mono text-slate-400 space-y-1.5 block overflow-hidden"
                    >
                      <div className="flex justify-between items-center text-slate-500 border-b border-slate-900/40 pb-1 mb-1">
                        <span>STATISTICS</span>
                        <span className="text-[9px] bg-slate-900 px-1 py-0.2 rounded text-slate-400">
                          {sportLabel.toUpperCase()} ·{" "}
                          {horizon === "season"
                            ? "SEASON"
                            : horizon === "month"
                              ? "MONTH"
                              : "WEEK"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Predictions:</span>
                        <strong className="text-slate-200 font-bold">
                          {member.predictionsMade}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Outcome Success:</span>
                        <strong className="text-emerald-400 font-bold">
                          {member.correctOutcomes}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Perfect Hits:</span>
                        <strong className="text-yellow-400 font-bold">
                          {member.perfectHits}
                        </strong>
                      </div>
                      <div className="flex justify-between border-t border-slate-900/40 pt-1.5 mt-1">
                        <span>Match Accuracy:</span>
                        <strong className="text-blue-400 font-bold">
                          {member.accuracy}
                        </strong>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}

          {!isGlobal && canShowMore && (
            <button
              type="button"
              onClick={() => setExtraOthers((n) => n + 10)}
              className="w-full mt-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-slate-800 bg-slate-950/50 hover:bg-slate-900 text-[11px] font-mono font-bold uppercase tracking-wider text-slate-300 cursor-pointer transition-colors"
            >
              <ChevronDown className="w-3.5 h-3.5" />
              Show More
            </button>
          )}

          {isGlobal && additionalCount > 0 && (
            <p className="pt-2 text-center text-[11px] font-mono text-slate-500 leading-relaxed">
              There are {additionalCount.toLocaleString()} additional players in
              this league.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
