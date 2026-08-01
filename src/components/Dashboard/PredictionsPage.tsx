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
import CompetitionFilterRail, {
  useCompetitionFilterOptions,
  usePersistedCompetitionFilter,
} from "../predictions/CompetitionFilterRail";
import MobileFilterFab from "../predictions/MobileFilterFab";
import type { PredictionEntry } from "../../supabase";
import {
  SeenFeature,
  hasSeenFeature,
  type SeenFeatureKey,
  type SeenFeatures,
} from "../../lib/seenFeatures";

function howToPredictFeatureKey(
  filter: FeedSportFilter,
): SeenFeatureKey {
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
  /** Kept for Dashboard leaderboard sync; feed uses local filter. */
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
  isOffline?: boolean;
  hasOfflineDraft?: boolean;
  onApplyOfflineDraft?: () => void | Promise<void>;
  applyingOfflineDraft?: boolean;
}

/**
 * Predictions shell — fixed flag rail (viewport) + flush main column
 * aligned with the Dashboard "Hello" banner (same max-w parent).
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
  isOffline = false,
  hasOfflineDraft = false,
  onApplyOfflineDraft,
  applyingOfflineDraft = false,
}: PredictionsPageProps) {
  const [sportFilter, setSportFilter] = useState<FeedSportFilter>("all");
  const [onlyUnmade, setOnlyUnmade] = useState(false);

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

  const feedMatches = useMemo(() => {
    const now = Date.now();
    let list = allMatches.filter((m) => {
      const sport = String(m.sport);
      if (sportFilter === "football") return sport === "football";
      if (sportFilter === "rugby") return sport === "rugby";
      return sport === "football" || sport === "rugby";
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
  }, [allMatches, sportFilter, onlyUnmade, predictions]);

  const predictorSport =
    sportFilter === "rugby"
      ? SportType.RUGBY
      : sportFilter === "football"
        ? SportType.FOOTBALL
        : selectedSport ?? user.preferredSport ?? SportType.FOOTBALL;

  const [compFilterIds, setCompFilterIds] = usePersistedCompetitionFilter();
  const competitionFilterOptions = useCompetitionFilterOptions(feedMatches);

  return (
    <>
      {/* Viewport-fixed nation filter — outside scroll / overflow containers. */}
      <aside
        data-tour="tour-filters"
        className="fixed left-4 xl:left-8 top-32 flex flex-col gap-2 z-50 hidden md:flex"
        aria-label="Nation filter"
      >
        <CompetitionFilterRail
          options={competitionFilterOptions}
          selectedIds={compFilterIds}
          onChange={setCompFilterIds}
        />
      </aside>

      {/* Main Predictions column — flush with Hello banner (same max-w parent). */}
      <div className="w-full flex flex-col space-y-4">
        <div>
          <h1 className="text-xl font-display font-extrabold text-white tracking-tight">
            Predictions
          </h1>
          <p className="text-xs text-slate-500 font-sans mt-1 min-h-4">
            Upcoming and recent fixtures across your sports.
          </p>
        </div>

        <div data-tour="tour-filters-sports">
          <PredictionsFeedFilter
            sportFilter={sportFilter}
            onSportFilterChange={setSportFilter}
            onlyUnmade={onlyUnmade}
            onOnlyUnmadeChange={setOnlyUnmade}
          />
        </div>

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
          filteredCompetitions={filteredCompetitions}
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
          competitionFilterIds={compFilterIds}
          onCompetitionFilterIdsChange={setCompFilterIds}
        />
      </div>

      <MobileFilterFab
        options={competitionFilterOptions}
        selectedIds={compFilterIds}
        onChange={setCompFilterIds}
      />
    </>
  );
}
