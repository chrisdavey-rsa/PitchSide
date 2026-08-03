import React, { useEffect, useMemo, useState } from "react";
import { Users } from "lucide-react";
import { SportType, Competition, Match, UserProfile } from "../../types";
import MatchPredictor from "./MatchPredictor";
import OfflineDraftBanner from "../OfflineDraftBanner";
import HowToPredictStepper, {
  type HowToPredictSport,
} from "../predictions/HowToPredictStepper";
import PredictionsFeedFilter, {
  type FeedSportFilter,
} from "../predictions/PredictionsFeedFilter";
import VerticalLeaguePills, {
  ALL_LEAGUES_PILL_ID,
  buildPillItems,
} from "./VerticalLeaguePills";
import TournamentFilter from "../predictions/TournamentFilter";
import TournamentOptInModal from "./TournamentOptInModal";
import type { PredictionEntry } from "../../supabase";
import { dbUpdateTournamentSubscriptions } from "../../supabase";
import {
  SeenFeature,
  hasSeenFeature,
  type SeenFeatureKey,
  type SeenFeatures,
} from "../../lib/seenFeatures";
import { defaultSubscribedLeagues } from "../../utils/userOnboardingDefaults";
import type { GolfCoverageTier } from "../../constants/golfCoverage";

function howToPredictFeatureKey(filter: FeedSportFilter): SeenFeatureKey {
  return filter === "rugby"
    ? SeenFeature.HowToPredictRugby
    : SeenFeature.HowToPredictFootball;
}

function toHowToPredictSport(filter: FeedSportFilter): HowToPredictSport {
  return filter === "rugby" ? "rugby" : "football";
}

interface PredictionsPageProps {
  user: UserProfile;
  isUserInAnyLeague: boolean;
  activeSport: string;
  setActiveSport: (sport: "football" | "rugby" | "golf" | "formula1") => void;
  selectedSport: SportType | null;
  setSelectedSport: (sport: SportType | null) => void;
  selectedCompId: string | null;
  setSelectedCompId: (id: string | null) => void;
  allMatches: Match[];
  sortedActiveMatches: Match[];
  activeMatches: Match[];
  filteredCompetitions: Competition[];
  selectedCompetition?: Competition;
  predictions: Record<string, PredictionEntry>;
  isEmailVerified: boolean;
  seenFeatures?: SeenFeatures;
  onFeatureSeen: (featureKey: SeenFeatureKey) => void | Promise<unknown>;
  onScoreChange: (matchId: string, side: "home" | "away", val: string) => void;
  onRugbyPredictionChange: (
    matchId: string,
    winner: "home" | "away" | "draw" | null,
    marginStr: string,
  ) => void;
  onSubmitPrediction: (matchId: string, powerupInstanceId?: string | null) => void;
  onOpenLeagues: () => void;
  onUserUpdate?: (user: UserProfile) => void;
  isOffline?: boolean;
  hasOfflineDraft?: boolean;
  onApplyOfflineDraft?: () => void | Promise<void>;
  applyingOfflineDraft?: boolean;
}

/**
 * Predictions shell — subscribed pills in the left gutter; main column
 * stays flush with WelcomeHeader (no ml/pl offset).
 */
export default function PredictionsPage({
  user,
  isUserInAnyLeague,
  setActiveSport,
  selectedSport,
  setSelectedSport,
  selectedCompId,
  setSelectedCompId,
  allMatches,
  filteredCompetitions,
  selectedCompetition,
  predictions,
  isEmailVerified,
  seenFeatures,
  onFeatureSeen,
  onScoreChange,
  onRugbyPredictionChange,
  onSubmitPrediction,
  onOpenLeagues,
  onUserUpdate,
  isOffline = false,
  hasOfflineDraft = false,
  onApplyOfflineDraft,
  applyingOfflineDraft = false,
}: PredictionsPageProps) {
  const [sportFilter, setSportFilter] = useState<FeedSportFilter>("all");
  const [onlyUnmade, setOnlyUnmade] = useState(false);
  const [optInOpen, setOptInOpen] = useState(false);

  const subscribedLeagues = useMemo(() => {
    if (user.subscribedLeagues && user.subscribedLeagues.length > 0) {
      return user.subscribedLeagues;
    }
    return defaultSubscribedLeagues({
      preferredNation: user.preferredNation,
      selectedSports: user.selectedSports,
    });
  }, [user.subscribedLeagues, user.preferredNation, user.selectedSports]);

  const golfTier: GolfCoverageTier = user.golfCoverageTier || "MAJORS_ONLY";
  const pillItems = useMemo(
    () => buildPillItems(subscribedLeagues, golfTier),
    [subscribedLeagues, golfTier],
  );

  const subscribedCoreIds = useMemo(
    () => new Set(subscribedLeagues.filter((id) => !id.startsWith("g-"))),
    [subscribedLeagues],
  );

  useEffect(() => {
    if (sportFilter === "football") {
      setSelectedSport(SportType.FOOTBALL);
      setActiveSport("football");
    } else if (sportFilter === "rugby") {
      setSelectedSport(SportType.RUGBY);
      setActiveSport("rugby");
    } else if (!selectedSport) {
      setSelectedSport(user.preferredSport ?? SportType.FOOTBALL);
    }
  }, [
    sportFilter,
    setSelectedSport,
    setActiveSport,
    selectedSport,
    user.preferredSport,
  ]);

  useEffect(() => {
    if (
      selectedCompId &&
      selectedCompId !== ALL_LEAGUES_PILL_ID &&
      !subscribedCoreIds.has(selectedCompId)
    ) {
      setSelectedCompId(null);
    }
  }, [selectedCompId, subscribedCoreIds, setSelectedCompId]);

  const feedMatches = useMemo(() => {
    const now = Date.now();
    let list = allMatches.filter((m) => {
      const sport = String(m.sport);
      if (sportFilter === "football" && sport !== "football") return false;
      if (sportFilter === "rugby" && sport !== "rugby") return false;
      if (sport !== "football" && sport !== "rugby") return false;
      if (!subscribedCoreIds.has(m.competitionId)) return false;
      if (selectedCompId && m.competitionId !== selectedCompId) return false;
      return true;
    });

    if (onlyUnmade) {
      list = list.filter((m) => {
        const submitted = predictions[m.id]?.submitted;
        const started =
          m.status === "live" ||
          m.status === "completed" ||
          new Date(m.matchDate).getTime() <= now;
        return !submitted && !started;
      });
    }

    return [...list].sort((a, b) => {
      const t = new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime();
      if (t !== 0) return t;
      return a.homeTeam.localeCompare(b.homeTeam);
    });
  }, [
    allMatches,
    sportFilter,
    onlyUnmade,
    predictions,
    subscribedCoreIds,
    selectedCompId,
  ]);

  const subscribedCompetitions = useMemo(
    () => filteredCompetitions.filter((c) => subscribedCoreIds.has(c.id)),
    [filteredCompetitions, subscribedCoreIds],
  );

  const predictorSport =
    sportFilter === "rugby"
      ? SportType.RUGBY
      : sportFilter === "football"
        ? SportType.FOOTBALL
        : selectedSport ?? user.preferredSport ?? SportType.FOOTBALL;

  const handlePillSelect = (id: string | null) => {
    if (id == null || id === ALL_LEAGUES_PILL_ID) {
      setSelectedCompId(null);
      setSportFilter("all");
      return;
    }
    setSelectedCompId(id);
    if (id.startsWith("r-")) {
      setSportFilter("rugby");
      setActiveSport("rugby");
    } else {
      setSportFilter("football");
      setActiveSport("football");
    }
  };

  const handleSaveOptIn = async (next: {
    subscribedLeagues: string[];
    golfCoverageTier: GolfCoverageTier;
  }) => {
    await dbUpdateTournamentSubscriptions(user.id, next);
    const updated: UserProfile = {
      ...user,
      subscribedLeagues: next.subscribedLeagues,
      golfCoverageTier: next.golfCoverageTier,
    };
    onUserUpdate?.(updated);
    try {
      localStorage.setItem("pitchside_logged_in", JSON.stringify(updated));
    } catch {
      /* ignore */
    }
  };

  return (
    <>
      {/*
        Fixed gutter rail — does NOT offset the Predictions column.
        Hello + Predictions share the same max-w container left edge.
      */}
      <aside
        data-tour="tour-league-pills"
        className="fixed left-2 xl:left-4 top-32 z-40 hidden md:flex flex-col"
        aria-label="Subscribed tournaments"
      >
        <VerticalLeaguePills
          items={pillItems}
          selectedId={selectedCompId}
          onSelect={handlePillSelect}
          onAddClick={() => setOptInOpen(true)}
          orientation="vertical"
        />
      </aside>

      {/* Flush with WelcomeHeader — no ml-/pl- offsets */}
      <div className="w-full flex flex-col space-y-4">
        <div>
          <h1 className="text-xl font-display font-extrabold text-white tracking-tight">
            Predictions
          </h1>
          <p className="text-xs text-slate-500 font-sans mt-1 min-h-4">
            Fixtures from your opted-in tournaments.
          </p>
        </div>

        <TournamentFilter
          items={pillItems}
          selectedId={selectedCompId}
          onSelect={handlePillSelect}
          onAddClick={() => setOptInOpen(true)}
        />

        <div data-tour="tour-filters-sports">
          <PredictionsFeedFilter
            sportFilter={sportFilter}
            onSportFilterChange={setSportFilter}
            onlyUnmade={onlyUnmade}
            onOnlyUnmadeChange={setOnlyUnmade}
          />
        </div>

        {subscribedCoreIds.size === 0 && (
          <div className="rounded-2xl border border-amber-500/25 bg-amber-950/20 px-4 py-3.5 space-y-2">
            <p className="text-xs text-slate-300 font-sans leading-relaxed">
              No tournaments selected. Opt in to leagues and competitions to see
              fixtures in your Predictions feed.
            </p>
            <button
              type="button"
              onClick={() => setOptInOpen(true)}
              className="inline-flex items-center gap-1.5 text-[10px] font-bold font-display uppercase tracking-wide text-amber-300 hover:text-amber-200 cursor-pointer"
            >
              Choose tournaments
            </button>
          </div>
        )}

        {!isUserInAnyLeague && (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/20 px-4 py-3.5 space-y-2">
            <p className="text-xs text-slate-300 font-sans leading-relaxed">
              You are active in the Global Leaderboard. Want to compete directly
              with friends? Create or join a Private League from the navigation
              menu.
            </p>
            <button
              type="button"
              onClick={onOpenLeagues}
              className="inline-flex items-center gap-1.5 text-[10px] font-bold font-display uppercase tracking-wide text-emerald-400 hover:text-emerald-300 cursor-pointer"
            >
              <Users className="h-3.5 w-3.5" />
              Browse Private Leagues
            </button>
          </div>
        )}

        <OfflineDraftBanner
          isOffline={isOffline}
          hasDraft={hasOfflineDraft}
          onApplyAndSubmit={onApplyOfflineDraft}
          applying={applyingOfflineDraft}
        />

        {!hasSeenFeature(seenFeatures, howToPredictFeatureKey(sportFilter)) && (
          <HowToPredictStepper
            sport={toHowToPredictSport(sportFilter)}
            dismissible
            onDismiss={() => {
              void onFeatureSeen(howToPredictFeatureKey(sportFilter));
            }}
          />
        )}

        <MatchPredictor
          selectedSport={predictorSport}
          selectedCompId={selectedCompId}
          setSelectedCompId={setSelectedCompId}
          allMatches={allMatches}
          sortedActiveMatches={feedMatches}
          activeMatches={feedMatches}
          filteredCompetitions={subscribedCompetitions}
          selectedCompetition={selectedCompetition}
          predictions={predictions}
          isEmailVerified={isEmailVerified}
          seenFeatures={seenFeatures}
          onFeatureSeen={onFeatureSeen}
          onScoreChange={onScoreChange}
          onRugbyPredictionChange={onRugbyPredictionChange}
          onSubmitPrediction={onSubmitPrediction}
          userId={user.id}
          unifiedFeed
          feedSportFilter={sportFilter}
        />
      </div>

      {optInOpen && (
        <TournamentOptInModal
          subscribedLeagues={subscribedLeagues}
          golfCoverageTier={golfTier}
          onClose={() => setOptInOpen(false)}
          onSave={handleSaveOptIn}
        />
      )}
    </>
  );
}
