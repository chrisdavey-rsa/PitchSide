import React, { useEffect } from "react";
import { Users } from "lucide-react";
import { SportType, Competition, Match, UserProfile } from "../../types";
import MatchPredictor from "./MatchPredictor";
import OfflineDraftBanner from "../OfflineDraftBanner";
import HowToPredictStepper, {
  type HowToPredictSport,
} from "../predictions/HowToPredictStepper";
import type { PredictionEntry } from "../../supabase";
import {
  SeenFeature,
  hasSeenFeature,
  type SeenFeatureKey,
  type SeenFeatures,
} from "../../lib/seenFeatures";
import {
  EmergingSportWorkspace,
  SportSelectorBanner,
  isEmergingSport,
  useUserRole,
  type SportKey,
} from "../../sports/emerging";

function howToPredictFeatureKey(sport: SportKey): SeenFeatureKey {
  switch (sport) {
    case "rugby":
      return SeenFeature.HowToPredictRugby;
    case "formula1":
      return SeenFeature.HowToPredictFormula1;
    case "golf":
      return SeenFeature.HowToPredictGolf;
    default:
      return SeenFeature.HowToPredictFootball;
  }
}

function toHowToPredictSport(sport: SportKey): HowToPredictSport {
  if (sport === "rugby" || sport === "formula1" || sport === "golf") return sport;
  return "football";
}

interface PredictionsPageProps {
  user: UserProfile;
  isUserInAnyLeague: boolean;
  /** Unified workspace sport (football | rugby | golf | formula1). */
  activeSport: SportKey;
  setActiveSport: (sport: SportKey) => void;
  /** Core sport used by MatchPredictor / match filters (football | rugby). */
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
  /** Offline drafting banner (core sports only). */
  isOffline?: boolean;
  hasOfflineDraft?: boolean;
  onApplyOfflineDraft?: () => void | Promise<void>;
  applyingOfflineDraft?: boolean;
}

/**
 * Dedicated Predictions shell (center mobile tab / desktop Predictions view).
 * Sport Selector Banner + dynamic workspace (core MatchPredictor or emerging views).
 */
export default function PredictionsPage({
  user,
  isUserInAnyLeague,
  activeSport,
  setActiveSport,
  selectedSport,
  setSelectedSport,
  selectedCompId,
  setSelectedCompId,
  allMatches,
  sortedActiveMatches,
  activeMatches,
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
  const userRole = useUserRole(user.id, user.isAdmin);
  const showEmerging = isEmergingSport(activeSport);

  // Ensure a core sport is always available for MatchPredictor when returning from F1/Golf.
  useEffect(() => {
    if (!selectedSport) {
      setSelectedSport(user.preferredSport ?? SportType.FOOTBALL);
    }
  }, [selectedSport, setSelectedSport, user.preferredSport]);

  return (
    <div className="space-y-4 w-full">
      {/*
        On F1, keep the title + sport banner at the same 2/3 width as Football/Rugby
        predictions (matching lg:col-span-2 of the dashboard grid), while the F1
        workspace below spans the full dashboard width (nav / welcome header).
      */}
      <div
        className={
          activeSport === "formula1"
            ? "w-full grid grid-cols-1 lg:grid-cols-3 gap-6"
            : "w-full"
        }
      >
        <div
          className={
            activeSport === "formula1" ? "lg:col-span-2 space-y-4" : "space-y-4"
          }
        >
          <div className="px-0.5">
            <h1 className="text-xl font-display font-extrabold text-white tracking-tight">
              Predictions
            </h1>
            <p className="text-xs text-slate-500 font-sans mt-1 min-h-4">
              {showEmerging
                ? "Admin preview — emerging sports workspace."
                : "Lock in your scores before kick-off."}
            </p>
          </div>

          <SportSelectorBanner
            activeSport={activeSport}
            onSelectSport={setActiveSport}
            userRole={userRole}
            className="w-full shrink-0"
          />

          {!isUserInAnyLeague && !showEmerging && (
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/20 px-4 py-3.5 space-y-2">
              <p className="text-xs text-slate-300 font-sans leading-relaxed">
                You are active in the Global Leaderboard. Select a sport above to
                start predicting. Want to compete directly with friends? Create or
                join a Private League from the navigation menu.
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

          {!showEmerging && (
            <OfflineDraftBanner
              isOffline={isOffline}
              hasDraft={hasOfflineDraft}
              onApplyAndSubmit={onApplyOfflineDraft}
              applying={applyingOfflineDraft}
            />
          )}

          {!hasSeenFeature(seenFeatures, howToPredictFeatureKey(activeSport)) && (
            <HowToPredictStepper
              sport={toHowToPredictSport(activeSport)}
              dismissible
              onDismiss={() => {
                void onFeatureSeen(howToPredictFeatureKey(activeSport));
              }}
            />
          )}
        </div>
      </div>

      {showEmerging ? (
        <EmergingSportWorkspace sport={activeSport} userId={user.id} />
      ) : (
        <MatchPredictor
          selectedSport={selectedSport}
          selectedCompId={selectedCompId}
          setSelectedCompId={setSelectedCompId}
          allMatches={allMatches}
          sortedActiveMatches={sortedActiveMatches}
          activeMatches={activeMatches}
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
        />
      )}
    </div>
  );
}
