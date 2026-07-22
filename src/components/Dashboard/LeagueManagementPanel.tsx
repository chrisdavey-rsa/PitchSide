import React, { useState } from "react";
import { Award, X, Search, Eye, EyeOff, Wand2, Lock, ChevronUp, ChevronDown } from "lucide-react";
import { btnPrimary, btnSecondary, btnClose } from "../../ui";
import { getCompetitions } from "../../competitions";
import { SportType, UserProfile, League } from "../../types";
import type { LeaderboardRecord } from "../../supabase";
import {
  filterLeagues,
  sortLeagues,
  getLeagueSeason,
  getAvailableSports,
  sportLabel,
  generateStrongPassword,
  type LeagueSortKey,
  type LeagueSortDir,
} from "../../leagues";
import { getAvailableSeasons } from "../../seasons";
import { isGlobalLeague } from "../../lib/leaguesConfig";
import { getCountryFlag } from "./shared";
import LeaderboardPlayerLabel from "./LeaderboardPlayerLabel";

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
  leagueTab: "view" | "join" | "create";
  setLeagueTab: (tab: "view" | "join" | "create") => void;
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
  leagueSportInput: SportType;
  setLeagueSportInput: (v: SportType) => void;
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
  onClose?: () => void;
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
  leagueSportInput,
  setLeagueSportInput,
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
  onClose,
}: LeagueManagementPanelProps) {
  const [showLeaguePassword, setShowLeaguePassword] = useState(false);
  const [sortKey, setSortKey] = useState<LeagueSortKey>("name");
  const [sortDir, setSortDir] = useState<LeagueSortDir>("asc");
  const availableSeasons = getAvailableSeasons();

  const competitions = getCompetitions();
  const availableSports = getAvailableSports(competitions);
  const joinedLeagueIds = new Set(userLeagues.map((l) => l.id));

  const filteredLeagues = sortLeagues(
    filterLeagues(leagues, competitions, {
      search: viewLeaguesSearchName,
      sport: viewLeaguesSport,
      competitionId: viewLeaguesCompId,
      season: viewLeaguesSeason,
    }),
    sortKey,
    sortDir,
  );

  const toggleSort = (key: LeagueSortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      // Sensible defaults: name A→Z, members high→low, privacy public-first
      setSortDir(key === "members" ? "desc" : "asc");
    }
  };

  const SortChevron = ({ active }: { active: boolean }) =>
    active ? (
      sortDir === "asc" ? (
        <ChevronUp className="w-3 h-3 inline-block ml-0.5" />
      ) : (
        <ChevronDown className="w-3 h-3 inline-block ml-0.5" />
      )
    ) : null;

  const tabs: { key: "view" | "join" | "create"; label: string }[] = [
    { key: "view", label: "View" },
    { key: "join", label: "Join" },
    { key: "create", label: "Create" },
  ];

  const handleGeneratePassword = () => {
    setLeaguePasswordInput(generateStrongPassword());
    setShowLeaguePassword(true);
  };

  return (
    <div
      className={`bg-slate-900/60 rounded-2xl border border-slate-800/70 p-5 md:p-7 flex flex-col relative overflow-hidden backdrop-blur-xs h-[480px] md:h-[min(85vh,820px)] ${!isUserInAnyLeague ? "ring-2 ring-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.2)]" : ""}`}
    >
      {/* Header with title, submenu and optional close */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800/60 gap-3 shrink-0">
        <div className="flex items-center gap-1.5 shrink-0">
          <Award className="w-4 h-4 text-yellow-500" />
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
            Leagues
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 text-[10px] font-mono bg-slate-950/80 p-0.5 rounded border border-slate-800/60">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => {
                  setLeagueTab(tab.key);
                  if (tab.key === "view") setActiveLeagueId(null);
                }}
                className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${leagueTab === tab.key ? "bg-slate-800 text-white font-bold" : "text-slate-500 hover:text-slate-300"}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className={btnClose}
              title="Close leagues"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Fixed-height content region: the hub stays the same size across tabs */}
      <div className="flex-1 min-h-0 mt-3">
        {/* TAB CONTENT: VIEW (browse / search all leagues, or the selected league detail) */}
        {leagueTab === "view" &&
          (activeLeagueId ? (
            /* DETAILED LEAGUE VIEW */
            (() => {
              const activeLeague = leagues.find((l) => l.id === activeLeagueId);
              if (!activeLeague) return null;
              const scopeLabel = activeLeague.competitionId
                ? competitions.find((c) => c.id === activeLeague.competitionId)?.name ||
                  "Legacy competition"
                : "All sports";

              return (
                <div className="h-full overflow-y-auto pr-1 space-y-3">
                  <div className="flex items-center justify-between bg-slate-950/40 p-2 rounded-lg border border-slate-800/50">
                    <div>
                      <h4 className="text-xs font-bold text-white truncate max-w-[120px]">
                        {activeLeague.name}
                      </h4>
                      <p className="text-[9px] text-slate-500 truncate max-w-[120px] font-mono font-medium">
                        {scopeLabel}
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
                          <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-2">
                            <span
                              className={`font-bold font-mono text-[10px] w-4 shrink-0 ${i === 0 ? "text-yellow-400" : i === 1 ? "text-slate-400" : "text-slate-600"}`}
                            >
                              {i + 1}
                            </span>
                            <span
                              className="text-sm shrink-0 leading-none"
                              title={member.nationality || "United Kingdom"}
                              aria-hidden
                            >
                              {getCountryFlag(member.nationality)}
                            </span>
                            <LeaderboardPlayerLabel
                              nickname={member.nickname}
                              firstName={member.firstName}
                              surname={member.surname}
                              nicknameClassName="text-xs"
                              className="min-w-0 max-w-[96px]"
                            />
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
                      ← Back
                    </button>

                    <div className="flex items-center gap-2">
                      {!isGlobalLeague(activeLeague.id) &&
                        activeLeague.creatorId === user.id && (
                        <button
                          onClick={() => {
                            if (editingLeagueId === activeLeague.id) {
                              setEditingLeagueId(null);
                            } else {
                              setEditingLeagueId(activeLeague.id);
                              setEditIsPublic(!(activeLeague.isPrivate ?? activeLeague.isPublic === false));
                              setEditLimitParticipants(!!(activeLeague.maxPlayers ?? activeLeague.maxParticipants));
                              setEditMaxParticipantsInput(
                                String(activeLeague.maxPlayers ?? activeLeague.maxParticipants ?? 20),
                              );
                            }
                          }}
                          className="text-blue-400 hover:text-blue-300 px-2 py-1 rounded border border-blue-500/10 hover:border-blue-500/30 cursor-pointer transition-colors"
                        >
                          Manage Settings
                        </button>
                      )}
                      {!isGlobalLeague(activeLeague.id) && (
                      <button
                        onClick={() => handleLeaveLeague(activeLeague.id)}
                        className="text-red-400 hover:text-red-300 px-2 py-1 rounded border border-red-500/10 hover:border-red-500/30 cursor-pointer transition-colors"
                      >
                        {activeLeague.creatorId === user.id
                          ? "Delete/Disband"
                          : "Leave League"}
                      </button>
                      )}
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
                                {Array.from({ length: 20 }, (_, i) => i + 1).map((num) => (
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
            /* BROWSE / SEARCH ALL LEAGUES */
            <div className="h-full flex flex-col">
              {!isUserInAnyLeague && (
                <div className="mb-2 flex items-center justify-between gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2.5 py-1.5 shrink-0">
                  <p className="text-[10px] text-emerald-300 font-sans">
                    You're not in a league yet — pick one below to join.
                  </p>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => setLeagueTab("join")}
                      className="text-[9px] font-mono font-bold bg-blue-500 hover:bg-blue-600 px-2 py-1 rounded text-white cursor-pointer transition-colors"
                    >
                      Join
                    </button>
                    <button
                      onClick={() => setLeagueTab("create")}
                      className="text-[9px] font-mono font-bold bg-emerald-500 hover:bg-emerald-600 px-2 py-1 rounded text-white cursor-pointer transition-colors"
                    >
                      Create
                    </button>
                  </div>
                </div>
              )}

              {/* Live search (matches admin panel pattern) */}
              <div className="relative shrink-0">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search by name, competition, sport or season..."
                  value={viewLeaguesSearchName}
                  onChange={(e) => setViewLeaguesSearchName(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 text-slate-100 text-xs pl-9 pr-4 py-2 rounded-xl focus:border-blue-500 focus:outline-hidden transition-colors"
                />
              </div>

              {/* Filters */}
              <div className="grid grid-cols-2 gap-2 mt-2 shrink-0">
                <select
                  value={viewLeaguesSport}
                  onChange={(e) => {
                    setViewLeaguesSport(e.target.value as SportType | "ALL");
                    setViewLeaguesCompId("ALL");
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-300 focus:outline-hidden focus:border-blue-500"
                >
                  <option value="ALL">All Sports</option>
                  {availableSports.map((sport) => (
                    <option key={sport} value={sport}>
                      {sportLabel(sport)}
                    </option>
                  ))}
                </select>

                <select
                  value={viewLeaguesCompId}
                  onChange={(e) => setViewLeaguesCompId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-300 focus:outline-hidden focus:border-blue-500"
                >
                  <option value="ALL">All Competitions</option>
                  {competitions
                    .filter((c) => viewLeaguesSport === "ALL" || c.sport === viewLeaguesSport)
                    .map((comp) => (
                      <option key={comp.id} value={comp.id}>
                        {comp.name}
                      </option>
                    ))}
                </select>

                <select
                  value={viewLeaguesSeason}
                  onChange={(e) => setViewLeaguesSeason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-300 focus:outline-hidden focus:border-blue-500 col-span-2"
                >
                  <option value="ALL">All Seasons</option>
                  {availableSeasons.map((season) => (
                    <option key={season} value={season}>
                      {season}
                    </option>
                  ))}
                </select>
              </div>

              {/* Column headings — clickable sort */}
              <div className="grid grid-cols-12 gap-2 px-2.5 mt-3 pb-1 border-b border-slate-800/60 text-[9px] uppercase tracking-wider font-mono text-slate-500 shrink-0">
                <button
                  type="button"
                  onClick={() => toggleSort("name")}
                  className={`col-span-3 text-left flex items-center cursor-pointer hover:text-slate-300 transition-colors ${
                    sortKey === "name" ? "text-emerald-400" : ""
                  }`}
                >
                  League Name
                  <SortChevron active={sortKey === "name"} />
                </button>
                <button
                  type="button"
                  onClick={() => toggleSort("members")}
                  className={`col-span-2 text-center flex items-center justify-center cursor-pointer hover:text-slate-300 transition-colors ${
                    sortKey === "members" ? "text-emerald-400" : ""
                  }`}
                >
                  Members
                  <SortChevron active={sortKey === "members"} />
                </button>
                <span className="col-span-3">Scope</span>
                <span className="col-span-2">Sport</span>
                <button
                  type="button"
                  onClick={() => toggleSort("privacy")}
                  className={`col-span-2 text-left flex items-center cursor-pointer hover:text-slate-300 transition-colors ${
                    sortKey === "privacy" ? "text-emerald-400" : ""
                  }`}
                  title={
                    sortKey === "privacy"
                      ? sortDir === "asc"
                        ? "Public first"
                        : "Private first"
                      : "Sort by privacy"
                  }
                >
                  Privacy
                  <SortChevron active={sortKey === "privacy"} />
                </button>
              </div>

              {/* League list (scrolls; hub itself stays fixed height) */}
              <div className="flex-1 min-h-0 overflow-y-auto pr-1 mt-1.5 space-y-1.5">
                {filteredLeagues.length === 0 ? (
                  <p className="text-center text-[11px] text-slate-500 font-mono py-8">
                    No leagues found.
                  </p>
                ) : (
                  filteredLeagues.map((league) => {
                    const comp = competitions.find((c) => c.id === league.competitionId);
                    const isJoined = joinedLeagueIds.has(league.id);
                    return (
                      <div
                        key={league.id}
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setActiveLeagueId(league.id);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            e.stopPropagation();
                            setActiveLeagueId(league.id);
                          }
                        }}
                        className={`grid grid-cols-12 gap-2 items-center p-2.5 rounded-xl cursor-pointer transition-colors group ${isJoined ? "bg-emerald-500/5 border border-emerald-500/30 hover:bg-emerald-500/10" : "bg-slate-950/40 border border-slate-800 hover:bg-slate-900"}`}
                      >
                        <div className="col-span-3 min-w-0">
                          <h4 className="text-xs font-bold text-white truncate inline-flex items-center gap-1.5 max-w-full">
                            {(league.isPrivate || league.isPublic === false) && (
                              <Lock
                                className="w-3 h-3 text-slate-400 shrink-0"
                                strokeWidth={1.75}
                                aria-label="Private league"
                              />
                            )}
                            <span className="truncate">{league.name}</span>
                          </h4>
                          {isJoined && (
                            <span className="text-[8px] text-emerald-400 font-mono uppercase tracking-wide">
                              Joined
                            </span>
                          )}
                        </div>
                        <div className="col-span-2 text-center text-[11px] text-slate-300 font-mono">
                          {league.members?.length ?? 0}
                        </div>
                        <div className="col-span-3 min-w-0 text-[10px] text-slate-400 font-mono truncate">
                          {comp?.name || "All sports"}
                        </div>
                        <div className="col-span-2 min-w-0 text-[10px] text-slate-400 font-mono capitalize truncate">
                          {comp ? sportLabel(comp.sport) : "Multi"}
                        </div>
                        <div className="col-span-2 text-[10px] font-mono">
                          {league.isPrivate || league.isPublic === false ? (
                            <span className="text-slate-400 bg-slate-800/80 border border-slate-700 px-1.5 py-0.5 rounded uppercase text-[8px]">
                              Private
                            </span>
                          ) : (
                            <span className="text-blue-400 bg-blue-500/15 px-1.5 py-0.5 rounded uppercase text-[8px]">
                              Public
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ))}

        {/* TAB CONTENT: JOIN ANOTHER CONTEST LEAGUE */}
        {leagueTab === "join" && (
          <div className="h-full overflow-y-auto pr-1 space-y-3">
            <p className="text-[10px] text-slate-400">
              Enter league Code/ID and password key:
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
                  Password Key
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
                onClick={handleJoinLeague}
                className={`${btnPrimary} flex-1 py-1.5`}
              >
                Join League
              </button>
              <button
                onClick={() => setLeagueTab("view")}
                className={`${btnSecondary} flex-1 py-1.5`}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* TAB CONTENT: CREATE BRAND NEW PRIVATE TOURNAMENT */}
        {leagueTab === "create" && (
          <div className="h-full overflow-y-auto pr-1 space-y-3">
            <p className="text-[10px] text-slate-400">Build your league.</p>

            <div className="space-y-2">
              <div>
                <span className="text-[9px] text-slate-500 font-mono block uppercase mb-1">
                  League Name
                </span>
                <input
                  type="text"
                  placeholder="e.g. London Office Rivals"
                  value={leagueNameInput}
                  onChange={(e) => setLeagueNameInput(e.target.value)}
                  className="w-full text-xs bg-slate-950 border border-slate-800 hover:border-slate-700 p-2 rounded text-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-2">
                <div className="w-full">
                  <span className="text-[9px] text-slate-500 font-mono block uppercase mb-1">
                    Season
                  </span>
                  <select
                    value={leagueSeasonInput}
                    onChange={(e) => setLeagueSeasonInput(e.target.value)}
                    className="w-full text-xs bg-slate-950 border border-slate-800 p-2 rounded text-white focus:outline-hidden font-sans"
                  >
                    {availableSeasons.map((season) => (
                      <option key={season} value={season}>
                        {season}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <p className="text-[10px] text-slate-500 font-sans leading-relaxed rounded-lg border border-slate-800/80 bg-slate-950/40 px-3 py-2">
                Your league covers <span className="text-slate-300 font-semibold">all Football and Rugby</span> fixtures.
                Friends compete across every competition — no single-tournament lock.
              </p>

              <div>
                <span className="text-[9px] text-slate-500 font-mono block uppercase mb-1">
                  Enter League Password
                </span>
                <div className="relative">
                  <input
                    type={showLeaguePassword ? "text" : "password"}
                    placeholder="Enter a secret password..."
                    value={leaguePasswordInput}
                    onChange={(e) => setLeaguePasswordInput(e.target.value)}
                    className="w-full text-xs bg-slate-950 border border-slate-800 p-2 pr-16 rounded text-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => setShowLeaguePassword((v) => !v)}
                      title={showLeaguePassword ? "Hide password" : "Show password"}
                      className="p-1.5 text-slate-500 hover:text-slate-200 cursor-pointer transition-colors"
                    >
                      {showLeaguePassword ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleGeneratePassword}
                      title="Generate strong password"
                      className="p-1.5 text-emerald-500 hover:text-emerald-300 cursor-pointer transition-colors"
                    >
                      <Wand2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="leagueVisibility"
                  checked={leagueIsPublicInput}
                  onChange={(e) => setLeagueIsPublicInput(e.target.checked)}
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
                      {Array.from({ length: 20 }, (_, i) => i + 1).map((num) => (
                        <option key={num} value={num}>{num}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 font-mono text-[10px]">
              <button
                onClick={handleCreateLeague}
                className={`${btnPrimary} flex-1 py-1.5`}
              >
                Create League
              </button>
              <button
                onClick={() => setLeagueTab("view")}
                className={`${btnSecondary} flex-1 py-1.5`}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
