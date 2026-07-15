/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStatus } from '../hooks/useAuthStatus';
import { useSupabaseRealtime } from '../hooks/useSupabaseRealtime';
import {
  useMatchesQuery,
  usePredictionsQuery,
  useLeaguesQuery,
  useUserLeaguesQuery,
  useLeagueMembersQuery,
  useLeaguesMembershipQuery,
  useLeaderboardQuery,
  mapLeaderboardForSport,
  mergeMatches,
} from '../hooks/usePitchsideQueries';
import { queryKeys } from '../lib/queryKeys';
import {
  Trophy,
  History,
  TrendingUp,
  Settings,
  HelpCircle,
  LogOut,
  Sparkles,
  Check,
  Lock,
  Mail,
  UserCheck,
  X,
} from "lucide-react";
import {
  dbSavePrediction,
  dbCreateLeague,
  dbJoinLeague,
  dbLeaveLeague,
  dbUpdateLeagueSettings,
  dbFetchLeagueMembers,
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
import GlobalNavigation from './Dashboard/GlobalNavigation';
import WelcomeHeader from './Dashboard/WelcomeHeader';
import LeaderboardTable from './Dashboard/LeaderboardTable';
import type { LeaderboardItem, LeaderboardScope } from './Dashboard/Leaderboard';
import LeagueHub from './Dashboard/LeagueHub';
import LeagueManagementPanel from './Dashboard/LeagueManagementPanel';
import MobileNavigation from './Dashboard/MobileNavigation';
import MatchPredictor from './Dashboard/MatchPredictor';
import { getCountryFlag } from './Dashboard/shared';
import OnboardingTour, { type TourStep } from './OnboardingTour';
import CommunityShieldEvent, {
  isCommunityShieldOpen,
  isCommunityShieldScheduled,
} from './events/CommunityShieldEvent';
import { RadialOrigin, radialClip } from '../radial';

const ONBOARDING_STORAGE_KEY = "hasCompletedOnboarding";
const onboardingKeyFor = (userId?: string) =>
  userId ? `${ONBOARDING_STORAGE_KEY}_${userId}` : ONBOARDING_STORAGE_KEY;

const ONBOARDING_STEPS: TourStep[] = [
  {
    targetId: "tour-match-predictor",
    title: "Predict The Action",
    description:
      "Pick a sport from these tiles to open the Match Predictor. Choose a competition, enter your scoreline for each fixture and lock it in before kick-off to earn points.",
  },
  {
    targetId: "tour-league-manager",
    title: "Leagues Are Your Home Base",
    description:
      "Use the Leagues button in the top navigation to create a private league or join one with a code and password. You need to be in at least one league before the Match Predictor unlocks.",
  },
  {
    targetId: "tour-nav-buttons",
    title: "Rules & Your Account",
    description:
      "Open the Rules Guide any time to see exactly how scoring works, and use Account to manage your profile, leagues and messages.",
  },
];

interface DashboardProps {
  user: UserProfile;
  onLogout: () => void;
  onOpenRules: (origin?: RadialOrigin) => void;
  registeredUsers: UserProfile[];
  onOpenAdmin: () => void;
  onOpenAccount: (origin?: RadialOrigin) => void;
  externalSelectedLeagueId?: string | null;
  onClearExternalLeagueSelection?: () => void;
  /** One-shot toast shown when the dashboard first mounts (e.g. post-verification welcome). */
  initialToast?: string | null;
}

export default function Dashboard({
  user,
  onLogout,
  onOpenRules,
  registeredUsers,
  onOpenAdmin,
  onOpenAccount,
  externalSelectedLeagueId,
  onClearExternalLeagueSelection,
  initialToast,
}: DashboardProps) {
  const authStatus = useAuthStatus();
  const queryClient = useQueryClient();
  useSupabaseRealtime(user?.id);

  const isSandbox =
    !user || !user.id || user.id.startsWith("usr_") || user.id === "user-admin";
  const [selectedSport, setSelectedSport] = useState<SportType | null>(user?.preferredSport ?? null);
  // Default the consolidated leaderboard to the user's preferred sport so the
  // first thing they see is relevant to them.
  const [globalLeaderboardSport, setGlobalLeaderboardSport] = useState<SportType>(
    user?.preferredSport ?? SportType.FOOTBALL,
  );
  const [selectedCompId, setSelectedCompId] = useState<string | null>(null);
  const [showLeagues, setShowLeagues] = useState(false);
  const [leaguesOrigin, setLeaguesOrigin] = useState<RadialOrigin | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showShieldEvent, setShowShieldEvent] = useState(false);

  const dismissShieldEvent = () => {
    if (user?.id) {
      localStorage.setItem(`community_shield_dismissed_${user.id}`, "true");
    }
    setShowShieldEvent(false);
  };

  // Show the intro walkthrough the first time each user lands on the site.
  useEffect(() => {
    if (!localStorage.getItem(onboardingKeyFor(user?.id))) {
      setShowOnboarding(true);
    }
  }, [user?.id]);

  const completeOnboarding = () => {
    localStorage.setItem(onboardingKeyFor(user?.id), "true");
    setShowOnboarding(false);
  };

  const openLeaguesModal = (origin?: RadialOrigin) => {
    setLeaguesOrigin(origin ?? null);
    setActiveLeagueId(null);
    setLeagueTab("view");
    setShowLeagues(true);
  };

  const [localMatches, setLocalMatches] = useState<Match[]>(() => {
    const saved = localStorage.getItem("added_fixtures");
    return saved ? JSON.parse(saved) : [];
  });

  const { data: dbMatches = [] } = useMatchesQuery();
  const { data: remotePredictions } = usePredictionsQuery(user?.id);
  const { data: leagues = [] } = useLeaguesQuery();
  const { data: userLeagues = [] } = useUserLeaguesQuery(user?.id);

  const allMatches = useMemo(
    () => mergeMatches(dbMatches, localMatches),
    [dbMatches, localMatches],
  );

  // The Golden Ticket / Community Shield promo only makes sense when an actual
  // Community Shield fixture is scheduled. Drives both the promo pop-up here and
  // the Golden Ticket section in the Rules guide.
  const communityShieldScheduled = useMemo(
    () => isCommunityShieldScheduled(allMatches),
    [allMatches],
  );

  useEffect(() => {
    if (!user?.id) return;
    const dismissed = localStorage.getItem(`community_shield_dismissed_${user.id}`);
    if (!dismissed && communityShieldScheduled && isCommunityShieldOpen()) {
      setShowShieldEvent(true);
    }
  }, [user?.id, communityShieldScheduled]);

  const { data: leaderboardList = [] } = useLeaderboardQuery(user?.id, allMatches);

  const [predictions, setPredictions] = useState<
    Record<string, { home: number; away: number; submitted: boolean }>
  >(() => {
    const saved = localStorage.getItem(`predictions_${user?.id || "guest"}`);
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    if (!remotePredictions || !user?.id) return;
    setPredictions(remotePredictions);
    localStorage.setItem(`predictions_${user.id}`, JSON.stringify(remotePredictions));
  }, [remotePredictions, user?.id]);

  const userPoints = useMemo(() => {
    const current = leaderboardList.find((entry) => entry.playerId === user?.id);
    return current?.points ?? 0;
  }, [leaderboardList, user?.id]);

  // Simple feedback notification states
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Show a welcome toast when routed here after email verification, etc.
  useEffect(() => {
    if (initialToast) {
      setToastMessage(initialToast);
      const t = setTimeout(() => setToastMessage(null), 6000);
      return () => clearTimeout(t);
    }
  }, [initialToast]);

  // Listen to local sandbox storage updates across tabs
  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem("added_fixtures");
      if (saved) {
        setLocalMatches(JSON.parse(saved));
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const [activeLeagueId, setActiveLeagueId] = useState<string | null>(null);
  const { data: leagueMemberProfiles = [] } = useLeagueMembersQuery(activeLeagueId);
  const activeLeagueMembers = useMemo(() => {
    if (leagueMemberProfiles.length > 0) {
      return leagueMemberProfiles.map((member) => member.id);
    }
    const league = leagues.find((entry) => entry.id === activeLeagueId);
    return league?.members ?? [];
  }, [leagueMemberProfiles, leagues, activeLeagueId]);
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

  const invalidateLeagueQueries = (leagueId?: string) => {
    if (!user?.id) return;
    queryClient.invalidateQueries({ queryKey: queryKeys.userLeagues(user.id) });
    queryClient.invalidateQueries({ queryKey: queryKeys.leagues });
    if (leagueId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.leagueMembers(leagueId) });
    }
  };
  const [expandedStandingsUser, setExpandedStandingsUser] = useState<
    string | null
  >(null);

  // Custom league Create & Join flows interaction states
  const [leagueNameInput, setLeagueNameInput] = useState("");
  const [leaguePasswordInput, setLeaguePasswordInput] = useState("");
  const [leagueSeasonInput, setLeagueSeasonInput] = useState("2026");
  const [leagueSportInput, setLeagueSportInput] = useState<SportType>(SportType.FOOTBALL);
  const [leagueCompSelect, setLeagueCompSelect] = useState("f-epl");
  const [leagueIsPublicInput, setLeagueIsPublicInput] = useState(true);
  const [limitParticipants, setLimitParticipants] = useState(false);
  const [maxParticipantsInput, setMaxParticipantsInput] = useState("10");

  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [joinPasswordInput, setJoinPasswordInput] = useState("");
  const [activeLeagueJoinPassword, setActiveLeagueJoinPassword] = useState("");
  const [isJoiningActiveLeague, setIsJoiningActiveLeague] = useState(false);

  const [leagueTab, setLeagueTab] = useState<"view" | "join" | "create">(
    "view",
  );

  const [viewLeaguesSearchName, setViewLeaguesSearchName] = useState("");
  const [viewLeaguesSport, setViewLeaguesSport] = useState<SportType | "ALL">("ALL");
  const [viewLeaguesCompId, setViewLeaguesCompId] = useState<string>("ALL");
  const [viewLeaguesSeason, setViewLeaguesSeason] = useState<string>("ALL");

  const [editingLeagueId, setEditingLeagueId] = useState<string | null>(null);
  const [editIsPublic, setEditIsPublic] = useState(true);
  const [editLimitParticipants, setEditLimitParticipants] = useState(false);
  const [editMaxParticipantsInput, setEditMaxParticipantsInput] = useState("10");

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

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
      queryClient.invalidateQueries({ queryKey: queryKeys.predictions(user.id) });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.predictions(user.id) });
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
    triggerToast("ðŸŽ¯ Prediction submitted successfully!");

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
      queryClient.invalidateQueries({ queryKey: queryKeys.predictions(user.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.leaderboard });
    } catch (e) {
      console.error("Error locking prediction:", e);
      triggerToast("âš ï¸ Database error saving prediction.");
    }
  };

  const handleUpdateLeagueSettings = async () => {
    if (!editingLeagueId) return;
    
    const maxParts = editLimitParticipants ? parseInt(editMaxParticipantsInput, 10) : null;
    await dbUpdateLeagueSettings(editingLeagueId, editIsPublic, maxParts);

    queryClient.invalidateQueries({ queryKey: queryKeys.leagues });
    setEditingLeagueId(null);
    triggerToast("âœ… League settings updated");
  };

  const handleCreateLeague = async () => {
    const name = leagueNameInput.trim();
    const password = leaguePasswordInput.trim();
    const compId = leagueCompSelect;

    if (!name || !password || !compId) {
      triggerToast("âš ï¸ Specify a name, competition and password.");
      return;
    }

    if (name.length < 3) {
      triggerToast("âš ï¸ Name must be at least 3 characters.");
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

    try {
      await dbCreateLeague(newLeague);
      invalidateLeagueQueries(newLeagueId);

      setLeagueNameInput("");
      setLeaguePasswordInput("");
      setLeagueIsPublicInput(true);
      setLimitParticipants(false);
      setMaxParticipantsInput("10");
      triggerToast(
        `ðŸŽ‰ Created League: "${name}" successfully! Code: ${newLeagueId}`,
      );

      setLeagueTab("view");
      setActiveLeagueId(newLeagueId);
    } catch (err) {
      console.error("Failed writing cloud league:", err);
      triggerToast("âš ï¸ Failed to sync league to PostgreSQL.");
    }
  };

  const handleJoinLeague = async () => {
    const codeInput = joinCodeInput.trim().toUpperCase();
    const passwordEntered = joinPasswordInput.trim();

    if (!codeInput || !passwordEntered) {
      triggerToast("âš ï¸ League Code and Password are required.");
      return;
    }

    // Match code with ID or Name
    const target = leagues.find(
      (l) =>
        l.id.toUpperCase() === codeInput ||
        l.name.toLowerCase() === joinCodeInput.trim().toLowerCase(),
    );

    if (!target) {
      triggerToast("âš ï¸ Private league not found.");
      return;
    }

    if (target.password !== passwordEntered) {
      triggerToast("âŒ Incorrect entry password.");
      return;
    }

    if (userLeagues.some(l => l.id === target.id)) {
      triggerToast("â„¹ï¸ Already joined.");
      setActiveLeagueId(target.id);
      setLeagueTab("view");
      return;
    }

    const currentMembers = await dbFetchLeagueMembers(target.id);

    if (target.maxParticipants && currentMembers.length >= target.maxParticipants) {
      triggerToast(`âš ï¸ League is full (Max ${target.maxParticipants} players).`);
      return;
    }

    try {
      await dbJoinLeague(target.id, user.id);
      invalidateLeagueQueries(target.id);

      setJoinCodeInput("");
      setJoinPasswordInput("");
      setLeagueTab("view");
      setActiveLeagueId(target.id);

      triggerToast(`ðŸŽ‰ Joined "${target.name}"!`);
    } catch (err) {
      console.error("Failed joining cloud league:", err);
      triggerToast("âš ï¸ Database integration failed.");
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

      invalidateLeagueQueries(leagueId);
      setActiveLeagueId(null);
      triggerToast(`ðŸ—‘ï¸ Deleted your league: "${target.name}".`);
      return;
    }

    try {
      await dbLeaveLeague(leagueId, user.id);
      invalidateLeagueQueries(leagueId);
      setActiveLeagueId(null);
      triggerToast(`ðŸšª Left "${target.name}".`);
    } catch (err) {
      console.error("Failed leaving league:", err);
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

  const perfectPredictions = Object.keys(predictions).filter((k) => {
    const pred = predictions[k];
    if (!pred.submitted) return false;
    const match = allMatches.find((m) => m.id === k);
    if (!match || match.status !== "completed") return false;
    return match.homeScore === pred.home && match.awayScore === pred.away;
  }).length;

  const displayLeaderboard = useMemo(
    () => mapLeaderboardForSport(leaderboardList, globalLeaderboardSport, user.id),
    [leaderboardList, globalLeaderboardSport, user.id],
  );

  const isUserInAnyLeague = userLeagues.length > 0;

  // ── "My League" leaderboard scope ────────────────────────────────────────
  // Default the leaderboard to the user's most populated private league so
  // their local competition is front-and-center; Global requires a click.
  const privateLeagues = useMemo(
    () => userLeagues.filter((l) => !l.isPublic),
    [userLeagues],
  );
  const privateLeagueIds = useMemo(
    () => privateLeagues.map((l) => l.id),
    [privateLeagues],
  );
  const { data: leaguesMembership = {} } = useLeaguesMembershipQuery(privateLeagueIds);

  const targetPrivateLeague = useMemo(() => {
    if (privateLeagues.length === 0) return null;
    return [...privateLeagues].sort(
      (a, b) =>
        (leaguesMembership[b.id]?.length || 0) -
        (leaguesMembership[a.id]?.length || 0),
    )[0];
  }, [privateLeagues, leaguesMembership]);

  const leagueLeaderboard = useMemo(() => {
    if (!targetPrivateLeague) return [];
    const memberIds = leaguesMembership[targetPrivateLeague.id] || [];
    const records = leaderboardList.filter((r) => memberIds.includes(r.playerId));
    return mapLeaderboardForSport(records, globalLeaderboardSport, user.id);
  }, [targetPrivateLeague, leaguesMembership, leaderboardList, globalLeaderboardSport, user.id]);

  const [leaderboardScope, setLeaderboardScope] = useState<LeaderboardScope>("global");
  const leaderboardScopeInitialized = useRef(false);
  useEffect(() => {
    if (leaderboardScopeInitialized.current) return;
    if (privateLeagues.length > 0) {
      setLeaderboardScope("league");
      leaderboardScopeInitialized.current = true;
    }
  }, [privateLeagues.length]);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 animate-fade-in pb-20 md:pb-0">
      <GlobalNavigation
        user={user}
        onLogout={onLogout}
        onOpenRules={onOpenRules}
        onOpenAdmin={onOpenAdmin}
        onOpenAccount={onOpenAccount}
        onOpenLeagues={openLeaguesModal}
        isUserInAnyLeague={isUserInAnyLeague}
        onResetState={() => {
          setActiveLeagueId(null);
          setSelectedSport(null);
          setSelectedCompId(null);
        }}
      />
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

      {activeLeagueId ? (() => {
        const activeLeague = leagues.find((l) => l.id === activeLeagueId);
        if (!activeLeague) {
          setActiveLeagueId(null);
          return null;
        }
        return (
          <LeagueHub
            activeLeague={activeLeague}
            user={user}
            registeredUsers={registeredUsers}
            leagueMembersMemoized={leagueMembersMemoized}
            sortedActiveLeagueMatches={sortedActiveLeagueMatches}
            activeLeagueMatches={activeLeagueMatches}
            allMatches={allMatches}
            activeLeagueMembers={activeLeagueMembers}
            expandedStandingsUser={expandedStandingsUser}
            setExpandedStandingsUser={setExpandedStandingsUser}
            isJoiningActiveLeague={isJoiningActiveLeague}
            setIsJoiningActiveLeague={setIsJoiningActiveLeague}
            activeLeagueJoinPassword={activeLeagueJoinPassword}
            setActiveLeagueJoinPassword={setActiveLeagueJoinPassword}
            onBack={() => setActiveLeagueId(null)}
            onRequestLeave={(leagueId) => setLeagueToLeave(leagueId)}
            onJoinLeague={async (league, password) => {
              if (password !== league.password) {
                triggerToast("Incorrect password.");
                return;
              }
              try {
                await dbJoinLeague(league.id, user.id);
                invalidateLeagueQueries(league.id);
                setIsJoiningActiveLeague(false);
                setActiveLeagueJoinPassword("");
                triggerToast("Successfully joined the league!");
              } catch {
                triggerToast("Failed to join league.");
              }
            }}
            triggerToast={triggerToast}
          />
        );
      })() : (
        <>
          {/* Personalized Welcome Jumbotron Header */}
          <motion.div transition={{ duration: 0.5, ease: "easeInOut" }}>
            <WelcomeHeader
              user={user}
              userPoints={userPoints}
              totalPredicted={totalPredicted}
              perfectPredictions={perfectPredictions}
              isUserInAnyLeague={isUserInAnyLeague}
            />
          </motion.div>

          {isUserInAnyLeague && (
            <MatchPredictor
              isUserInAnyLeague={isUserInAnyLeague}
              selectedSport={selectedSport}
              setSelectedSport={setSelectedSport}
              selectedCompId={selectedCompId}
              setSelectedCompId={setSelectedCompId}
              allMatches={allMatches}
              sortedActiveMatches={sortedActiveMatches}
              activeMatches={activeMatches}
              filteredCompetitions={filteredCompetitions}
              selectedCompetition={selectedCompetition}
              predictions={predictions}
              isEmailVerified={authStatus.isVerified}
              onScoreChange={handleScoreChange}
              onRugbyPredictionChange={handleRugbyPredictionChange}
              onSubmitPrediction={submitPrediction}
            />
          )}

          <LeaderboardTable
            user={user}
            displayLeaderboard={
              leaderboardScope === "league" ? leagueLeaderboard : displayLeaderboard
            }
            globalLeaderboardSport={globalLeaderboardSport}
            setGlobalLeaderboardSport={setGlobalLeaderboardSport}
            onViewProfile={(player) => setViewingProfile(player)}
            triggerToast={triggerToast}
            scope={leaderboardScope}
            setScope={setLeaderboardScope}
            hasPrivateLeague={privateLeagues.length > 0}
            leagueName={targetPrivateLeague?.name}
          />
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
                  âš ï¸
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

      <MobileNavigation
        user={user}
        onOpenAccount={onOpenAccount}
        onOpenRules={onOpenRules}
        onOpenAdmin={onOpenAdmin}
        onOpenLeagues={openLeaguesModal}
        isUserInAnyLeague={isUserInAnyLeague}
        onLogout={onLogout}
      />

      {/* Leagues Overlay — radial expansion from the click point */}
      <AnimatePresence>
        {showLeagues && (
          <motion.div
            {...radialClip(leaguesOrigin)}
            className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto"
          >
            <div
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
              onClick={() => setShowLeagues(false)}
            />
            <div className="relative w-full max-w-lg my-8">
              <LeagueManagementPanel
                user={user}
                leagues={leagues}
                userLeagues={userLeagues}
                isUserInAnyLeague={isUserInAnyLeague}
                leagueTab={leagueTab}
                setLeagueTab={setLeagueTab}
                activeLeagueId={activeLeagueId}
                setActiveLeagueId={(id) => {
                  setActiveLeagueId(id);
                  if (id) setShowLeagues(false);
                }}
                leagueMembersMemoized={leagueMembersMemoized}
                editingLeagueId={editingLeagueId}
                setEditingLeagueId={setEditingLeagueId}
                editIsPublic={editIsPublic}
                setEditIsPublic={setEditIsPublic}
                editLimitParticipants={editLimitParticipants}
                setEditLimitParticipants={setEditLimitParticipants}
                editMaxParticipantsInput={editMaxParticipantsInput}
                setEditMaxParticipantsInput={setEditMaxParticipantsInput}
                viewLeaguesSearchName={viewLeaguesSearchName}
                setViewLeaguesSearchName={setViewLeaguesSearchName}
                viewLeaguesSport={viewLeaguesSport}
                setViewLeaguesSport={setViewLeaguesSport}
                viewLeaguesCompId={viewLeaguesCompId}
                setViewLeaguesCompId={setViewLeaguesCompId}
                viewLeaguesSeason={viewLeaguesSeason}
                setViewLeaguesSeason={setViewLeaguesSeason}
                leagueNameInput={leagueNameInput}
                setLeagueNameInput={setLeagueNameInput}
                leaguePasswordInput={leaguePasswordInput}
                setLeaguePasswordInput={setLeaguePasswordInput}
                leagueSeasonInput={leagueSeasonInput}
                setLeagueSeasonInput={setLeagueSeasonInput}
                leagueSportInput={leagueSportInput}
                setLeagueSportInput={setLeagueSportInput}
                leagueCompSelect={leagueCompSelect}
                setLeagueCompSelect={setLeagueCompSelect}
                leagueIsPublicInput={leagueIsPublicInput}
                setLeagueIsPublicInput={setLeagueIsPublicInput}
                limitParticipants={limitParticipants}
                setLimitParticipants={setLimitParticipants}
                maxParticipantsInput={maxParticipantsInput}
                setMaxParticipantsInput={setMaxParticipantsInput}
                joinCodeInput={joinCodeInput}
                setJoinCodeInput={setJoinCodeInput}
                joinPasswordInput={joinPasswordInput}
                setJoinPasswordInput={setJoinPasswordInput}
                handleCreateLeague={handleCreateLeague}
                handleJoinLeague={handleJoinLeague}
                handleLeaveLeague={handleLeaveLeague}
                handleUpdateLeagueSettings={handleUpdateLeagueSettings}
                triggerToast={triggerToast}
                onClose={() => setShowLeagues(false)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {showOnboarding && !activeLeagueId && (
        <OnboardingTour steps={ONBOARDING_STEPS} onComplete={completeOnboarding} />
      )}

      <AnimatePresence>
        {showShieldEvent && !showOnboarding && !showLeagues && (
          <CommunityShieldEvent
            user={user}
            triggerToast={triggerToast}
            onClose={dismissShieldEvent}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
