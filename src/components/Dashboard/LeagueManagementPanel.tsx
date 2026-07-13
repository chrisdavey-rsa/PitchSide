import React from "react";
import { motion } from "motion/react";
import { Award } from "lucide-react";
import { getCompetitions } from "../../competitions";
import { SportType, UserProfile, League } from "../../types";
import type { LeaderboardRecord } from "../../supabase";

type LeagueMemberDisplay = LeaderboardRecord & {
  displayPoints: number;
  displayPredictions: number;
  displayAccuracy: string;
};

interface LeagueManagementPanelProps {
  user: UserProfile;
  leagues: League[];
  userLeagues: League[];
  isUserInAnyLeague: boolean;
  leagueTab: "joined" | "create" | "join" | "view";
  setLeagueTab: (tab: "joined" | "create" | "join" | "view") => void;
  activeLeagueId: string | null;
  setActiveLeagueId: (id: string | null) => void;
  leagueMembersMemoized: LeagueMemberDisplay[];
  editingLeagueId: string | null;
  setEditingLeagueId: (id: string | null) => void;
  editIsPublic: boolean;
  setEditIsPublic: (v: boolean) => void;
  editLimitParticipants: boolean;
  setEditLimitParticipants: (v: boolean) => void;
  editMaxParticipantsInput: string;
  setEditMaxParticipantsInput: (v: string) => void;
  viewLeaguesSearchName: string;
  setViewLeaguesSearchName: (v: string) => void;
  viewLeaguesSport: SportType | "ALL";
  setViewLeaguesSport: (v: SportType | "ALL") => void;
  viewLeaguesCompId: string;
  setViewLeaguesCompId: (v: string) => void;
  viewLeaguesSeason: string;
  setViewLeaguesSeason: (v: string) => void;
  leagueNameInput: string;
  setLeagueNameInput: (v: string) => void;
  leaguePasswordInput: string;
  setLeaguePasswordInput: (v: string) => void;
  leagueSeasonInput: string;
  setLeagueSeasonInput: (v: string) => void;
  leagueCompSelect: string;
  setLeagueCompSelect: (v: string) => void;
  leagueIsPublicInput: boolean;
  setLeagueIsPublicInput: (v: boolean) => void;
  limitParticipants: boolean;
  setLimitParticipants: (v: boolean) => void;
  maxParticipantsInput: string;
  setMaxParticipantsInput: (v: string) => void;
  joinCodeInput: string;
  setJoinCodeInput: (v: string) => void;
  joinPasswordInput: string;
  setJoinPasswordInput: (v: string) => void;
  handleCreateLeague: () => void | Promise<void>;
  handleJoinLeague: () => void | Promise<void>;
  handleLeaveLeague: (leagueId: string) => void | Promise<void>;
  handleUpdateLeagueSettings: () => void | Promise<void>;
  triggerToast: (msg: string) => void;
}

export default function LeagueManagementPanel({
  user,
  leagues,
  userLeagues,
  isUserInAnyLeague,
  leagueTab,
  setLeagueTab,
  activeLeagueId,
  setActiveLeagueId,
  leagueMembersMemoized,
  editingLeagueId,
  setEditingLeagueId,
  editIsPublic,
  setEditIsPublic,
  editLimitParticipants,
  setEditLimitParticipants,
  editMaxParticipantsInput,
  setEditMaxParticipantsInput,
  viewLeaguesSearchName,
  setViewLeaguesSearchName,
  viewLeaguesSport,
  setViewLeaguesSport,
  viewLeaguesCompId,
  setViewLeaguesCompId,
  viewLeaguesSeason,
  setViewLeaguesSeason,
  leagueNameInput,
  setLeagueNameInput,
  leaguePasswordInput,
  setLeaguePasswordInput,
  leagueSeasonInput,
  setLeagueSeasonInput,
  leagueCompSelect,
  setLeagueCompSelect,
  leagueIsPublicInput,
  setLeagueIsPublicInput,
  limitParticipants,
  setLimitParticipants,
  maxParticipantsInput,
  setMaxParticipantsInput,
  joinCodeInput,
  setJoinCodeInput,
  joinPasswordInput,
  setJoinPasswordInput,
  handleCreateLeague,
  handleJoinLeague,
  handleLeaveLeague,
  handleUpdateLeagueSettings,
  triggerToast,
}: LeagueManagementPanelProps) {
  return (
    <motion.div
      id="tour-league-manager"
      transition={{ duration: 0.5, ease: "easeInOut" }}
      className={`bg-slate-900/60 rounded-2xl border border-slate-800/70 p-5 flex flex-col justify-between relative overflow-hidden backdrop-blur-xs min-h-[180px] transition-all ${!isUserInAnyLeague ? "ring-2 ring-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.2)]" : ""}`}
    >
      <div>
        {/* Header with quick sub-tabs */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
          <div className="flex items-center gap-1.5">
            <Award className="w-4 h-4 text-yellow-500" />
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
              Leagues
            </h3>
          </div>
          {isUserInAnyLeague && (
            <div className="flex gap-1 text-[10px] font-mono bg-slate-950/80 p-0.5 rounded border border-slate-800/60">
              <button
                onClick={() => {
                  setLeagueTab("joined");
                  setActiveLeagueId(null);
                }}
                className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${leagueTab === "joined" ? "bg-slate-800 text-white font-bold" : "text-slate-500 hover:text-slate-300"}`}
              >
                List
              </button>
              <button
                onClick={() => setLeagueTab("view")}
                className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${leagueTab === "view" ? "bg-slate-800 text-white font-bold" : "text-slate-500 hover:text-slate-300"}`}
              >
                View
              </button>
              <button
                onClick={() => setLeagueTab("join")}
                className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${leagueTab === "join" ? "bg-slate-800 text-white font-bold" : "text-slate-500 hover:text-slate-300"}`}
              >
                Join
              </button>
              <button
                onClick={() => setLeagueTab("create")}
                className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${leagueTab === "create" ? "bg-slate-800 text-white font-bold" : "text-slate-500 hover:text-slate-300"}`}
              >
                Create
              </button>
            </div>
          )}
        </div>

        {/* TAB CONTENT: 1. JOINED / DETAILED LEAGUE */}
        {leagueTab === "joined" && (
          <div className="mt-3">
            {activeLeagueId ? (
              /* DETAILED LEAGUE VIEW */
              (() => {
                const activeLeague = leagues.find(
                  (l) => l.id === activeLeagueId,
                );
                if (!activeLeague) return null;
                const compName =
                  getCompetitions().find(
                    (c) => c.id === activeLeague.competitionId,
                  )?.name || "Multi-Tournament";

                const isLeagueFootball = activeLeague.competitionId?.startsWith("f-");

                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between bg-slate-950/40 p-2 rounded-lg border border-slate-800/50">
                      <div>
                        <h4 className="text-xs font-bold text-white truncate max-w-[120px]">
                          {activeLeague.name}
                        </h4>
                        <p className="text-[9px] text-slate-500 truncate max-w-[120px] font-mono font-medium">
                          {compName}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400 font-mono">
                          Code:{" "}
                          <span className="text-yellow-450 font-bold">
                            {activeLeague.id}
                          </span>
                        </p>
                        <p className="text-[9px] text-slate-500">
                          Creator: {activeLeague.creatorName}
                        </p>
                      </div>
                    </div>

                    {/* Standings Micro Grid Scroll list */}
                    <div className="max-h-[110px] overflow-y-auto space-y-1">
                      {leagueMembersMemoized.map((member, i) => {
                        const isMe = member.playerId === user.id;
                        return (
                          <div
                            key={member.playerId}
                            className={`flex items-center justify-between px-2 py-1 text-xs rounded-sm ${isMe ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20" : "bg-slate-950/25 border border-slate-900/40"}`}
                          >
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`font-bold font-mono text-[10px] w-4 ${i === 0 ? "text-yellow-400" : i === 1 ? "text-slate-400" : "text-slate-600"}`}
                              >
                                {i + 1}
                              </span>
                              <span className="font-semibold truncate max-w-[110px]">
                                {member.nickname}
                              </span>
                            </div>
                            <span className="font-bold font-mono text-white">
                              {member.displayPoints} pts
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Actions controls inside selected league details */}
                    <div className="flex items-center justify-between pt-1 font-mono text-[9px] text-slate-500">
                      <button
                        onClick={() => setActiveLeagueId(null)}
                        className="bg-slate-800 text-slate-300 hover:text-white px-2 py-1 rounded cursor-pointer transition-colors"
                      >
                        ← Back List
                      </button>

                      <div className="flex items-center gap-2">
                        {activeLeague.creatorId === user.id && (
                          <button
                            onClick={() => {
                              if (editingLeagueId === activeLeague.id) {
                                setEditingLeagueId(null);
                              } else {
                                setEditingLeagueId(activeLeague.id);
                                setEditIsPublic(activeLeague.isPublic ?? false);
                                setEditLimitParticipants(!!activeLeague.maxParticipants);
                                setEditMaxParticipantsInput(activeLeague.maxParticipants ? String(activeLeague.maxParticipants) : "10");
                              }
                            }}
                            className="text-blue-400 hover:text-blue-300 px-2 py-1 rounded border border-blue-500/10 hover:border-blue-500/30 cursor-pointer transition-colors"
                          >
                            Manage Settings
                          </button>
                        )}
                        <button
                          onClick={() =>
                            handleLeaveLeague(activeLeague.id)
                          }
                          className="text-red-400 hover:text-red-300 px-2 py-1 rounded border border-red-500/10 hover:border-red-500/30 cursor-pointer transition-colors"
                        >
                          {activeLeague.creatorId === user.id
                            ? "Delete/Disband"
                            : "Leave League"}
                        </button>
                      </div>
                    </div>

                    {/* Manage Settings Panel */}
                    {editingLeagueId === activeLeague.id && (
                      <div className="mt-2 p-2 bg-slate-950/80 rounded border border-blue-500/30 space-y-3">
                        <h4 className="text-[10px] font-bold text-blue-400 uppercase">League Settings</h4>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id="editLeagueVisibility"
                              checked={editIsPublic}
                              onChange={(e) => setEditIsPublic(e.target.checked)}
                              className="w-3.5 h-3.5 rounded bg-slate-900 border-slate-700 text-blue-500 focus:ring-blue-500/50"
                            />
                            <label
                              htmlFor="editLeagueVisibility"
                              className="text-[10px] text-slate-400 font-sans cursor-pointer select-none"
                            >
                              Visible to global players (shown on leaderboards)
                            </label>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                id="editLimitParticipants"
                                checked={editLimitParticipants}
                                onChange={(e) => setEditLimitParticipants(e.target.checked)}
                                className="w-3.5 h-3.5 rounded bg-slate-900 border-slate-700 text-blue-500 focus:ring-blue-500/50"
                              />
                              <label
                                htmlFor="editLimitParticipants"
                                className="text-[10px] text-slate-400 font-sans cursor-pointer select-none"
                              >
                                Limit number of participants
                              </label>
                            </div>
                            {editLimitParticipants && (
                              <div>
                                <select
                                  value={editMaxParticipantsInput}
                                  onChange={(e) => setEditMaxParticipantsInput(e.target.value)}
                                  className="w-full text-xs bg-slate-950 border border-slate-800 p-2 rounded text-white focus:outline-hidden font-sans"
                                >
                                  {Array.from({ length: 20 }, (_, i) => i + 1).map(num => (
                                    <option key={num} value={num}>{num}</option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={handleUpdateLeagueSettings}
                          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-1.5 rounded text-[10px] transition-all"
                        >
                          Save Settings
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()
            ) : (
              /* GENERAL LEAGUES DIRECTORY LIST */
              <div className="space-y-2 mt-3">
                {!isUserInAnyLeague ? (
                  <div className="text-center py-6 flex flex-col items-center">
                    <p className="text-sm font-bold text-white mb-1">
                      Get Started Here!
                    </p>
                    <p className="text-xs text-slate-400 font-sans max-w-[200px] mb-4">
                      You need to be in a league to start predicting
                      matches.
                    </p>
                    <div className="flex gap-2 w-full max-w-[320px] justify-center flex-wrap">
                      <button
                        onClick={() => setLeagueTab("view")}
                        className="flex-1 min-w-[80px] text-[10px] font-mono font-bold bg-purple-500 hover:bg-purple-600 px-3 py-2 rounded-lg text-white cursor-pointer transition-colors shadow-lg shadow-purple-500/20"
                      >
                        View Leagues
                      </button>
                      <button
                        onClick={() => setLeagueTab("join")}
                        className="flex-1 min-w-[80px] text-[10px] font-mono font-bold bg-blue-500 hover:bg-blue-600 px-3 py-2 rounded-lg text-white cursor-pointer transition-colors shadow-lg shadow-blue-500/20"
                      >
                        Join League
                      </button>
                      <button
                        onClick={() => setLeagueTab("create")}
                        className="flex-1 min-w-[80px] text-[10px] font-mono font-bold bg-emerald-500 hover:bg-emerald-600 px-3 py-2 rounded-lg text-white cursor-pointer transition-colors shadow-lg shadow-emerald-500/20"
                      >
                        Create League
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-[160px] overflow-y-auto">
                    {userLeagues.map((league) => {
                        const comp = getCompetitions().find(
                          (c) => c.id === league.competitionId,
                        );
                        return (
                          <div
                            key={league.id}
                            onClick={() => setActiveLeagueId(league.id)}
                            className="flex items-center justify-between p-2.5 bg-slate-950/40 hover:bg-slate-950 border border-slate-850 hover:border-slate-800 rounded-xl cursor-pointer transition-all duration-200"
                          >
                            <div className="space-y-0.5 truncate pr-2">
                              <h4 className="text-xs font-bold text-white truncate">
                                {league.name}
                              </h4>
                              <p className="text-[9px] text-slate-500 font-mono font-medium truncate">
                                {comp?.name || "Tournament"}
                              </p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-[10px] text-emerald-400 font-mono font-bold">
                                Active
                              </p>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB CONTENT: VIEW ALL LEAGUES */}
        {leagueTab === "view" && (
          <div className="space-y-3 mt-3">
            <p className="text-[10px] text-slate-400">
              Explore all registered leagues.
            </p>

            {/* Filters */}
            <div className="grid grid-cols-2 gap-2 bg-slate-950/40 p-2 rounded-lg border border-slate-800">
              <div className="col-span-2">
                <input
                  type="text"
                  placeholder="Filter by League Name"
                  value={viewLeaguesSearchName}
                  onChange={(e) => setViewLeaguesSearchName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <select
                value={viewLeaguesSport}
                onChange={(e) => {
                  setViewLeaguesSport(e.target.value as SportType | "ALL");
                  setViewLeaguesCompId("ALL");
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
              >
                <option value="ALL">All Sports</option>
                <option value={SportType.FOOTBALL}>Football</option>
                <option value={SportType.RUGBY}>Rugby</option>
              </select>

              <select
                value={viewLeaguesCompId}
                onChange={(e) => setViewLeaguesCompId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
              >
                <option value="ALL">All Tournaments</option>
                {getCompetitions()
                  .filter(c => viewLeaguesSport === "ALL" || c.sport === viewLeaguesSport)
                  .map((comp) => (
                  <option key={comp.id} value={comp.id}>{comp.name}</option>
                ))}
              </select>
              <select
                value={viewLeaguesSeason}
                onChange={(e) => setViewLeaguesSeason(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-slate-300 focus:outline-none focus:border-blue-500 col-span-2"
              >
                <option value="ALL">All Seasons</option>
                <option value="2026">2026</option>
                <option value="2025">2025</option>
                <option value="2024">2024</option>
              </select>
            </div>

            {/* League List */}
            <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
              {leagues
                .filter(l => {
                  if (viewLeaguesSearchName && !l.name.toLowerCase().includes(viewLeaguesSearchName.toLowerCase())) return false;

                  const comp = getCompetitions().find(c => c.id === l.competitionId);
                  if (viewLeaguesSport !== "ALL" && comp?.sport !== viewLeaguesSport) return false;

                  if (viewLeaguesCompId !== "ALL" && l.competitionId !== viewLeaguesCompId) return false;

                  const lSeason = comp?.season || l.season || l.createdAt.substring(0, 4);
                  if (viewLeaguesSeason !== "ALL" && lSeason !== viewLeaguesSeason) return false;

                  return true;
                })
                .sort((a, b) => a.id.localeCompare(b.id))
                .map((league) => {
                  const comp = getCompetitions().find((c) => c.id === league.competitionId);
                  return (
                    <div
                      key={league.id}
                      onClick={() => setActiveLeagueId(league.id)}
                      className="flex items-center justify-between p-2.5 bg-slate-950/40 border border-slate-850 rounded-xl cursor-pointer hover:bg-slate-900 transition-colors group"
                    >
                      <div className="space-y-0.5 truncate pr-2">
                        <h4 className="text-xs font-bold text-white truncate">
                          {league.name}
                        </h4>
                        <p className="text-[9px] text-slate-500 font-mono font-medium truncate">
                          {comp?.name || "Global"}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-[10px] text-slate-400 font-mono">
                          {league.isPublic ? "Public" : "Private"}
                        </p>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* TAB CONTENT: 2. JOIN ANOTHER CONTEST LEAGUE */}
        {leagueTab === "join" && (
          <div className="space-y-3 mt-3">
            <p className="text-[10px] text-slate-400">
              Enter league Code/ID and secret password key to enter:
            </p>

            <div className="space-y-2 font-mono">
              <div>
                <span className="text-[9px] text-slate-500 block uppercase mb-1">
                  League ID or Code
                </span>
                <input
                  type="text"
                  placeholder="e.g. LG3000"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value)}
                  className="w-full text-xs bg-slate-950 border border-slate-800 hover:border-slate-700 p-2 rounded text-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-mono"
                />
              </div>
              <div>
                <span className="text-[9px] text-slate-500 block uppercase mb-1">
                  Secret Password
                </span>
                <input
                  type="password"
                  placeholder="Enter password..."
                  value={joinPasswordInput}
                  onChange={(e) => setJoinPasswordInput(e.target.value)}
                  className="w-full text-xs bg-slate-950 border border-slate-800 p-2 rounded text-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-mono"
                />
              </div>
            </div>

            <div className="flex gap-2 font-mono text-[10px]">
              <button
                onClick={() => setLeagueTab("joined")}
                className="flex-1 bg-slate-800 hover:bg-slate-755 text-slate-300 py-1.5 rounded cursor-pointer transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleJoinLeague}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-1.5 rounded cursor-pointer transition-all"
              >
                Enter League
              </button>
            </div>
          </div>
        )}

        {/* TAB CONTENT: 3. CREATE BRAND NEW PRIVATE TOURNAMENT */}
        {leagueTab === "create" && (
          <div className="space-y-3 mt-3">
            <p className="text-[10px] text-slate-400">
              Build your league.
            </p>

            <div className="space-y-2">
              <div>
                <span className="text-[9px] text-slate-500 font-mono block uppercase mb-1">
                  League Title
                </span>
                <input
                  type="text"
                  placeholder="e.g. London Office Rivals"
                  value={leagueNameInput}
                  onChange={(e) => setLeagueNameInput(e.target.value)}
                  className="w-full text-xs bg-slate-950 border border-slate-800 hover:border-slate-700 p-2 rounded text-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <span className="text-[9px] text-slate-500 font-mono block uppercase mb-1">
                  Associated Sports Competition
                </span>
                <div className="flex gap-2">
                  <select
                    value={leagueCompSelect}
                    onChange={(e) => setLeagueCompSelect(e.target.value)}
                    className="w-2/3 text-xs bg-slate-950 border border-slate-800 p-2 rounded text-white focus:outline-hidden font-sans"
                  >
                    {getCompetitions().map((comp) => (
                      <option key={comp.id} value={comp.id}>
                        {comp.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={leagueSeasonInput}
                    onChange={(e) => setLeagueSeasonInput(e.target.value)}
                    className="w-1/3 text-xs bg-slate-950 border border-slate-800 p-2 rounded text-white focus:outline-hidden font-sans"
                  >
                    <option value="2026">2026</option>
                    <option value="2025">2025</option>
                    <option value="2024">2024</option>
                  </select>
                </div>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 font-mono block uppercase mb-1">
                  Enter League Password
                </span>
                <input
                  type="password"
                  placeholder="Enter a secret password..."
                  value={leaguePasswordInput}
                  onChange={(e) =>
                    setLeaguePasswordInput(e.target.value)
                  }
                  className="w-full text-xs bg-slate-950 border border-slate-800 p-2 rounded text-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="leagueVisibility"
                  checked={leagueIsPublicInput}
                  onChange={(e) =>
                    setLeagueIsPublicInput(e.target.checked)
                  }
                  className="w-3.5 h-3.5 rounded bg-slate-900 border-slate-700 text-blue-500 focus:ring-blue-500/50"
                />
                <label
                  htmlFor="leagueVisibility"
                  className="text-[10px] text-slate-400 font-sans cursor-pointer select-none"
                >
                  Visible to global players (shown on leaderboards)
                </label>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="limitParticipants"
                    checked={limitParticipants}
                    onChange={(e) => setLimitParticipants(e.target.checked)}
                    className="w-3.5 h-3.5 rounded bg-slate-900 border-slate-700 text-blue-500 focus:ring-blue-500/50"
                  />
                  <label
                    htmlFor="limitParticipants"
                    className="text-[10px] text-slate-400 font-sans cursor-pointer select-none"
                  >
                    Limit number of participants
                  </label>
                </div>
                {limitParticipants && (
                  <div>
                    <select
                      value={maxParticipantsInput}
                      onChange={(e) => setMaxParticipantsInput(e.target.value)}
                      className="w-full text-xs bg-slate-950 border border-slate-800 p-2 rounded text-white focus:outline-hidden font-sans"
                    >
                      {Array.from({ length: 20 }, (_, i) => i + 1).map(num => (
                        <option key={num} value={num}>{num}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 font-mono text-[10px]">
              <button
                onClick={() => setLeagueTab("joined")}
                className="flex-1 bg-slate-800 hover:bg-slate-755 text-slate-300 py-1.5 rounded cursor-pointer transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateLeague}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-1.5 rounded cursor-pointer transition-all"
              >
                Build Tier
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
