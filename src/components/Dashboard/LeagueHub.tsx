import React, { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Trophy, Award, ChevronRight, Lock, Settings } from "lucide-react";
import { UserProfile, Match, League } from "../../types";
import { getCompetitions } from "../../competitions";
import { calculatePoints } from "../../utils";
import { getCountryFlag, MetallicTickWithLightning } from "./shared";
import type { LeaderboardRecord } from "../../supabase";
import InviteButton from "../League/InviteButton";
import LeagueSettingsModal, {
  type LeagueSettingsPayload,
} from "../League/LeagueSettingsModal";

type LeagueMemberDisplay = LeaderboardRecord & {
  displayPoints: number;
  displayPredictions: number;
  displayAccuracy: string;
};

interface LeagueHubProps {
  activeLeague: League;
  user: UserProfile;
  registeredUsers: UserProfile[];
  leagueMembersMemoized: LeagueMemberDisplay[];
  sortedActiveLeagueMatches: Match[];
  activeLeagueMatches: Match[];
  allMatches: Match[];
  activeLeagueMembers: string[];
  expandedStandingsUser: string | null;
  setExpandedStandingsUser: (id: string | null) => void;
  isJoiningActiveLeague: boolean;
  setIsJoiningActiveLeague: (v: boolean) => void;
  activeLeagueJoinPassword: string;
  setActiveLeagueJoinPassword: (v: string) => void;
  onBack: () => void;
  onRequestLeave: (leagueId: string) => void;
  onJoinLeague: (league: League, password: string) => Promise<void>;
  onUpdateLeagueSettings: (
    leagueId: string,
    settings: LeagueSettingsPayload,
  ) => Promise<void>;
  triggerToast: (msg: string) => void;
}

function LeagueDetailView({
  activeLeague,
  user,
  registeredUsers,
  leagueMembersMemoized,
  sortedActiveLeagueMatches,
  activeLeagueMatches,
  allMatches,
  activeLeagueMembers,
  expandedStandingsUser,
  setExpandedStandingsUser,
  isJoiningActiveLeague,
  setIsJoiningActiveLeague,
  activeLeagueJoinPassword,
  setActiveLeagueJoinPassword,
  onBack,
  onRequestLeave,
  onJoinLeague,
  onUpdateLeagueSettings,
  triggerToast,
}: LeagueHubProps) {
  const [showSettings, setShowSettings] = useState(false);
  const isAdmin = activeLeague.creatorId === user.id;
  const isMember = activeLeagueMembers.includes(user.id);
  const isPrivate = !!activeLeague.isPrivate || activeLeague.isPublic === false;

  /** Live predictor rows: strictly this league's members (never global bleed). */
  const scopedMembers = useMemo(() => {
    const memberSet = new Set(activeLeagueMembers);
    return leagueMembersMemoized.filter((m) => memberSet.has(m.playerId));
  }, [leagueMembersMemoized, activeLeagueMembers]);

  const compName =
    getCompetitions().find((c) => c.id === activeLeague.competitionId)?.name ||
    "Multi-Tournament";

  return (
    <motion.div
      key="league-detail-page"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* League Header Panel */}
      <div className="bg-slate-900/60 rounded-3xl border border-slate-800/70 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden backdrop-blur-xs">
        <div className="absolute top-0 right-0 w-36 h-36 bg-emerald-500/5 rounded-full blur-2xl" />
        <div className="absolute bottom-0 left-0 w-36 h-24 bg-blue-500/5 rounded-full blur-2xl" />

        <div className="space-y-1.5 relative z-10">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onBack}
              className="text-[11px] font-mono font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded cursor-pointer transition-colors flex items-center gap-1 uppercase"
            >
              ← Back to Dashboard
            </button>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold font-display text-white tracking-tight pt-1 inline-flex items-center gap-2.5 flex-wrap">
            {isPrivate && (
              <Lock
                className="w-5 h-5 sm:w-6 sm:h-6 text-slate-400 shrink-0"
                strokeWidth={1.75}
                aria-label="Private league"
              />
            )}
            <span>{activeLeague.name}</span>
          </h1>
          <p className="text-slate-400 text-xs font-sans">
            Tournament:{" "}
            <span className="text-white font-mono font-semibold">{compName}</span>{" "}
            • Created by{" "}
            <span className="text-slate-300 font-semibold">
              {activeLeague.creatorName || "Admin"}
            </span>
          </p>
        </div>

        {/* Registered users at the far right of header */}
        <div className="text-right shrink-0 relative z-10 flex flex-col items-stretch sm:items-end gap-2 w-full sm:w-auto">
          <span className="text-xs bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20 px-3.5 py-2.5 rounded-xl block font-mono text-center sm:text-right">
            👥 {scopedMembers.length} Registered Players
          </span>
        </div>
      </div>

      {/* Grid split of details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* STANDINGS TABLE COLUMN (1/3) */}
        <div className="bg-slate-900/60 rounded-2xl border border-slate-800/70 p-5 flex flex-col gap-4 backdrop-blur-xs">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-800/65">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-slate-400" />
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                Standings
              </h3>
            </div>
          </div>

          <div className="space-y-1.5">
            {scopedMembers.map((member, idx) => {
              const isMe = member.playerId === user.id;
              const matchUser = registeredUsers.find(
                (r) => r.id === member.playerId,
              );
              const userFlag = getCountryFlag(matchUser?.nationality);

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
                    <div className="flex items-center gap-2 truncate">
                      <span
                        className={`font-mono text-[10px] font-black min-w-5 h-5 flex items-center justify-center rounded-full ${
                          idx === 0
                            ? "bg-yellow-500/20 text-yellow-300"
                            : idx === 1
                              ? "bg-slate-400/20 text-slate-300"
                              : "text-slate-500"
                        }`}
                      >
                        #{idx + 1}
                      </span>
                      <span
                        className={`font-semibold text-xs truncate max-w-[110px] ${isMe ? "text-emerald-300" : "text-slate-200"}`}
                      >
                        {member.nickname}
                      </span>
                      <span
                        className="text-sm shrink-0"
                        title={matchUser?.nationality || "United Kingdom"}
                      >
                        {userFlag}
                      </span>
                      {isMe && (
                        <span className="text-[8px] font-mono bg-emerald-500/20 text-emerald-450 font-bold px-1.5 py-0.2 rounded shrink-0">
                          YOU
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0 pr-1">
                      <div className="text-right font-mono text-[11px] flex items-center gap-1.5">
                        <span
                          className={`font-bold text-xs ${isMe ? "text-emerald-450" : "text-white"}`}
                        >
                          {member.displayPoints} pts
                        </span>
                        <ChevronRight
                          className={`w-3 h-3 text-slate-500 transition-transform ${expandedStandingsUser === member.playerId ? "rotate-90" : ""}`}
                        />
                      </div>
                      <div className="flex gap-2 text-[9px] font-mono font-medium text-slate-500">
                        <span>{member.displayPredictions} Picks</span>
                        <span>{member.displayAccuracy}</span>
                      </div>
                    </div>
                  </div>

                  {/* Mini interactive dropdown */}
                  {expandedStandingsUser === member.playerId &&
                    (() => {
                      let correctPredictions = 0;
                      let perfectCount = 0;
                      const upreds = member.predictions || {};
                      Object.keys(upreds).forEach((matchId) => {
                        const pObj = upreds[matchId];
                        if (pObj && pObj.submitted) {
                          const matchedMatch = allMatches.find(
                            (m) => m.id === matchId,
                          );
                          if (
                            matchedMatch &&
                            matchedMatch.status === "completed" &&
                            matchedMatch.homeScore !== undefined &&
                            matchedMatch.awayScore !== undefined
                          ) {
                            const pts = calculatePoints(
                              matchedMatch.sport,
                              pObj.home,
                              pObj.away,
                              matchedMatch.homeScore,
                              matchedMatch.awayScore,
                            );
                            if (pts > 0) correctPredictions++;
                            if (pts === 5) perfectCount++;
                          }
                        }
                      });
                      return (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="bg-slate-950/85 border border-slate-850/80 rounded-xl p-3 mx-1 text-[11px] font-mono text-slate-400 space-y-1.5 block"
                        >
                          <div className="flex justify-between items-center text-slate-500 border-b border-slate-900/40 pb-1 mb-1">
                            <span>STATISTICS</span>
                            <span className="text-[9px] bg-slate-900 px-1 py-0.2 rounded text-slate-400">
                              PITCHSIDE ENGINE
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Total Predictions:</span>
                            <strong className="text-slate-250 font-bold text-slate-200">
                              {member.predictionsMade}
                            </strong>
                          </div>
                          <div className="flex justify-between">
                            <span>Outcome Success:</span>
                            <strong className="text-emerald-400 font-bold">
                              {correctPredictions}
                            </strong>
                          </div>
                          <div className="flex justify-between">
                            <span>Perfect Hits:</span>
                            <strong className="text-yellow-400 font-bold">
                              {perfectCount}
                            </strong>
                          </div>
                          <div className="flex justify-between border-t border-slate-900/40 pt-1.5 mt-1">
                            <span>Match Accuracy:</span>
                            <strong className="text-blue-400 font-bold">
                              {member.accuracy}
                            </strong>
                          </div>
                        </motion.div>
                      );
                    })()}
                </div>
              );
            })}
          </div>

          <div className="mt-2 pt-4 border-t border-slate-800/65 space-y-3">
            <div className="flex justify-between items-center gap-3">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                League code
              </span>
              <span className="text-xs font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20 select-all cursor-text">
                {activeLeague.id}
              </span>
            </div>

            {isMember && (
              <InviteButton
                league={activeLeague}
                onToast={triggerToast}
                className="w-full [&_button]:w-full"
              />
            )}

            <hr className="border-slate-800" />

            {isAdmin && (
              <button
                type="button"
                onClick={() => setShowSettings(true)}
                className="w-full inline-flex items-center justify-center gap-2 text-xs font-mono font-bold uppercase tracking-wider bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-slate-200 py-2.5 rounded-xl cursor-pointer transition-colors"
              >
                <Settings className="w-3.5 h-3.5" />
                League Settings
              </button>
            )}

            {isMember ? (
              <button
                type="button"
                onClick={() => onRequestLeave(activeLeague.id)}
                className="w-full text-xs font-mono font-bold bg-red-950/15 hover:bg-red-950/40 border border-red-500/20 hover:border-red-500/40 text-red-400 py-2.5 rounded-xl cursor-pointer transition-colors text-center block"
              >
                {isAdmin ? "Delete League" : "Leave League"}
              </button>
            ) : isJoiningActiveLeague ? (
              <div className="space-y-2 w-full border border-blue-500/30 rounded-xl p-3 bg-blue-950/10">
                <input
                  type="password"
                  placeholder="Enter League Password"
                  value={activeLeagueJoinPassword}
                  onChange={(e) => setActiveLeagueJoinPassword(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsJoiningActiveLeague(false)}
                    className="flex-1 text-xs font-mono font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-lg cursor-pointer transition-colors text-center"
                  >
                    CANCEL
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (activeLeagueJoinPassword === activeLeague.password) {
                        try {
                          await onJoinLeague(activeLeague, activeLeagueJoinPassword);
                          setIsJoiningActiveLeague(false);
                          setActiveLeagueJoinPassword("");
                        } catch {
                          triggerToast("⚠️ Failed to join league.");
                        }
                      } else {
                        triggerToast("⚠️ Incorrect password.");
                      }
                    }}
                    className="flex-1 text-xs font-mono font-bold bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg cursor-pointer transition-colors text-center"
                  >
                    CONFIRM
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsJoiningActiveLeague(true);
                  setActiveLeagueJoinPassword("");
                }}
                className="w-full text-xs font-mono font-bold bg-blue-500/15 hover:bg-blue-500/30 border border-blue-500/30 text-blue-400 py-2.5 rounded-xl cursor-pointer transition-colors text-center block"
              >
                JOIN LEAGUE
              </button>
            )}
          </div>
        </div>

        {/* MATCH DAYS & MEMBERS PICKS COMPARISON MATRIX */}
        <div className="lg:col-span-2 bg-slate-900/60 rounded-2xl border border-slate-800/70 p-5 flex flex-col gap-4 backdrop-blur-xs">
          <div className="flex items-center gap-2 pb-2.5 border-b border-slate-800/65">
            <Award className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
              Live Tournament Predictor Comparison
            </h3>
          </div>

          <p className="text-xs text-slate-400">
            Behold the picks comparison index. Track real-time locks and perfect
            scores across every participant:
          </p>

          {activeLeagueMatches.length === 0 ? (
            <div className="text-center py-10 text-slate-500 font-sans text-xs">
              No matches registered for {compName} right now. Select leagues with
              scheduled match days.
            </div>
          ) : (
            <div className="space-y-4">
              {sortedActiveLeagueMatches.map((match, index) => {
                const matchDate = new Date(match.matchDate);
                const dateKey = matchDate.toLocaleDateString(undefined, {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                });
                const timeKey = matchDate.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                });

                const prevMatch =
                  index > 0 ? sortedActiveLeagueMatches[index - 1] : null;
                const prevDateKey = prevMatch
                  ? new Date(prevMatch.matchDate).toLocaleDateString(undefined, {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })
                  : null;
                const showDateSeparator = dateKey !== prevDateKey;

                return (
                  <React.Fragment key={match.id}>
                    {showDateSeparator && (
                      <div className="text-center pt-4 pb-2">
                        <span className="inline-block text-slate-300 text-xs font-semibold px-4 py-1.5 uppercase tracking-widest font-mono">
                          {dateKey}
                        </span>
                      </div>
                    )}
                    <div className="bg-slate-950/40 hover:bg-slate-950/60 border border-slate-850 hover:border-slate-800 p-4 rounded-2xl transition-all">
                      {/* Top Row: Date & Time */}
                      <div className="flex flex-col items-center justify-center text-center mb-4">
                        <span className="inline-block bg-slate-900 border border-slate-700 text-slate-400 text-[10px] font-mono px-3 py-0.5 rounded-full">
                          {timeKey}
                        </span>
                      </div>

                      {/* Home vs Away & Real Full-time Result Display */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/50 p-3 rounded-xl border border-slate-800/40">
                        <div className="flex-1 text-center sm:text-left">
                          <span className="font-extrabold font-display text-sm text-white block">
                            {match.homeTeam}{" "}
                            <span className="text-[10px] text-slate-500 font-mono font-normal">
                              vs
                            </span>{" "}
                            {match.awayTeam}
                          </span>
                          <span className="text-[9px] text-slate-500 uppercase tracking-widest font-mono">
                            {compName} Match Day
                          </span>
                        </div>

                        <div className="text-center sm:text-right flex-shrink-0">
                          {match.status === "completed" ? (
                            <div className="space-y-0.5">
                              <span className="text-[9px] text-slate-500 uppercase tracking-wider font-mono block">
                                FINAL SCORE
                              </span>
                              <span className="font-extrabold text-sm text-yellow-500 font-serif">
                                {match.homeScore} - {match.awayScore}
                              </span>
                            </div>
                          ) : (
                            <div className="space-y-0.5">
                              <span className="text-[9px] text-slate-500 uppercase tracking-wider font-mono block">
                                MATCH STATUS
                              </span>
                              <span className="text-[10px] bg-slate-800 text-slate-400 border border-slate-700 font-semibold px-2 py-0.5 rounded">
                                Upcoming / Live
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Participant Locks Comparer Sub-Grid */}
                      <div className="mt-3.5 space-y-1.5">
                        <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500 block">
                          Participant Saved Picks:
                        </span>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                          {scopedMembers.map((member) => {
                            const memberPred = member.predictions?.[match.id];
                            const hasPred = memberPred && memberPred.submitted;
                            const isMe = member.playerId === user.id;

                            const actualHome =
                              match.status === "completed"
                                ? match.homeScore
                                : undefined;
                            const actualAway =
                              match.status === "completed"
                                ? match.awayScore
                                : undefined;
                            const actualTime = new Date(
                              match.matchDate,
                            ).getTime();
                            const isKickedOff =
                              match.status === "completed" ||
                              match.status === "live" ||
                              actualTime < Date.now();
                            const hasPlayed =
                              actualHome !== undefined &&
                              actualAway !== undefined;

                            return (
                              <div
                                key={member.playerId}
                                className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                                  isMe
                                    ? "bg-emerald-500/5 border-emerald-500/30"
                                    : "bg-slate-950/40 border-slate-855"
                                }`}
                              >
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-slate-300">
                                    {member.nickname}
                                  </span>
                                  {isMe && (
                                    <span className="text-[8px] font-mono bg-emerald-500/20 text-emerald-455 font-bold px-1 rounded-3xs">
                                      YOU
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 font-mono">
                                  {hasPred ? (
                                    isMe || isKickedOff ? (
                                      <span className="font-extrabold text-white bg-slate-950/70 border border-slate-800 px-2 py-0.5 rounded">
                                        {memberPred.home} - {memberPred.away}
                                      </span>
                                    ) : (
                                      <div className="flex items-center gap-1.5 shrink-0 select-none">
                                        <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1 bg-slate-900/60 px-1.5 py-0.5 rounded border border-slate-800/40">
                                          🔒 Locked
                                        </span>
                                        <MetallicTickWithLightning />
                                      </div>
                                    )
                                  ) : (
                                    <span className="text-[10px] text-slate-600 font-sans">
                                      No saved pick
                                    </span>
                                  )}

                                  {hasPlayed &&
                                    hasPred &&
                                    (isMe || isKickedOff) && (
                                      <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                        +
                                        {calculatePoints(
                                          match.sport,
                                          memberPred.home,
                                          memberPred.away,
                                          actualHome,
                                          actualAway,
                                        )}{" "}
                                        pts
                                      </span>
                                    )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showSettings && isAdmin && (
        <LeagueSettingsModal
          league={activeLeague}
          memberCount={scopedMembers.length}
          onClose={() => setShowSettings(false)}
          onSave={(payload) => onUpdateLeagueSettings(activeLeague.id, payload)}
        />
      )}
    </motion.div>
  );
}

export default LeagueDetailView;
