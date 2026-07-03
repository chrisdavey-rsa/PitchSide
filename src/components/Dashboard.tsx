/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useAuthStatus } from '../hooks/useAuthStatus';
import {
  Trophy,
  History,
  TrendingUp,
  Settings,
  HelpCircle,
  LogOut,
  ChevronRight,
  Sparkles,
  Zap,
  Play,
  RotateCcw,
  Check,
  Award,
  Lock,
  Mail,
  UserCheck,
  ShieldAlert,
  Plus,
  Minus,
  X,
} from "lucide-react";
import {
  dbFetchPlayers,
  dbFetchMatches,
  dbSavePrediction,
  dbFetchPredictions,
  dbFetchLeagues,
  dbCreateLeague,
  dbJoinLeague,
  dbLeaveLeague,
  dbFetchUserLeagues,
  dbFetchLeagueMembers,
  dbUpdateLeagueSettings,
  isSupabaseConfigured,
  supabase,
} from "../supabase";
import {
  UserProfile,
  SportType,
  Competition,
  Match,
  Prediction,
  League,
} from "../types";
import PitchSideLogo from "./PitchSideLogo";
import { getCompetitions } from "../competitions";
import {
  ALL_COMPETITIONS,
  INITIAL_LEADERBOARD,
  FOOTBALL_COMPETITIONS,
  RUGBY_COMPETITIONS,
} from "../data";
import { calculatePoints } from "../utils";

interface DashboardProps {
  user: UserProfile;
  onLogout: () => void;
  onOpenRules: () => void;
  registeredUsers: UserProfile[];
  onOpenAdmin: () => void;
  onOpenAccount: () => void;
  externalSelectedLeagueId?: string | null;
  onClearExternalLeagueSelection?: () => void;
}

const getCountryFlag = (countryName?: string): React.ReactNode => {
  const getCountryCode = (name?: string): string => {
    if (!name) return "gb";
    const c = name.toLowerCase().trim();
    if (c === "uk" || c === "united kingdom" || c === "gb" || c === "england")
      return "gb";
    if (c === "za" || c === "south africa") return "za";
    if (c === "nz" || c === "new zealand") return "nz";
    if (c === "au" || c === "australia") return "au";
    if (c === "ie" || c === "ireland") return "ie";
    if (c === "fr" || c === "france") return "fr";
    if (c === "it" || c === "italy") return "it";
    if (c === "jp" || c === "japan") return "jp";
    if (c === "ar" || c === "argentina" || c === "los pumas") return "ar";
    if (c === "es" || c === "spain") return "es";
    if (c === "de" || c === "germany") return "de";
    if (c === "br" || c === "brazil") return "br";
    if (c === "us" || c === "united states" || c === "usa") return "us";
    if (c === "ca" || c === "canada") return "ca";
    if (c === "nl" || c === "netherlands") return "nl";
    if (c === "pt" || c === "portugal") return "pt";
    if (c === "in" || c === "india") return "in";
    if (c === "ch" || c === "switzerland") return "ch";
    if (c === "be" || c === "belgium") return "be";
    if (c === "se" || c === "sweden") return "se";
    if (c === "no" || c === "norway") return "no";
    if (c === "fi" || c === "finland") return "fi";
    if (c === "dk" || c === "denmark") return "dk";
    if (c === "fiji" || c === "fj") return "fj";
    if (c === "samoa" || c === "ws") return "ws";
    if (c === "wales") return "gb-wls";
    if (c === "scotland") return "gb-sct";
    return "gb";
  };
  return (
    <img
      src={`https://flagcdn.com/16x12/${getCountryCode(countryName)}.png`}
      width="16"
      height="12"
      alt={countryName || "GB"}
      className="rounded-xs object-cover select-none inline-block align-middle"
      referrerPolicy="no-referrer"
    />
  );
};

const MetallicTickWithLightning = () => {
  return (
    <div
      className="relative flex items-center justify-center w-6 h-6 shrink-0 bg-linear-to-b from-slate-800 to-emerald-950 border border-emerald-450 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.6)] overflow-hidden"
      title="Prediction Saved (Locked)"
    >
      {/* High-speed sliding shimmery metal highlight */}
      <motion.div
        animate={{ left: ["-100%", "200%"] }}
        transition={{
          repeat: Infinity,
          duration: 2,
          ease: "easeInOut",
          repeatDelay: 1,
        }}
        className="absolute top-0 bottom-0 w-3 bg-linear-to-r from-transparent via-white/45 to-transparent skew-x-12"
      />

      {/* Dynamic electric ring pulsing */}
      <motion.div
        animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
        transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
        className="absolute inset-0 border border-emerald-400 rounded-full blur-xs"
      />

      {/* Glowing energy back-light of lightning */}
      <div className="absolute inset-0 bg-emerald-500/5" />

      {/* metallic green check & mini lightning zaps */}
      <div className="relative flex items-center justify-center">
        <Check className="w-3.5 h-3.5 text-emerald-405 stroke-[4px] relative drop-shadow-[0_0_6px_rgba(16,185,129,0.8)] text-emerald-400" />
        <motion.div
          animate={{ scale: [0.8, 1.2, 0.8], opacity: [0.6, 1, 0.6] }}
          transition={{ repeat: Infinity, duration: 0.6, ease: "easeInOut" }}
          className="absolute -top-1.5 -right-1 z-20"
        >
          <Zap className="w-2.5 h-2.5 text-yellow-450 fill-yellow-400 drop-shadow-[0_0_4px_rgba(234,179,8,0.9)]" />
        </motion.div>
      </div>
    </div>
  );
};

export default function Dashboard({
  user,
  onLogout,
  onOpenRules,
  registeredUsers,
  onOpenAdmin,
  onOpenAccount,
  externalSelectedLeagueId,
  onClearExternalLeagueSelection,
}: DashboardProps) {
  const authStatus = useAuthStatus();
  const isSandbox =
    !user || !user.id || user.id.startsWith("usr_") || user.id === "user-admin";
  const [selectedSport, setSelectedSport] = useState<SportType | null>(null);
  const [globalLeaderboardSport, setGlobalLeaderboardSport] = useState<SportType>(SportType.FOOTBALL);
  const [selectedCompId, setSelectedCompId] = useState<string | null>(null);
  
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);

  useEffect(() => {
    const checkUnread = () => {
      const stored = JSON.parse(localStorage.getItem('pitchside_messages') || '[]');
      const myMessages = stored.filter((m: any) => m.receiverId === user?.id || m.receiverId === 'all');
      setUnreadMessagesCount(myMessages.filter((m: any) => !m.read).length);
    };

    checkUnread();
    const interval = setInterval(checkUnread, 5000);
    return () => clearInterval(interval);
  }, [user?.id]);

  // Hover states for the epic lightning effect
  const [fbHover, setFbHover] = useState(false);
  const [rbHover, setRbHover] = useState(false);

  // Predictions tracking state synced from Firestore or LocalStorage for Sandbox
  const [predictions, setPredictions] = useState<
    Record<string, { home: number; away: number; submitted: boolean }>
  >(() => {
    const saved = localStorage.getItem(`predictions_${user?.id || "guest"}`);
    return saved ? JSON.parse(saved) : {};
  });

  // Keep track of our user points & rankings locally synced from Firestore or LocalStorage for Sandbox
  const [userPoints, setUserPoints] = useState<number>(() => {
    const saved = localStorage.getItem(`points_${user?.id || "guest"}`);
    return saved ? parseInt(saved, 10) : 0;
  });

  // State to handle simulated match results synced from Firestore or LocalStorage
  const [simulatedResults, setSimulatedResults] = useState<
    Record<
      string,
      { home: number; away: number; played: boolean; pointsWon?: number }
    >
  >(() => {
    const saved = localStorage.getItem(`simulated_${user?.id || "guest"}`);
    return saved ? JSON.parse(saved) : {};
  });
  const [simulationActive, setSimulationActive] = useState(false);

  // Live sorted leaderboard lists from database
  const [leaderboardList, setLeaderboardList] = useState<any[]>([]);

  // Simple feedback notification states
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Live database matches & Local sandbox fixtures
  const [dbMatches, setDbMatches] = useState<Match[]>([]);
  const [localMatches, setLocalMatches] = useState<Match[]>(() => {
    const saved = localStorage.getItem("added_fixtures");
    return saved ? JSON.parse(saved) : [];
  });

  // Listen to local sandbox storage updates across modalities
  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem("added_fixtures");
      if (saved) {
        setLocalMatches(JSON.parse(saved));
      }
    };
    window.addEventListener("storage", handleStorageChange);
    // Periodically sync to pick up events in the administrative modal instantly
    const timer = setInterval(handleStorageChange, 1200);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      clearInterval(timer);
    };
  }, []);

  // System fixtures sync
  useEffect(() => {
    let isActive = true;
    const loadMatches = async () => {
      const matches = await dbFetchMatches();
      if (isActive) {
        setDbMatches(matches);
      }
    };
    loadMatches();
    return () => {
      isActive = false;
    };
  }, []);

  // Combined master schedule matching list
  const allMatches = useMemo(() => {
    const seen = new Set<string>();
    const combined: Match[] = [];

    dbMatches.forEach((m) => {
      combined.push(m);
      seen.add(m.id);
    });

    localMatches.forEach((m) => {
      if (!seen.has(m.id)) {
        combined.push(m);
        seen.add(m.id);
      }
    });

    return combined;
  }, [dbMatches, localMatches]);

  // Private custom leagues states
  const [leagues, setLeagues] = useState<League[]>(() => {
    const saved = localStorage.getItem(`leagues_${user?.id || "guest"}`);
    return saved ? JSON.parse(saved) : [];
  });
  const [userLeagues, setUserLeagues] = useState<League[]>([]);
  const [activeLeagueMembers, setActiveLeagueMembers] = useState<string[]>([]);
  const [activeLeagueId, setActiveLeagueId] = useState<string | null>(null);
  const [leagueToLeave, setLeagueToLeave] = useState<string | null>(null);
  const [viewingProfile, setViewingProfile] = useState<any | null>(null);

  useEffect(() => {
    if (externalSelectedLeagueId) {
      setActiveLeagueId(externalSelectedLeagueId);
      if (onClearExternalLeagueSelection) {
        onClearExternalLeagueSelection();
      }
    }
  }, [externalSelectedLeagueId, onClearExternalLeagueSelection]);

  // Fetch league members when activeLeagueId changes
  useEffect(() => {
    let isActive = true;
    if (activeLeagueId) {
      dbFetchLeagueMembers(activeLeagueId).then((members) => {
        if (isActive) {
          if (members.length > 0) {
            // just map to their IDs for the existing UI logic that checks activeLeague.members.includes(playerId)
            setActiveLeagueMembers(members.map(m => m.id));
          } else {
            // Fallback for local sandbox mode where dbFetchLeagueMembers returns []
            const targetLeague = leagues.find(l => l.id === activeLeagueId);
            if (targetLeague && targetLeague.members) {
              setActiveLeagueMembers(targetLeague.members);
            } else {
              setActiveLeagueMembers([]);
            }
          }
        }
      });
    } else {
      setActiveLeagueMembers([]);
    }
    return () => {
      isActive = false;
    };
  }, [activeLeagueId, leagues]);
  const [expandedStandingsUser, setExpandedStandingsUser] = useState<
    string | null
  >(null);

  // Custom league Create & Join flows interaction states
  const [leagueNameInput, setLeagueNameInput] = useState("");
  const [leaguePasswordInput, setLeaguePasswordInput] = useState("");
  const [leagueSeasonInput, setLeagueSeasonInput] = useState("2026");
  const [leagueCompSelect, setLeagueCompSelect] = useState("f-epl");
  const [leagueIsPublicInput, setLeagueIsPublicInput] = useState(true);
  const [limitParticipants, setLimitParticipants] = useState(false);
  const [maxParticipantsInput, setMaxParticipantsInput] = useState("10");

  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [joinPasswordInput, setJoinPasswordInput] = useState("");
  const [activeLeagueJoinPassword, setActiveLeagueJoinPassword] = useState("");
  const [isJoiningActiveLeague, setIsJoiningActiveLeague] = useState(false);

  const [leagueTab, setLeagueTab] = useState<"joined" | "create" | "join" | "view">(
    "joined",
  );

  const [viewLeaguesSearchName, setViewLeaguesSearchName] = useState("");
  const [viewLeaguesSport, setViewLeaguesSport] = useState<SportType | "ALL">("ALL");
  const [viewLeaguesCompId, setViewLeaguesCompId] = useState<string>("ALL");
  const [viewLeaguesSeason, setViewLeaguesSeason] = useState<string>("ALL");

  const [editingLeagueId, setEditingLeagueId] = useState<string | null>(null);
  const [editIsPublic, setEditIsPublic] = useState(true);
  const [editLimitParticipants, setEditLimitParticipants] = useState(false);
  const [editMaxParticipantsInput, setEditMaxParticipantsInput] = useState("10");

  // Unified predictions, leaderboards and leagues loaders
  useEffect(() => {
    if (!user || !user.id) return;

    let isActive = true;

    const loadData = async () => {
      try {
        // 1. Fetch predictions
        const currentPredictions = await dbFetchPredictions(user.id);
        if (isActive) {
          setPredictions(currentPredictions);
          localStorage.setItem(
            `predictions_${user.id}`,
            JSON.stringify(currentPredictions),
          );
        }

        // 2. Fetch tournament leagues
        const dbLeaguesList = await dbFetchLeagues();
        const dbUserLeagues = await dbFetchUserLeagues(user.id);
        
        if (isActive) {
          const list = [...dbLeaguesList];
          setLeagues(list);
          setUserLeagues(dbUserLeagues);
          localStorage.setItem(`leagues_${user.id}`, JSON.stringify(list));
        }

        // 3. Aggregate leaderboards
        const playersList = await dbFetchPlayers();
        if (isActive) {
          const records = await Promise.all(
            playersList.map(async (u) => {
              let pointsFootball = 0;
              let pointsRugby = 0;
              let predictionsFootball = 0;
              let predictionsRugby = 0;

              const upreds = await dbFetchPredictions(u.id);
              const keys = Object.keys(upreds);
              const submittedKeys = keys.filter((k) => upreds[k].submitted);

              submittedKeys.forEach((matchId) => {
                const pred = upreds[matchId];
                const matchedMatch = allMatches.find((m) => m.id === matchId);
                
                if (matchedMatch) {
                  if (matchedMatch.sport === SportType.FOOTBALL) {
                    predictionsFootball++;
                  } else if (matchedMatch.sport === SportType.RUGBY) {
                    predictionsRugby++;
                  }

                  if (
                    matchedMatch.status === "completed" &&
                    matchedMatch.homeScore !== undefined &&
                    matchedMatch.awayScore !== undefined
                  ) {
                    const pts = calculatePoints(
                      matchedMatch.sport,
                      pred.home,
                      pred.away,
                      matchedMatch.homeScore,
                      matchedMatch.awayScore,
                    );
                    
                    if (matchedMatch.sport === SportType.FOOTBALL) {
                      pointsFootball += pts;
                    } else if (matchedMatch.sport === SportType.RUGBY) {
                      pointsRugby += pts;
                    }
                  }
                }
              });

              const totalPoints = pointsFootball + pointsRugby;
              const totalPredictions = predictionsFootball + predictionsRugby;

              if (u.id === user.id) {
                setUserPoints(totalPoints);
                localStorage.setItem(`points_${user.id}`, totalPoints.toString());
              }

              return {
                playerId: u.id,
                nickname: u.nickname,
                nationality: u.nationality || "United Kingdom",
                points: totalPoints,
                pointsFootball,
                pointsRugby,
                predictionsMade: totalPredictions,
                predictionsFootball,
                predictionsRugby,
                accuracy:
                  totalPredictions > 0
                    ? `${Math.round((totalPoints / (totalPredictions * 5)) * 100)}%`
                    : "0%",
                accuracyFootball:
                  predictionsFootball > 0
                    ? `${Math.round((pointsFootball / (predictionsFootball * 5)) * 100)}%`
                    : "0%",
                accuracyRugby:
                  predictionsRugby > 0
                    ? `${Math.round((pointsRugby / (predictionsRugby * 5)) * 100)}%`
                    : "0%",
                isCurrentUser: u.id === user.id,
                isProfilePublic: u.isProfilePublic ?? true,
                predictions: upreds,
              };
            }),
          );

          setLeaderboardList(records);
        }
      } catch (err) {
        console.warn("Silent PostgreSQL Loader Sync Error:", err);
      }
    };

    loadData();
    const interval = setInterval(loadData, 5000);
    return () => {
      isActive = false;
      clearInterval(interval);
    };
  }, [user.id]);

  // Save/Update predictions in Firestore and local state
  const handleScoreChange = async (
    matchId: string,
    side: "home" | "away",
    val: string,
  ) => {
    const score = parseInt(val, 10);
    if (isNaN(score)) return;

    const nextPredictions = {
      ...predictions,
      [matchId]: {
        ...(predictions[matchId] || { home: 0, away: 0, submitted: false }),
        [side]: score,
      },
    };

    setPredictions(nextPredictions);
    localStorage.setItem(
      `predictions_${user.id}`,
      JSON.stringify(nextPredictions),
    );

    try {
      const matchObj = allMatches.find((m) => m.id === matchId);
      const currentHome =
        side === "home" ? score : (predictions[matchId]?.home ?? 0);
      const currentAway =
        side === "away" ? score : (predictions[matchId]?.away ?? 0);

      await dbSavePrediction(
        user.id,
        matchId,
        matchObj?.sport || SportType.FOOTBALL,
        matchObj?.competitionId || "f-epl",
        currentHome,
        currentAway,
        false,
      );
    } catch (e) {
      console.warn("Silent score write exception:", e);
    }
  };

  const handleRugbyPredictionChange = async (
    matchId: string,
    winner: "home" | "away" | "draw" | null,
    marginStr: string,
  ) => {
    let margin = parseInt(marginStr, 10);
    if (isNaN(margin) || margin < 0) margin = 0;

    const currentWinner =
      winner ||
      (predictions[matchId]
        ? predictions[matchId].home > predictions[matchId].away
          ? "home"
          : predictions[matchId].home < predictions[matchId].away
            ? "away"
            : "draw"
        : "draw");

    const calculatedHome = currentWinner === "home" ? margin : 0;
    const calculatedAway = currentWinner === "away" ? margin : 0;

    const nextPredictions = {
      ...predictions,
      [matchId]: {
        ...(predictions[matchId] || { home: 0, away: 0, submitted: false }),
        home: calculatedHome,
        away: calculatedAway,
      },
    };

    setPredictions(nextPredictions);
    localStorage.setItem(
      `predictions_${user.id}`,
      JSON.stringify(nextPredictions),
    );

    try {
      const matchObj = allMatches.find((m) => m.id === matchId);
      await dbSavePrediction(
        user.id,
        matchId,
        matchObj?.sport || SportType.RUGBY,
        matchObj?.competitionId || "r-nations",
        calculatedHome,
        calculatedAway,
        false,
      );
    } catch (e) {
      console.warn("Silent rugby score write exception:", e);
    }
  };

  const submitPrediction = async (matchId: string) => {
    const pred = predictions[matchId];
    if (!pred) return;

    const nextPredictions = {
      ...predictions,
      [matchId]: {
        ...pred,
        submitted: true,
      },
    };

    setPredictions(nextPredictions);
    localStorage.setItem(
      `predictions_${user.id}`,
      JSON.stringify(nextPredictions),
    );
    triggerToast("🎯 Prediction submitted successfully!");

    try {
      const matchObj = allMatches.find((m) => m.id === matchId);
      await dbSavePrediction(
        user.id,
        matchId,
        matchObj?.sport || SportType.FOOTBALL,
        matchObj?.competitionId || "f-epl",
        pred.home,
        pred.away,
        true,
      );
    } catch (e) {
      console.error("Error locking prediction:", e);
      triggerToast("⚠️ Database error saving prediction.");
    }
  };

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const handleUpdateLeagueSettings = async () => {
    if (!editingLeagueId) return;
    
    const maxParts = editLimitParticipants ? parseInt(editMaxParticipantsInput, 10) : null;
    await dbUpdateLeagueSettings(editingLeagueId, editIsPublic, maxParts);
    
    const updated = leagues.map(l => l.id === editingLeagueId ? {
      ...l,
      isPublic: editIsPublic,
      maxParticipants: maxParts ?? undefined,
      updatedAt: new Date().toISOString()
    } : l);
    
    setLeagues(updated);
    localStorage.setItem(`leagues_${user.id}`, JSON.stringify(updated));
    setEditingLeagueId(null);
    triggerToast("✅ League settings updated");
  };

  const handleCreateLeague = async () => {
    const name = leagueNameInput.trim();
    const password = leaguePasswordInput.trim();
    const compId = leagueCompSelect;

    if (!name || !password || !compId) {
      triggerToast("⚠️ Specify a name, competition and password.");
      return;
    }

    if (name.length < 3) {
      triggerToast("⚠️ Name must be at least 3 characters.");
      return;
    }

    const newLeagueId = `LG_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const newLeague: League = {
      id: newLeagueId,
      name,
      password,
      competitionId: compId,
      creatorId: user.id,
      creatorName: user.nickname,
      members: [user.id],
      isPublic: leagueIsPublicInput,
      maxParticipants: limitParticipants ? parseInt(maxParticipantsInput, 10) : undefined,
      season: leagueSeasonInput,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const nextLeagues = [...leagues, newLeague];
    setLeagues(nextLeagues);
    localStorage.setItem(`leagues_${user.id}`, JSON.stringify(nextLeagues));
    setUserLeagues(prev => [...prev, newLeague]); // Optimistic update

    // Clear inputs
    setLeagueNameInput("");
    setLeaguePasswordInput("");
    setLeagueIsPublicInput(true);
    setLimitParticipants(false);
    setMaxParticipantsInput("10");
    triggerToast(
      `🎉 Created League: "${name}" successfully! Code: ${newLeagueId}`,
    );

    try {
      await dbCreateLeague(newLeague);
      const dbUserLeagues = await dbFetchUserLeagues(user.id);
      setUserLeagues(dbUserLeagues);
      
      // Update active league details AFTER creation is complete to prevent race conditions
      setLeagueTab("joined");
      setActiveLeagueId(newLeagueId);
    } catch (err) {
      console.error("Failed writing cloud league:", err);
      triggerToast("⚠️ Failed to sync league to PostgreSQL.");
    }
  };

  const handleJoinLeague = async () => {
    const codeInput = joinCodeInput.trim().toUpperCase();
    const passwordEntered = joinPasswordInput.trim();

    if (!codeInput || !passwordEntered) {
      triggerToast("⚠️ League Code and Password are required.");
      return;
    }

    // Match code with ID or Name
    const target = leagues.find(
      (l) =>
        l.id.toUpperCase() === codeInput ||
        l.name.toLowerCase() === joinCodeInput.trim().toLowerCase(),
    );

    if (!target) {
      triggerToast("⚠️ Private league not found.");
      return;
    }

    if (target.password !== passwordEntered) {
      triggerToast("❌ Incorrect entry password.");
      return;
    }

    if (userLeagues.some(l => l.id === target.id)) {
      triggerToast("ℹ️ Already joined.");
      setActiveLeagueId(target.id);
      setLeagueTab("joined");
      return;
    }

    const currentMembers = await dbFetchLeagueMembers(target.id);

    if (target.maxParticipants && currentMembers.length >= target.maxParticipants) {
      triggerToast(`⚠️ League is full (Max ${target.maxParticipants} players).`);
      return;
    }

    try {
      await dbJoinLeague(target.id, user.id);
      const dbUserLeagues = await dbFetchUserLeagues(user.id);
      setUserLeagues(dbUserLeagues);
      
      // Reset inputs
      setJoinCodeInput("");
      setJoinPasswordInput("");
      setLeagueTab("joined");
      setActiveLeagueId(target.id);

      triggerToast(`🎉 Joined "${target.name}"!`);
    } catch (err) {
      console.error("Failed joining cloud league:", err);
      triggerToast("⚠️ Database integration failed.");
    }
  };

  const handleLeaveLeague = async (leagueId: string) => {
    const target = userLeagues.find((l) => l.id === leagueId);
    if (!target) return;

    if (target.creatorId === user.id) {
      // Creator deletes the league
      try {
        if (supabase) {
          await supabase.from("leagues").delete().eq("id", leagueId);
        }
      } catch (err) {
        console.error("Failed deleting league:", err);
      }
      
      const dbUserLeagues = await dbFetchUserLeagues(user.id);
      setUserLeagues(dbUserLeagues);
      
      const nextLeagues = leagues.filter((l) => l.id !== leagueId);
      setLeagues(nextLeagues);
      localStorage.setItem(`leagues_${user.id}`, JSON.stringify(nextLeagues));
      setActiveLeagueId(null);
      triggerToast(`🗑️ Deleted your league: "${target.name}".`);
      return;
    }

    try {
      await dbLeaveLeague(leagueId, user.id);
      const dbUserLeagues = await dbFetchUserLeagues(user.id);
      setUserLeagues(dbUserLeagues);
      setActiveLeagueId(null);
      triggerToast(`🚪 Left "${target.name}".`);
    } catch (err) {
      console.error("Failed leaving league:", err);
    }
  };

  // Run the match simulation
  const simulateMatchPlay = async (match: Match) => {
    const pred = predictions[match.id];
    if (!pred || !pred.submitted) {
      triggerToast("⚠️ Please enter and submit a score prediction first!");
      return;
    }

    setSimulationActive(true);

    // Simulate outcome with beautiful timed response
    setTimeout(async () => {
      let actualHomeScore = Math.floor(Math.random() * 4);
      let actualAwayScore = Math.floor(Math.random() * 4);

      if (match.sport === SportType.RUGBY) {
        actualHomeScore = Math.floor(Math.random() * 25) + 10;
        actualAwayScore = Math.floor(Math.random() * 25) + 10;
      }

      // Calculate points earned
      const points = calculatePoints(
        match.sport,
        pred.home,
        pred.away,
        actualHomeScore,
        actualAwayScore,
      );

      const nextSimulatedResults = {
        ...simulatedResults,
        [match.id]: {
          home: actualHomeScore,
          away: actualAwayScore,
          played: true,
          pointsWon: points,
        },
      };

      setSimulatedResults(nextSimulatedResults);
      localStorage.setItem(
        `simulated_${user.id}`,
        JSON.stringify(nextSimulatedResults),
      );

      const newPts = userPoints + points;
      setUserPoints(newPts);
      localStorage.setItem(`points_${user.id}`, newPts.toString());

      setSimulationActive(false);

      if (points === 5) {
        triggerToast("🔥 INCREDIBLE! PERFECT SCORE - earned 5 points!");
      } else if (points > 0) {
        triggerToast(`🎉 Good prediction! You earned ${points} point(s)!`);
      } else {
        triggerToast("💔 Tough luck! 0 points awarded. Try another match!");
      }

      try {
        await dbSavePrediction(
          user.id,
          match.id,
          match.sport,
          match.competitionId,
          pred.home,
          pred.away,
          true,
        );
      } catch (dbErr) {
        console.error("Simulation results sync error:", dbErr);
      }
    }, 1200);
  };

  const resetAllSimulations = async () => {
    try {
      setPredictions({});
      setSimulatedResults({});
      setUserPoints(0);
      localStorage.removeItem(`predictions_${user.id}`);
      localStorage.removeItem(`points_${user.id}`);
      localStorage.removeItem(`simulated_${user.id}`);
      triggerToast("♻️ Scores and schedules successfully reset.");

      if (supabase) {
        await supabase.from("predictions").delete().eq("user_id", user.id);
      }
    } catch (e) {
      console.error("Error during resets:", e);
      triggerToast("⚠️ Error resetting local state.");
    }
  };

  // Get active sport competitions
  const filteredCompetitions = getCompetitions().filter((c) => c.sport === selectedSport);
  const selectedCompetition = getCompetitions().find(
    (c) => c.id === selectedCompId,
  );

  const { activeMatches, groupedActiveMatches, sortedActiveMatches } = useMemo(() => {
    const active = allMatches.filter(
      (m) => m.competitionId === selectedCompId,
    );

    const grouped: Record<string, Record<string, typeof allMatches>> = {};
    const sorted = [...active].sort((a, b) => {
      const dateA = new Date(a.matchDate);
      const dateB = new Date(b.matchDate);
      if (dateA.getTime() !== dateB.getTime()) {
        return dateA.getTime() - dateB.getTime();
      }
      return a.homeTeam.localeCompare(b.homeTeam);
    });

    sorted.forEach((match) => {
      const d = new Date(match.matchDate);
      const dateKey = d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      const timeKey = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      if (!grouped[dateKey]) grouped[dateKey] = {};
      if (!grouped[dateKey][timeKey]) grouped[dateKey][timeKey] = [];
      grouped[dateKey][timeKey].push(match);
    });

    return { activeMatches: active, groupedActiveMatches: grouped, sortedActiveMatches: sorted };
  }, [allMatches, selectedCompId]);



  // Dedicated League Detail calculations
  const {
    activeLeagueMatches,
    groupedActiveLeagueMatches,
    sortedActiveLeagueMatches,
    leagueMembersMemoized
  } = useMemo(() => {
    const activeLeague = leagues.find((l) => l.id === activeLeagueId);
    if (!activeLeague) {
      return {
        activeLeagueMatches: [],
        groupedActiveLeagueMatches: {},
        sortedActiveLeagueMatches: [],
        leagueMembersMemoized: [],
      };
    }
    const comp = getCompetitions().find((c) => c.id === activeLeague.competitionId);
    const isLeagueFootball = comp?.sport === SportType.FOOTBALL || activeLeague.competitionId?.startsWith("f-");

    const aMatches = allMatches.filter(
      (m) => m.competitionId === activeLeague.competitionId,
    );

    const grouped: Record<string, Record<string, typeof allMatches>> = {};
    const sorted = [...aMatches].sort((a, b) => {
      const dateA = new Date(a.matchDate);
      const dateB = new Date(b.matchDate);
      if (dateA.getTime() !== dateB.getTime()) {
        return dateA.getTime() - dateB.getTime();
      }
      return a.homeTeam.localeCompare(b.homeTeam);
    });

    sorted.forEach((match) => {
      const d = new Date(match.matchDate);
      const dateKey = d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      const timeKey = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      if (!grouped[dateKey]) grouped[dateKey] = {};
      if (!grouped[dateKey][timeKey]) grouped[dateKey][timeKey] = [];
      grouped[dateKey][timeKey].push(match);
    });

    const members = leaderboardList.filter((member) =>
      activeLeagueMembers.includes(member.playerId),
    ).map(item => ({
      ...item,
      displayPoints: isLeagueFootball ? item.pointsFootball : item.pointsRugby,
      displayPredictions: isLeagueFootball ? item.predictionsFootball : item.predictionsRugby,
      displayAccuracy: isLeagueFootball ? item.accuracyFootball : item.accuracyRugby,
    }));

    members.sort((a, b) => b.displayPoints - a.displayPoints);

    return {
      activeLeagueMatches: aMatches,
      groupedActiveLeagueMatches: grouped,
      sortedActiveLeagueMatches: sorted,
      leagueMembersMemoized: members,
    };
  }, [activeLeagueId, leagues, allMatches, activeLeagueMembers, leaderboardList]);

  // Statistics summaries
  const totalPredicted = Object.keys(predictions).filter(
    (k) => predictions[k].submitted,
  ).length;
  const perfectPredictions = Object.keys(simulatedResults).filter(
    (k) => simulatedResults[k].pointsWon === 5,
  ).length;

  const currentCalendarYear = new Date().getFullYear();

  // Lifetime summaries: based on simulated/played games
  const lifetimePlayed = Object.keys(simulatedResults).filter(
    (k) => simulatedResults[k].played,
  ).length;
  const lifetimePerfect = Object.keys(simulatedResults).filter(
    (k) => simulatedResults[k].pointsWon === 5,
  ).length;
  const lifetimeAccuracy =
    lifetimePlayed > 0
      ? Math.round((lifetimePerfect / lifetimePlayed) * 100)
      : 0;

  // Live leaderboard computation from Supabase data with absolutely no mock merging
  const displayLeaderboard = useMemo(() => {
    const isFootball = globalLeaderboardSport === SportType.FOOTBALL;
    
    // Filter to players who have made predictions in the selected sport
    let filtered = leaderboardList.filter(item => 
      isFootball ? item.predictionsFootball > 0 : item.predictionsRugby > 0
    );

    filtered.sort((a, b) => {
      if (isFootball) return b.pointsFootball - a.pointsFootball;
      return b.pointsRugby - a.pointsRugby;
    });

    return filtered.map((item, index) => ({
      ...item,
      displayPoints: isFootball ? item.pointsFootball : item.pointsRugby,
      displayPredictions: isFootball ? item.predictionsFootball : item.predictionsRugby,
      displayAccuracy: isFootball ? item.accuracyFootball : item.accuracyRugby,
      rank: index + 1,
    }));
  }, [leaderboardList, globalLeaderboardSport]);

  // Seasonal summaries: based on simulated/played games starting in the current calendar year
  const seasonalPlayedMatches = Object.keys(simulatedResults).filter(
    (matchId) => {
      if (!simulatedResults[matchId].played) return false;
      const match = allMatches.find((m) => m.id === matchId);
      if (!match) return false;
      const matchYear = new Date(match.matchDate).getFullYear();
      return matchYear === currentCalendarYear;
    },
  );
  const seasonalPlayedCount = seasonalPlayedMatches.length;
  const seasonalPerfectCount = seasonalPlayedMatches.filter(
    (matchId) => simulatedResults[matchId].pointsWon === 5,
  ).length;
  const seasonalAccuracy =
    seasonalPlayedCount > 0
      ? Math.round((seasonalPerfectCount / seasonalPlayedCount) * 100)
      : 0;

  const isUserInAnyLeague = userLeagues.length > 0;

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 animate-fade-in pb-20 md:pb-0">
      {/* Branded Navigation Bar */}
      <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-800/80 p-4 sm:px-6 flex items-center justify-between shadow-xl">
        <div className="flex items-center gap-3">
          <div
            onClick={() => {
              setActiveLeagueId(null);
              setSelectedSport(null);
              setSelectedCompId(null);
            }}
            className="cursor-pointer"
          >
            <PitchSideLogo size="md" autoplay={false} />
          </div>
          {user.isAdmin && (
            <span className="bg-purple-500/15 border border-purple-500/30 text-purple-400 font-mono text-[9px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">
              ADMINISTRATOR
            </span>
          )}
        </div>

        <div className="hidden md:flex items-center gap-2 sm:gap-4">
          <motion.button
            layoutId="nav-account-btn"
            id="nav-account-btn"
            onClick={onOpenAccount}
            className="text-xs text-slate-300 hover:text-white bg-slate-800/60 p-2 sm:px-3 sm:py-1.5 rounded-lg cursor-pointer transition-colors flex items-center gap-1.5 font-medium relative"
          >
            <UserCheck className="w-4 h-4 text-emerald-450" />
            <span>Account</span>
            {unreadMessagesCount > 0 && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse border-2 border-slate-900"></span>
            )}
          </motion.button>

          <motion.button
            layoutId="nav-rules-btn"
            id="nav-rules-btn"
            onClick={onOpenRules}
            className="text-xs text-slate-300 hover:text-white bg-slate-800/60 p-2 sm:px-3 sm:py-1.5 rounded-lg cursor-pointer transition-colors flex items-center gap-1.5 font-medium"
          >
            <HelpCircle className="w-4 h-4 text-blue-400" />
            <span className="hidden sm:inline">Rules Guide</span>
          </motion.button>

          {/* Admin Toggle Switch */}
          {user.isAdmin && (
            <button
              id="nav-admin-toggle-btn"
              onClick={onOpenAdmin}
              className="text-xs text-white bg-purple-600 hover:bg-purple-700 active:translate-y-[0.5px] border border-purple-500 py-1.5 px-3 rounded-lg flex items-center gap-1.5 font-semibold transition-all shadow-[0_4px_12px_rgba(147,51,234,0.3)] cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5 text-white" />
              <span>Admin Area</span>
            </button>
          )}

          <button
            id="nav-logout-btn"
            onClick={onLogout}
            className="text-xs text-slate-400 hover:text-red-400 bg-slate-950/60 p-2 rounded-lg cursor-pointer transition-colors"
            title="Log out from PitchSide"
          >
            <LogOut className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>

      {/* Global Alerts Feed */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 border border-emerald-500/30 text-emerald-300 pl-4 pr-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 backdrop-blur-md"
          >
            <div className="bg-emerald-500/10 p-1.5 rounded-lg">
              <Check className="w-4 h-4 text-emerald-400" />
            </div>
            <span className="text-sm font-sans font-medium">
              {toastMessage}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {activeLeagueId ? (
        /* DEDICATED LEAGUE DETAIL PAGE VIEW */
        (() => {
          const activeLeague = leagues.find((l) => l.id === activeLeagueId);
          if (!activeLeague) {
            setActiveLeagueId(null);
            return null;
          }
          const comp = getCompetitions().find((c) => c.id === activeLeague.competitionId);
          const compName = comp?.name || "Multi-Tournament";

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
                      onClick={() => setActiveLeagueId(null)}
                      className="text-[11px] font-mono font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded cursor-pointer transition-colors flex items-center gap-1 uppercase"
                    >
                      ← Back to Dashboard
                    </button>
                  </div>

                  <h1 className="text-2xl sm:text-3xl font-extrabold font-display text-white tracking-tight pt-1">
                    {activeLeague.name}
                  </h1>
                  <p className="text-slate-400 text-xs font-sans">
                    Tournament:{" "}
                    <span className="text-white font-mono font-semibold">
                      {compName}
                    </span>{" "}
                    • Created by{" "}
                    <span className="text-slate-300 font-semibold">
                      {activeLeague.creatorName || "Admin"}
                    </span>
                  </p>
                </div>

                {/* Registered users at the far right of header */}
                <div className="text-right shrink-0 relative z-10 flex flex-col items-end gap-2">
                  <span className="text-xs bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20 px-3.5 py-2.5 rounded-xl block font-mono">
                    👥 {leagueMembersMemoized.length} Registered Players
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
                    {leagueMembersMemoized.map((member, idx) => {
                      const isMe = member.playerId === user.id;
                      const matchUser = registeredUsers.find(
                        (r) => r.id === member.playerId,
                      );
                      const userFlag = getCountryFlag(matchUser?.nationality);

                      return (
                        <div
                          key={member.playerId}
                          className="group flex flex-col gap-1"
                        >
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
                              // Run the accurate calculation based on real prediction historical maps:
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

                  <div className="mt-2 pt-4 border-t border-slate-800/65 flex justify-between items-center">
                    <span className="text-[10px] font-mono text-slate-500 uppercase">League Join Code:</span>
                    <span className="text-xs font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20 select-all cursor-text">
                      {activeLeague.id}
                    </span>
                  </div>

                  {/* Leave or Join League button at the bottom of Standings box */}
                  <div className="border-t border-slate-805/80 pt-4 mt-2">
                    {activeLeagueMembers.includes(user.id) ? (
                      <button
                        onClick={() => setLeagueToLeave(activeLeague.id)}
                        className="w-full text-xs font-mono font-bold bg-red-950/15 hover:bg-red-950/40 border border-red-500/20 hover:border-red-500/40 text-red-400 py-2.5 rounded-xl cursor-pointer transition-colors text-center block"
                      >
                        {activeLeague.creatorId === user.id
                          ? "DELETE LEAGUE"
                          : "LEAVE LEAGUE"}
                      </button>
                    ) : isJoiningActiveLeague ? (
                      <div className="space-y-2 w-full mt-2 border border-blue-500/30 rounded-xl p-3 bg-blue-950/10">
                        <input
                          type="password"
                          placeholder="Enter League Password"
                          value={activeLeagueJoinPassword}
                          onChange={(e) => setActiveLeagueJoinPassword(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => setIsJoiningActiveLeague(false)}
                            className="flex-1 text-xs font-mono font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-lg cursor-pointer transition-colors text-center"
                          >
                            CANCEL
                          </button>
                          <button
                            onClick={async () => {
                              if (activeLeagueJoinPassword === activeLeague.password) {
                                try {
                                  await dbJoinLeague(activeLeague.id, user.id);
                                  const dbUserLeagues = await dbFetchUserLeagues(user.id);
                                  setUserLeagues(dbUserLeagues);
                                  const members = await dbFetchLeagueMembers(activeLeague.id);
                                  setActiveLeagueMembers(members.map(m => m.id));
                                  setIsJoiningActiveLeague(false);
                                  setActiveLeagueJoinPassword("");
                                  triggerToast("🎉 Successfully joined the league!");
                                } catch (err) {
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
                    Behold the picks comparison index. Track real-time locks and
                    perfect scores across every participant:
                  </p>

                  {activeLeagueMatches.length === 0 ? (
                    <div className="text-center py-10 text-slate-500 font-sans text-xs">
                      No matches registered for {compName} right now. Select
                      leagues with scheduled match days.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {sortedActiveLeagueMatches.map((match, index) => {
                        const matchDate = new Date(match.matchDate);
                        const dateKey = matchDate.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                        const timeKey = matchDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                        const prevMatch = index > 0 ? sortedActiveLeagueMatches[index - 1] : null;
                        const prevDateKey = prevMatch ? new Date(prevMatch.matchDate).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : null;
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
                            <div
                              className="bg-slate-950/40 hover:bg-slate-950/60 border border-slate-850 hover:border-slate-800 p-4 rounded-2xl transition-all"
                            >
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
                                {match.status === "completed" ||
                                simulatedResults[match.id]?.played ? (
                                  <div className="space-y-0.5">
                                    <span className="text-[9px] text-slate-500 uppercase tracking-wider font-mono block">
                                      FINAL SCORE
                                    </span>
                                    <span className="font-extrabold text-sm text-yellow-500 font-serif">
                                      {match.status === "completed"
                                        ? match.homeScore
                                        : simulatedResults[match.id].home}{" "}
                                      -{" "}
                                      {match.status === "completed"
                                        ? match.awayScore
                                        : simulatedResults[match.id].away}
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
                                {leagueMembersMemoized.map((member) => {
                                  // Locate prediction
                                  const memberPred =
                                    member.predictions?.[match.id];
                                  const hasPred =
                                    memberPred && memberPred.submitted;
                                  const isMe = member.playerId === user.id;

                                  const actualHome =
                                    match.status === "completed"
                                      ? match.homeScore
                                      : simulatedResults[match.id]?.played
                                        ? simulatedResults[match.id].home
                                        : undefined;
                                  const actualAway =
                                    match.status === "completed"
                                      ? match.awayScore
                                      : simulatedResults[match.id]?.played
                                        ? simulatedResults[match.id].away
                                        : undefined;
                                  const actualTime = new Date(
                                    match.matchDate,
                                  ).getTime();
                                  const isKickedOff =
                                    match.status === "completed" ||
                                    match.status === "live" ||
                                    simulatedResults[match.id]?.played ||
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
                                          // If it is the current user OR match has kicked off, allow visibility to predicted scores
                                          isMe || isKickedOff ? (
                                            <span className="font-extrabold text-white bg-slate-950/70 border border-slate-800 px-2 py-0.5 rounded">
                                              {memberPred.home} -{" "}
                                              {memberPred.away}
                                            </span>
                                          ) : (
                                            // Future upcoming matches for other players only show metallic animated tick with lightning
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
            </motion.div>
          );
        })()
      ) : (
        <>
          {/* Personalized Welcome Jumbotron Header */}
          <motion.div
            transition={{ duration: 0.5, ease: "easeInOut" }}
            className={`grid grid-cols-1 gap-6 ${isUserInAnyLeague ? "md:grid-cols-3" : ""}`}
          >
            {/* Card 1: User welcome greeting & Game Record merged! */}
            <motion.div
              transition={{ duration: 0.5, ease: "easeInOut" }}
              className={`${isUserInAnyLeague ? "md:col-span-2" : ""} bg-slate-900/60 rounded-2xl border border-slate-800/70 p-6 flex flex-col justify-between relative overflow-hidden backdrop-blur-xs min-h-[180px]`}
            >
              <div className="absolute top-0 right-0 w-36 h-36 bg-blue-500/5 rounded-full blur-2xl" />
              <div className="absolute bottom-0 left-0 w-36 h-24 bg-green-500/5 rounded-full blur-2xl" />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/60">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-slate-500 text-xs font-mono">
                      Live Season 1
                    </span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold font-display text-white tracking-tight flex items-baseline">
                    <span className="mr-2">Hello,</span>
                    <span className="font-extrabold font-display text-2xl sm:text-3xl text-slate-300">
                      {user.nickname}
                    </span>
                  </h1>
                </div>

                {/* Micro Accuracies side-board */}
                <div className="flex flex-col gap-1.5 text-left sm:text-right text-[11px] text-slate-400 font-mono">
                  <div className="flex items-center justify-between sm:justify-end gap-3">
                    <span className="text-slate-500 font-sans">
                      Season's Accuracy ({currentCalendarYear}):
                    </span>
                    <span className="font-bold text-white font-mono bg-slate-950/60 px-1.5 py-0.5 rounded border border-slate-800/60">
                      {seasonalAccuracy}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-3">
                    <span className="text-slate-500 font-sans">
                      Lifetime Accuracy:
                    </span>
                    <span className="font-bold text-emerald-400 font-mono bg-slate-950/60 px-1.5 py-0.5 rounded border border-slate-800/60">
                      {lifetimeAccuracy}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Connected Game Record metrics row */}
              <div className="grid grid-cols-3 gap-3 pt-4 text-center">
                <div className="p-2.5 bg-slate-950/40 rounded-xl border border-slate-800/60 flex flex-col justify-center">
                  <span className="text-2xl font-black font-display text-emerald-400 text-transparent bg-clip-text bg-linear-to-r from-emerald-400 to-teal-400">
                    {userPoints}
                  </span>
                  <p className="text-[9px] text-slate-500 uppercase font-mono tracking-widest mt-0.5">
                    Total Points
                  </p>
                </div>
                <div className="p-2.5 bg-slate-950/40 rounded-xl border border-slate-800/60 flex flex-col justify-center">
                  <span className="text-2xl font-black font-display text-blue-400">
                    {totalPredicted}
                  </span>
                  <p className="text-[9px] text-slate-500 uppercase font-mono tracking-widest mt-0.5">
                    Guesses Lock
                  </p>
                </div>
                <div className="p-2.5 bg-slate-950/40 rounded-xl border border-slate-800/60 flex flex-col justify-center">
                  <span className="text-2xl font-black font-display text-yellow-400">
                    {perfectPredictions}
                  </span>
                  <p className="text-[9px] text-slate-500 uppercase font-mono tracking-widest mt-0.5">
                    Perfect Hits
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Card 2: Closed Private Leagues Console */}
            <motion.div
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
          </motion.div>

          {/* TWO LARGE TILE BUTTONS SECTION (Football & Rugby) */}
          {isUserInAnyLeague && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              {/* Football Sport Tile Card */}
              <div
                id="football-sport-tile"
                onClick={() => {
                  setSelectedSport(SportType.FOOTBALL);
                  const comps = getCompetitions().filter((c) => c.sport === SportType.FOOTBALL);
                  setSelectedCompId(comps.length > 0 ? comps[0].id : null);
                }}
                onMouseEnter={() => setFbHover(true)}
                onMouseLeave={() => setFbHover(false)}
                className={`relative rounded-3xl p-8 border-2 transition-all duration-300 overflow-hidden cursor-pointer flex flex-col justify-between group min-h-[220px] ${
                  selectedSport === SportType.FOOTBALL
                    ? "bg-blue-950/40 border-blue-500 shadow-[0_0_24px_rgba(59,130,246,0.35)]"
                    : "bg-slate-900/50 border-slate-800 hover:border-slate-700 hover:shadow-lg shadow-sm"
                }`}
              >
                {/* Background Ambient Glow */}
                <div
                  className={`absolute -right-12 -bottom-12 w-48 h-48 rounded-full blur-3xl opacity-20 transition-all ${
                    selectedSport === SportType.FOOTBALL
                      ? "bg-blue-500 opacity-30"
                      : "bg-slate-500 group-hover:bg-blue-500"
                  }`}
                />

                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <h2 className="text-3xl font-extrabold font-display text-white group-hover:text-blue-300 transition-colors">
                      FOOTBALL
                    </h2>
                    <p className="text-slate-400 text-xs max-w-xs pt-1 font-sans">
                      Predict goal lines across Premier League, Champions
                      League, Europa rosters and FIFA divisions.
                    </p>
                  </div>

                  {/* Silhouette outline of a Football */}
                  <div
                    className={`relative p-3.5 rounded-full transition-all duration-500 flex items-center justify-center ${fbHover ? "scale-105 bg-blue-950/15 text-blue-400" : "text-slate-400"}`}
                  >
                    {/* Slower, more professional motion transform on the icon itself */}
                    <motion.div
                      animate={
                        fbHover
                          ? { rotate: 25, scale: 1.08 }
                          : { rotate: 0, scale: 1 }
                      }
                      transition={{
                        type: "spring",
                        stiffness: 80,
                        damping: 15,
                      }}
                      className="w-14 h-14 relative flex items-center justify-center"
                    >
                      {/* Modern Classical design Soccer ball icon SVG */}
                      <svg
                        className="w-full h-full relative z-10"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <circle
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        />
                        {/* Central Pentagonal Panel */}
                        <polygon
                          points="12,7.5 15.2,9.8 14,13.6 10,13.6 8.8,9.8"
                          fill="currentColor"
                          fillOpacity="0.25"
                          stroke="currentColor"
                          strokeWidth="1.2"
                        />
                        {/* Outer Seam lines radiating from the pentagon vertices */}
                        <line
                          x1="12"
                          y1="7.5"
                          x2="12"
                          y2="2"
                          stroke="currentColor"
                          strokeWidth="1.2"
                        />
                        <line
                          x1="15.2"
                          y1="9.8"
                          x2="19.8"
                          y2="8.3"
                          stroke="currentColor"
                          strokeWidth="1.2"
                        />
                        <line
                          x1="14"
                          y1="13.6"
                          x2="17.8"
                          y2="18.6"
                          stroke="currentColor"
                          strokeWidth="1.2"
                        />
                        <line
                          x1="10"
                          y1="13.6"
                          x2="6.2"
                          y2="18.6"
                          stroke="currentColor"
                          strokeWidth="1.2"
                        />
                        <line
                          x1="8.8"
                          y1="9.8"
                          x2="4.2"
                          y2="8.3"
                          stroke="currentColor"
                          strokeWidth="1.2"
                        />
                        {/* 3D Curved peripheral accent lines */}
                        <path
                          d="M4.2 8.3 C6.5 5.5, 9.5 3.5, 12 2"
                          stroke="currentColor"
                          strokeWidth="0.8"
                          className="opacity-60"
                        />
                        <path
                          d="M19.8 8.3 C17.5 5.5, 14.5 3.5, 12 2"
                          stroke="currentColor"
                          strokeWidth="0.8"
                          className="opacity-60"
                        />
                        <path
                          d="M19.8 8.3 C20.8 11.5, 20.1 15.3, 17.8 18.6"
                          stroke="currentColor"
                          strokeWidth="0.8"
                          className="opacity-60"
                        />
                        <path
                          d="M4.2 8.3 C3.2 11.5, 3.9 15.3, 6.2 18.6"
                          stroke="currentColor"
                          strokeWidth="0.8"
                          className="opacity-60"
                        />
                        <path
                          d="M6.2 18.6 C9.5 19.8, 14.5 19.8, 17.8 18.6"
                          stroke="currentColor"
                          strokeWidth="0.8"
                          className="opacity-60"
                        />
                      </svg>

                      {/* Animated lightning flash circling the soccer ball itself */}
                      {fbHover && (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{
                            repeat: Infinity,
                            duration: 4,
                            ease: "linear",
                          }}
                          className="absolute inset-0 pointer-events-none z-20"
                        >
                          <svg
                            className="w-full h-full absolute inset-0"
                            viewBox="0 0 24 24"
                            fill="none"
                          >
                            <circle
                              cx="12"
                              cy="12"
                              r="10.8"
                              stroke="url(#fbLightningGrad)"
                              strokeWidth="1.5"
                              strokeDasharray="5, 12"
                              className="opacity-100"
                              style={{
                                filter:
                                  "drop-shadow(0 0 4px #3b82f6) drop-shadow(0 0 8px #60a5fa)",
                              }}
                            />
                            <defs>
                              <linearGradient
                                id="fbLightningGrad"
                                x1="0%"
                                y1="0%"
                                x2="100%"
                                y2="100%"
                              >
                                <stop offset="0%" stopColor="#3b82f6" />
                                <stop
                                  offset="50%"
                                  stopColor="#60a5fa"
                                  stopOpacity="0.8"
                                />
                                <stop offset="100%" stopColor="#3b82f6" />
                              </linearGradient>
                            </defs>
                          </svg>
                        </motion.div>
                      )}
                    </motion.div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 mt-6 font-mono text-xs text-blue-400 group-hover:translate-x-1 transition-transform">
                  <span>Choose Football leagues</span>{" "}
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>

              {/* Rugby Sport Tile Card */}
              <div
                id="rugby-sport-tile"
                onClick={() => {
                  setSelectedSport(SportType.RUGBY);
                  const comps = getCompetitions().filter((c) => c.sport === SportType.RUGBY);
                  setSelectedCompId(comps.length > 0 ? comps[0].id : null);
                }}
                onMouseEnter={() => setRbHover(true)}
                onMouseLeave={() => setRbHover(false)}
                className={`relative rounded-3xl p-8 border-2 transition-all duration-300 overflow-hidden cursor-pointer flex flex-col justify-between group min-h-[220px] ${
                  selectedSport === SportType.RUGBY
                    ? "bg-amber-950/40 border-amber-500 shadow-[0_0_24px_rgba(245,158,11,0.35)]"
                    : "bg-slate-900/50 border-slate-800 hover:border-slate-700 hover:shadow-lg shadow-sm"
                }`}
              >
                {/* Background Ambient Glow */}
                <div
                  className={`absolute -right-12 -bottom-12 w-48 h-48 rounded-full blur-3xl opacity-20 transition-all ${
                    selectedSport === SportType.RUGBY
                      ? "bg-amber-500 opacity-30"
                      : "bg-slate-500 group-hover:bg-amber-500"
                  }`}
                />

                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <h2 className="text-3xl font-extrabold font-display text-white group-hover:text-amber-300 transition-colors">
                      RUGBY
                    </h2>
                    <p className="text-slate-400 text-xs max-w-xs pt-1 font-sans">
                      Predict winning score margins across Six Nations,
                      Heineken, Top 14, and Rugby Worlds brackets.
                    </p>
                  </div>

                  {/* Silhouette outline of a Rugby Ball */}
                  <div
                    className={`relative p-3.5 rounded-full transition-all duration-500 flex items-center justify-center ${rbHover ? "scale-105 bg-amber-950/15 text-amber-400" : "text-slate-400"}`}
                  >
                    {/* Slower, more professional motion transform on the icon itself */}
                    <motion.div
                      animate={
                        rbHover
                          ? { rotate: -15, scale: 1.08 }
                          : { rotate: 0, scale: 1 }
                      }
                      transition={{
                        type: "spring",
                        stiffness: 80,
                        damping: 15,
                      }}
                      className="w-14 h-14 relative flex items-center justify-center"
                    >
                      {/* High-fidelity custom stitch Rugby Oval ball SVG */}
                      <svg
                        className="w-full h-full relative z-10"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <g transform="rotate(-30 12 12)">
                          <path
                            d="M12 2 C5.5 2, 2 7.5, 2 12 C2 16.5, 5.5 22, 12 22 C18.5 22, 22 16.5, 22 12 C22 7.5, 18.5 2, 12 2 Z"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            fill="currentColor"
                            fillOpacity="0.12"
                          />
                          <path
                            d="M12 2 C8 6, 8 18, 12 22"
                            stroke="currentColor"
                            strokeWidth="1"
                            className="opacity-80"
                          />
                          <path
                            d="M12 2 C16 6, 16 18, 12 22"
                            stroke="currentColor"
                            strokeWidth="1"
                            className="opacity-80"
                          />

                          {/* Centered Laces / Seam Stitching */}
                          <line
                            x1="12"
                            y1="5.5"
                            x2="12"
                            y2="18.5"
                            stroke="currentColor"
                            strokeWidth="1.5"
                          />
                          <line
                            x1="9.5"
                            y1="8"
                            x2="14.5"
                            y2="8"
                            stroke="currentColor"
                            strokeWidth="1.3"
                          />
                          <line
                            x1="9"
                            y1="10.5"
                            x2="15"
                            y2="10.5"
                            stroke="currentColor"
                            strokeWidth="1.3"
                          />
                          <line
                            x1="9"
                            y1="13"
                            x2="15"
                            y2="13"
                            stroke="currentColor"
                            strokeWidth="1.3"
                          />
                          <line
                            x1="9.5"
                            y1="15.5"
                            x2="14.5"
                            y2="15.5"
                            stroke="currentColor"
                            strokeWidth="1.3"
                          />
                        </g>
                      </svg>

                      {/* Animated lightning flash circling the rugby ball itself */}
                      {rbHover && (
                        <motion.div
                          animate={{ rotate: -360 }}
                          transition={{
                            repeat: Infinity,
                            duration: 4,
                            ease: "linear",
                          }}
                          className="absolute inset-0 pointer-events-none z-20"
                        >
                          <svg
                            className="w-full h-full absolute inset-0"
                            viewBox="0 0 24 24"
                            fill="none"
                          >
                            <circle
                              cx="12"
                              cy="12"
                              r="10.8"
                              stroke="url(#rbLightningGrad)"
                              strokeWidth="1.5"
                              strokeDasharray="5, 12"
                              className="opacity-100"
                              style={{
                                filter:
                                  "drop-shadow(0 0 4px #f59e0b) drop-shadow(0 0 8px #fbbf24)",
                              }}
                            />
                            <defs>
                              <linearGradient
                                id="rbLightningGrad"
                                x1="0%"
                                y1="0%"
                                x2="100%"
                                y2="100%"
                              >
                                <stop offset="0%" stopColor="#f59e0b" />
                                <stop
                                  offset="50%"
                                  stopColor="#fbbf24"
                                  stopOpacity="0.8"
                                />
                                <stop offset="100%" stopColor="#f59e0b" />
                              </linearGradient>
                            </defs>
                          </svg>
                        </motion.div>
                      )}
                    </motion.div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 mt-6 font-mono text-xs text-amber-400 group-hover:translate-x-1 transition-transform">
                  <span>Choose Rugby leagues</span>{" "}
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          )}

          {/* DETAILED DRILL-DOWN SUB VIEW */}
          {selectedSport && isUserInAnyLeague && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-900/60 rounded-3xl border border-slate-800 p-6 shadow-xl"
            >
              {/* Leagues filtering tab */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5 mb-5">
                <div>
                  <span className="text-[10px] uppercase font-bold font-mono tracking-widest text-emerald-400">
                    Live Division Filters
                  </span>
                  <h3 className="text-xl font-bold font-display text-white mt-0.5">
                    {selectedSport === SportType.FOOTBALL
                      ? "Football Leagues"
                      : "Rugby Leagues"}{" "}
                    Included
                  </h3>
                </div>

                {/* Quick stats segment */}
                <div className="text-xs text-slate-400 flex items-center gap-2">
                  <span>Selected Competitions:</span>
                  <span
                    className={`px-2 py-0.5 rounded-sm font-mono text-xs font-semibold ${
                      selectedSport === SportType.FOOTBALL
                        ? "bg-blue-500/10 text-blue-300"
                        : "bg-amber-500/10 text-amber-300"
                    }`}
                  >
                    {filteredCompetitions.length}
                  </span>
                </div>
              </div>

              {/* Grid list of leagues targeting future wrapping layout */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {filteredCompetitions.map((comp) => {
                  const count = allMatches.filter(
                    (m) => m.competitionId === comp.id,
                  ).length;
                  const isSelected = selectedCompId === comp.id;

                  return (
                    <button
                      id={`comp-btn-${comp.id}`}
                      key={comp.id}
                      onClick={() => setSelectedCompId(comp.id)}
                      className={`w-full text-left p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? "bg-slate-950 border-emerald-500 text-white shadow-md"
                          : "bg-slate-950/40 border-slate-800/50 hover:border-slate-700 hover:bg-slate-950/80 text-slate-300"
                      }`}
                    >
                      <div>
                        <h4 className="text-xs font-semibold font-display tracking-tight text-white">
                          {comp.name}
                        </h4>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {comp.nationality || "International"}
                        </span>
                      </div>

                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded-sm ${
                          count > 0
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-slate-800 text-slate-500"
                        }`}
                      >
                        {count > 0 ? `${count} Fixture` : "Scheduled"}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* FIREFIGHTING NO MATCH MESSAGE */}
              {!selectedCompId && (
                <div className="text-center py-10 text-slate-500 font-sans text-xs">
                  👈 Select one of the competitions above to load action items
                  and configure score predictions.
                </div>
              )}

              {/* SPECIFIC COMPETITION FIXTURES PREDICTOR */}
              {selectedCompId && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-6 pt-5 border-t border-slate-800 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-950/40 p-4 rounded-xl border border-slate-800">
                    <div>
                      <h4 className="text-sm font-bold font-display text-white">
                        {selectedCompetition?.name} Match Day Predicter
                      </h4>
                      <p className="text-xs text-slate-400">
                        Input your guessed scores below. Press SUBMIT to
                        register, then trigger SIMULATE to verify points.
                      </p>
                    </div>

                    <button
                      id="reset-simulation-btn"
                      onClick={resetAllSimulations}
                      className="text-[10px] font-mono border border-slate-800 hover:border-slate-700 px-3 py-1.5 rounded-md hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-slate-400" /> Reset
                      State
                    </button>
                  </div>

                  {activeMatches.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-500 font-sans">
                      No matches loaded for this collection. Expand matches by
                      editing fixtures draft lists.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {sortedActiveMatches.map((match, index) => {
                        const matchDate = new Date(match.matchDate);
                        const dateKey = matchDate.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                        const timeKey = matchDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                        const prevMatch = index > 0 ? sortedActiveMatches[index - 1] : null;
                        const prevDateKey = prevMatch ? new Date(prevMatch.matchDate).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : null;
                        const showDateSeparator = dateKey !== prevDateKey;

                        const savedPred = predictions[match.id] || {
                          home: 0,
                          away: 0,
                          submitted: false,
                        };
                        const isSubmitted = savedPred.submitted;
                        const isMatchStarted =
                          new Date() > new Date(match.matchDate);
                        const isLocked = isSubmitted || isMatchStarted;
                        const simResult = simulatedResults[match.id];

                        return (
                          <React.Fragment key={match.id}>
                            {showDateSeparator && (
                              <div className="text-center pt-4 pb-2">
                                <span className="inline-block text-slate-300 text-xs font-semibold px-4 py-1.5 uppercase tracking-widest font-mono">
                                  {dateKey}
                                </span>
                              </div>
                            )}
                            <div
                              className={`relative p-5 rounded-2xl border transition-all ${
                                simResult?.played
                                  ? "bg-slate-950/80 border-slate-800 shadow-xs"
                                  : isLocked
                                    ? "bg-slate-900 border-blue-900/30"
                                    : "bg-slate-900/40 border-slate-800/40"
                              }`}
                            >
                              {/* Top Row: Date, Time, Action Button */}
                              <div className="flex justify-between items-center mb-6">
                                <div className="flex-1 hidden md:block"></div> {/* Left spacer for center alignment */}
                                
                                <div className="flex-1 flex flex-col items-center justify-center text-center">
                                  <span className="inline-block bg-slate-900 border border-slate-700 text-slate-400 text-[10px] font-mono px-3 py-0.5 rounded-full">
                                    {timeKey}
                                  </span>
                                </div>
                                
                                <div className="flex-1 flex justify-end">
                                  <div className="w-full sm:w-auto flex flex-col sm:flex-row items-center gap-2.5">
                                    {!authStatus.isVerified ? (
                                      <div
                                        className="w-full sm:w-auto bg-slate-800 text-slate-500 font-bold font-display uppercase text-xs px-5 py-3 rounded-xl flex items-center justify-center gap-1 shadow-md opacity-50 cursor-not-allowed"
                                        title="Please verify your email to submit predictions."
                                      >
                                        <ShieldAlert className="w-3.5 h-3.5" /> VERIFY EMAIL TO PLAY
                                      </div>
                                    ) : !isLocked ? (
                                      <button
                                        id={`submit-pred-btn-${match.id}`}
                                        onClick={() => submitPrediction(match.id)}
                                        className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold font-display uppercase text-xs px-5 py-3 rounded-xl cursor-pointer transition-transform duration-100 flex items-center justify-center gap-1 shadow-md shadow-emerald-500/10"
                                      >
                                        Lock Guess{" "}
                                        <Zap className="w-3.5 h-3.5 stroke-2" />
                                      </button>
                                    ) : !simResult?.played ? (
                                      <button
                                        id={`sim-match-btn-${match.id}`}
                                        onClick={() => simulateMatchPlay(match)}
                                        disabled={simulationActive}
                                        className="w-full sm:w-auto bg-blue-500 hover:bg-blue-600 border border-blue-400/30 text-white font-bold font-display uppercase text-xs px-5 py-3 rounded-xl cursor-pointer flex items-center justify-center gap-1.5 transition-all"
                                      >
                                        <Play className="w-3.5 h-3.5" />{" "}
                                        {simulationActive
                                          ? "Playing..."
                                          : "Simulate Match"}
                                      </button>
                                    ) : (
                                      <div className="w-full sm:w-auto p-2 bg-slate-950 rounded-xl border border-slate-800 flex items-center gap-3 text-xs">
                                        <div>
                                          <span className="text-[9px] text-slate-500 block uppercase tracking-wider font-mono">
                                            Actual Result
                                          </span>
                                          <span className="font-serif font-black text-amber-500">
                                            {match.homeTeam} {simResult.home} -{" "}
                                            {simResult.away} {match.awayTeam}
                                          </span>
                                        </div>
                                        <div className="border-l border-slate-800 pl-3">
                                          <span className="text-[9px] text-slate-500 block uppercase tracking-wider font-mono">
                                            Score Earned
                                          </span>
                                          <span className="font-mono font-extrabold text-emerald-400">
                                            +{simResult.pointsWon} Pts
                                          </span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex flex-col md:flex-row items-center justify-center gap-6">
                              {/* Teams Scoring UI Rows */}
                              {match.sport === "football" ? (
                                <div className="w-full flex items-center justify-center gap-2 max-w-xl mx-auto">
                                  {/* Home Team */}
                                  <div className="flex-1 text-right">
                                    <h5 className="font-extrabold font-display text-sm tracking-tight text-white mb-0.5">
                                      {match.homeTeam}
                                    </h5>
                                  </div>

                                  {/* Central Inputs and VS */}
                                  <div className="flex flex-none items-center gap-2 px-1">
                                    {/* Home Input Interactors */}
                                    <div className="flex items-center justify-center gap-1 bg-slate-950 px-1.5 py-1 rounded-xl border border-slate-800 focus-within:border-emerald-500/50 transition-all">
                                      <button
                                        type="button"
                                        disabled={isLocked}
                                        onClick={() => {
                                          const val = Math.max(
                                            0,
                                            (savedPred.home || 0) - 1,
                                          );
                                          handleScoreChange(
                                            match.id,
                                            "home",
                                            val.toString(),
                                          );
                                        }}
                                        className="relative p-1 rounded-sm bg-slate-900 border border-slate-800 text-slate-400 hover:text-white disabled:opacity-50 transition-all flex items-center justify-center cursor-pointer overflow-hidden group select-none"
                                      >
                                        <div className="absolute inset-[-100%] z-0 group-hover:animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#00000000_50%,#10b981_100%)] opacity-0 group-hover:opacity-100" />
                                        <div className="absolute inset-[1px] bg-slate-900 rounded-sm z-0" />
                                        <Minus className="w-2.5 h-2.5 relative z-10" />
                                      </button>

                                      <input
                                        id={`pred-home-val-${match.id}`}
                                        type="number"
                                        min={0}
                                        max={99}
                                        disabled={isLocked}
                                        value={savedPred.home}
                                        onChange={(e) =>
                                          handleScoreChange(
                                            match.id,
                                            "home",
                                            e.target.value,
                                          )
                                        }
                                        className="w-8 text-center bg-transparent border-0 font-display font-black text-white text-base focus:ring-0 outline-hidden pointer-events-auto p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                      />

                                      <button
                                        type="button"
                                        disabled={isLocked}
                                        onClick={() => {
                                          const val = (savedPred.home || 0) + 1;
                                          handleScoreChange(
                                            match.id,
                                            "home",
                                            val.toString(),
                                          );
                                        }}
                                        className="relative p-1 rounded-sm bg-slate-900 border border-slate-800 text-slate-400 hover:text-emerald-400 disabled:opacity-50 transition-all flex items-center justify-center cursor-pointer overflow-hidden group select-none"
                                      >
                                        <div className="absolute inset-[-100%] z-0 group-hover:animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#00000000_50%,#10b981_100%)] opacity-0 group-hover:opacity-100" />
                                        <div className="absolute inset-[1px] bg-slate-900 rounded-sm z-0" />
                                        <Plus className="w-2.5 h-2.5 relative z-10" />
                                      </button>
                                    </div>

                                    {/* Versus divider */}
                                    <div className="text-center font-mono font-bold text-slate-600 text-[10px] uppercase tracking-widest">
                                      vs
                                    </div>

                                    {/* Away Input Interactors */}
                                    <div className="flex items-center justify-center gap-1 bg-slate-950 px-1.5 py-1 rounded-xl border border-slate-800 focus-within:border-emerald-500/50 transition-all">
                                      <button
                                        type="button"
                                        disabled={isLocked}
                                        onClick={() => {
                                          const val = Math.max(
                                            0,
                                            (savedPred.away || 0) - 1,
                                          );
                                          handleScoreChange(
                                            match.id,
                                            "away",
                                            val.toString(),
                                          );
                                        }}
                                        className="relative p-1 rounded-sm bg-slate-900 border border-slate-800 text-slate-400 hover:text-white disabled:opacity-50 transition-all flex items-center justify-center cursor-pointer overflow-hidden group select-none"
                                      >
                                        <div className="absolute inset-[-100%] z-0 group-hover:animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#00000000_50%,#10b981_100%)] opacity-0 group-hover:opacity-100" />
                                        <div className="absolute inset-[1px] bg-slate-900 rounded-sm z-0" />
                                        <Minus className="w-2.5 h-2.5 relative z-10" />
                                      </button>

                                      <input
                                        id={`pred-away-val-${match.id}`}
                                        type="number"
                                        min={0}
                                        max={99}
                                        disabled={isLocked}
                                        value={savedPred.away}
                                        onChange={(e) =>
                                          handleScoreChange(
                                            match.id,
                                            "away",
                                            e.target.value,
                                          )
                                        }
                                        className="w-8 text-center bg-transparent border-0 font-display font-black text-white text-base focus:ring-0 outline-hidden pointer-events-auto p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                      />

                                      <button
                                        type="button"
                                        disabled={isLocked}
                                        onClick={() => {
                                          const val = (savedPred.away || 0) + 1;
                                          handleScoreChange(
                                            match.id,
                                            "away",
                                            val.toString(),
                                          );
                                        }}
                                        className="relative p-1 rounded-sm bg-slate-900 border border-slate-800 text-slate-400 hover:text-emerald-400 disabled:opacity-50 transition-all flex items-center justify-center cursor-pointer overflow-hidden group select-none"
                                      >
                                        <div className="absolute inset-[-100%] z-0 group-hover:animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#00000000_50%,#10b981_100%)] opacity-0 group-hover:opacity-100" />
                                        <div className="absolute inset-[1px] bg-slate-900 rounded-sm z-0" />
                                        <Plus className="w-2.5 h-2.5 relative z-10" />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Away Team */}
                                  <div className="flex-1 text-left">
                                    <h5 className="font-extrabold font-display text-sm tracking-tight text-white mb-0.5">
                                      {match.awayTeam}
                                    </h5>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex-1 w-full flex flex-col items-center gap-3 bg-slate-950/40 p-4 border border-slate-850/60 rounded-2xl relative">
                                  {/* Winner Selection Segment */}
                                  <div className="w-full grid grid-cols-3 gap-2">
                                    <button
                                      type="button"
                                      disabled={isLocked}
                                      onClick={() => {
                                        const currentMargin =
                                          Math.abs(
                                            (savedPred.home || 0) -
                                              (savedPred.away || 0),
                                          ) || 1;
                                        handleRugbyPredictionChange(
                                          match.id,
                                          "home",
                                          currentMargin.toString(),
                                        );
                                      }}
                                      className={`px-2 py-2 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center transition-all cursor-pointer select-none ${
                                        (savedPred.home || 0) >
                                        (savedPred.away || 0)
                                          ? "bg-emerald-550/10 border-emerald-500/40 text-emerald-300"
                                          : "bg-slate-950/20 border-slate-850 text-slate-500 hover:bg-slate-900/50 hover:text-slate-350"
                                      }`}
                                    >
                                      <span className="text-[8px] font-mono text-slate-500 uppercase font-bold mb-0.5">
                                        Home Win
                                      </span>
                                      <span className="font-display font-black text-center truncate w-full">
                                        {match.homeTeam}
                                      </span>
                                    </button>

                                    <button
                                      type="button"
                                      disabled={isLocked}
                                      onClick={() => {
                                        handleRugbyPredictionChange(
                                          match.id,
                                          "draw",
                                          "0",
                                        );
                                      }}
                                      className={`px-2 py-2 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center transition-all cursor-pointer select-none ${
                                        (savedPred.home || 0) ===
                                        (savedPred.away || 0)
                                          ? "bg-emerald-550/10 border-emerald-500/40 text-emerald-300"
                                          : "bg-slate-950/20 border-slate-850 text-slate-500 hover:bg-slate-900/50 hover:text-slate-350"
                                      }`}
                                    >
                                      <span className="text-[8px] font-mono text-slate-500 uppercase font-bold mb-0.5">
                                        Draw
                                      </span>
                                      <span className="font-display font-black text-center truncate w-full">
                                        Equal Points
                                      </span>
                                    </button>

                                    <button
                                      type="button"
                                      disabled={isLocked}
                                      onClick={() => {
                                        const currentMargin =
                                          Math.abs(
                                            (savedPred.home || 0) -
                                              (savedPred.away || 0),
                                          ) || 1;
                                        handleRugbyPredictionChange(
                                          match.id,
                                          "away",
                                          currentMargin.toString(),
                                        );
                                      }}
                                      className={`px-2 py-2 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center transition-all cursor-pointer select-none ${
                                        (savedPred.away || 0) >
                                        (savedPred.home || 0)
                                          ? "bg-emerald-555/10 border-emerald-500/40 text-emerald-300"
                                          : "bg-slate-950/20 border-slate-850 text-slate-500 hover:bg-slate-900/50 hover:text-slate-350"
                                      }`}
                                    >
                                      <span className="text-[8px] font-mono text-slate-500 uppercase font-bold mb-0.5">
                                        Away Win
                                      </span>
                                      <span className="font-display font-black text-center truncate w-full">
                                        {match.awayTeam}
                                      </span>
                                    </button>
                                  </div>

                                  {/* Margin Dropdown / Text Representation */}
                                  {(savedPred.home || 0) !== (savedPred.away || 0) ? (
                                    isSubmitted ? (
                                      <div className="flex flex-col items-center text-center mt-2 w-full bg-slate-900/50 py-3 px-4 rounded-xl border border-emerald-500/20">
                                        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400 mb-1 select-none">
                                          Your Prediction
                                        </span>
                                        <span className="font-display font-black text-emerald-400 text-sm">
                                          {(savedPred.home || 0) > (savedPred.away || 0) ? match.homeTeam : match.awayTeam} by {Math.abs((savedPred.home || 0) - (savedPred.away || 0))} {(Math.abs((savedPred.home || 0) - (savedPred.away || 0)) === 1 ? 'Point' : 'Points')}
                                        </span>
                                      </div>
                                    ) : (
                                      <div className="flex flex-col items-center text-center mt-2 w-full">
                                        <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-emerald-405 mb-1.5 select-none">
                                          Winning Margin (Points)
                                        </span>
                                        <select
                                          disabled={isLocked}
                                          value={Math.abs(
                                            (savedPred.home || 0) -
                                              (savedPred.away || 0),
                                          ).toString()}
                                          onChange={(e) => {
                                            const currentWinner =
                                              (savedPred.home || 0) >
                                              (savedPred.away || 0)
                                                ? "home"
                                                : "away";
                                            handleRugbyPredictionChange(
                                              match.id,
                                              currentWinner,
                                              e.target.value,
                                            );
                                          }}
                                          className="w-full max-w-[200px] text-center bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl py-2 px-3 font-display font-bold text-white text-sm outline-hidden"
                                        >
                                          {Array.from(
                                            { length: 100 },
                                            (_, i) => i + 1,
                                          ).map((num) => (
                                            <option key={num} value={num}>
                                              {num}{" "}
                                              {num === 1 ? "Point" : "Points"}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                    )
                                  ) : (
                                    isSubmitted && (
                                      <div className="flex flex-col items-center text-center mt-2 w-full bg-slate-900/50 py-3 px-4 rounded-xl border border-emerald-500/20">
                                        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400 mb-1 select-none">
                                          Your Prediction
                                        </span>
                                        <span className="font-display font-black text-emerald-400 text-sm">
                                          Draw (Equal Points)
                                        </span>
                                      </div>
                                    )
                                  )}
                                </div>
                              )}
                            </div>
                            </div>
                          </React.Fragment>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              )}
            </motion.div>
          )}

          {/* PERSISTENT LEADERBOARD SECTION FOR USER COMPETITION */}
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
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${globalLeaderboardSport === SportType.FOOTBALL ? "bg-slate-800 text-white shadow-sm" : "text-slate-500 hover:text-slate-300 hover:bg-slate-900/50"}`}
                >
                  <span className="text-sm">⚽</span> Football
                </button>
                <button
                  onClick={() => setGlobalLeaderboardSport(SportType.RUGBY)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${globalLeaderboardSport === SportType.RUGBY ? "bg-slate-800 text-white shadow-sm" : "text-slate-500 hover:text-slate-300 hover:bg-slate-900/50"}`}
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
                    <th className="py-2.5 px-3 text-center">
                      Prediction Accuracy
                    </th>
                    <th className="py-2.5 px-3 text-right">Overall Points</th>
                  </tr>
                </thead>
                <tbody>
                  {displayLeaderboard.map((item) => {
                    const isYou =
                      item.isCurrentUser || item.playerId === user.id;
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
                            <span className="font-mono text-slate-400">
                              #{item.rank}
                            </span>
                          )}
                        </td>
                        <td
                          className={`py-3 px-3 font-semibold flex items-center gap-1.5 ${isYou ? "text-white" : "text-slate-200"}`}
                        >
                          <button
                            onClick={() => {
                              if (item.isProfilePublic) {
                                setViewingProfile(item);
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
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-slate-300">
                          {item.displayPredictions}
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-slate-300">
                          {item.displayAccuracy}
                        </td>
                        <td
                          className={`py-3 px-3 text-right font-display font-semibold text-sm ${isYou ? "text-emerald-400" : "text-slate-300"}`}
                        >
                          {item.displayPoints}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Leave League Confirmation Popup */}
      <AnimatePresence>
        {leagueToLeave && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4"
            >
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center mx-auto text-red-500 text-xl font-bold">
                  ⚠️
                </div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                  Confirm Leave
                </h3>
                <p className="text-xs text-slate-400">
                  Are you sure you want to leave this league? Your active
                  standing will be removed, but your administrative historical
                  statistics will be safely archived.
                </p>
              </div>
              <div className="flex gap-2 font-mono text-xs">
                <button
                  onClick={() => setLeagueToLeave(null)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-lg cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const id = leagueToLeave;
                    setLeagueToLeave(null);
                    handleLeaveLeague(id);
                  }}
                  className="flex-1 bg-red-600 hover:bg-red-750 text-white font-bold py-2 rounded-lg cursor-pointer transition-all shadow-md shadow-red-950/40"
                >
                  Yes, Leave
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* View Player Profile Popup */}
      <AnimatePresence>
        {viewingProfile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4"
            >
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <h3 className="text-xl font-display font-bold text-white flex items-center gap-2">
                    {viewingProfile.nickname}
                    <span
                      className="text-lg shrink-0 font-sans"
                      title={viewingProfile.nationality || "United Kingdom"}
                    >
                      {getCountryFlag(viewingProfile.nationality)}
                    </span>
                  </h3>
                  <span className="text-[10px] font-mono uppercase text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">
                    PitchSide Player
                  </span>
                </div>
                <button
                  onClick={() => setViewingProfile(null)}
                  className="text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/60">
                  <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider block mb-1">
                    Overall Rank
                  </span>
                  <div className="text-2xl font-display font-bold text-white">
                    #{viewingProfile.rank}
                  </div>
                </div>
                <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/60">
                  <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider block mb-1">
                    Total Points
                  </span>
                  <div className="text-2xl font-display font-bold text-emerald-400">
                    {viewingProfile.points}
                  </div>
                </div>
                <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/60">
                  <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider block mb-1">
                    Guesses Made
                  </span>
                  <div className="text-xl font-display font-bold text-slate-200">
                    {viewingProfile.predictionsMade}
                  </div>
                </div>
                <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/60">
                  <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider block mb-1">
                    Prediction Accuracy
                  </span>
                  <div className="text-xl font-display font-bold text-slate-200">
                    {viewingProfile.accuracy}
                  </div>
                </div>
              </div>

              <div className="pt-2 text-center">
                <button
                  onClick={() => setViewingProfile(null)}
                  className="w-full font-mono text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors py-2.5 rounded-lg cursor-pointer"
                >
                  Close Profile
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-950/90 backdrop-blur-lg border-t border-slate-800 z-40 flex items-center justify-around px-2 py-3 safe-area-pb">
        <button
          onClick={onOpenAccount}
          className="flex flex-col items-center gap-1 p-2 text-slate-400 hover:text-white transition-colors relative"
        >
          <UserCheck className="w-5 h-5 text-emerald-450" />
          <span className="text-[10px] font-medium">Account</span>
          {unreadMessagesCount > 0 && (
            <span className="absolute top-1 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
          )}
        </button>

        <button
          onClick={onOpenRules}
          className="flex flex-col items-center gap-1 p-2 text-slate-400 hover:text-white transition-colors"
        >
          <HelpCircle className="w-5 h-5 text-blue-400" />
          <span className="text-[10px] font-medium">Rules</span>
        </button>

        {user.isAdmin && (
          <button
            onClick={onOpenAdmin}
            className="flex flex-col items-center gap-1 p-2 text-purple-400 hover:text-purple-300 transition-colors"
          >
            <Lock className="w-5 h-5" />
            <span className="text-[10px] font-medium">Admin</span>
          </button>
        )}

        <button
          onClick={onLogout}
          className="flex flex-col items-center gap-1 p-2 text-slate-400 hover:text-red-400 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-[10px] font-medium">Logout</span>
        </button>
      </div>
    </div>
  );
}
