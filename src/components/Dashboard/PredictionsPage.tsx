import React, { useEffect } from "react";
import { SportType, Competition, Match, UserProfile } from "../../types";
import MatchPredictor from "./MatchPredictor";
import type { PredictionEntry } from "../../supabase";
import type { SeenFeatureKey, SeenFeatures } from "../../lib/seenFeatures";
import {
  EmergingSportWorkspace,
  SportSelectorBanner,
  isEmergingSport,
  useUserRole,
  type SportKey,
} from "../../sports/emerging";

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
  onSubmitPrediction: (matchId: string) => void;
  onOpenLeagues: () => void;
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
}: PredictionsPageProps) {
  const userRole = useUserRole(user.id, user.isAdmin);
  const showEmerging = isEmergingSport(activeSport);

  // Ensure a core sport is always available for MatchPredictor when returning from F1/Golf.
  useEffect(() => {
    if (!selectedSport) {
      setSelectedSport(user.preferredSport ?? SportType.FOOTBALL);
    }
  }, [selectedSport, setSelectedSport, user.preferredSport]);

  if (!isUserInAnyLeague && !showEmerging) {
    return (
      <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-8 text-center space-y-4">
        <h2 className="text-lg font-display font-extrabold text-white">
          Join a league to predict
        </h2>
        <p className="text-xs text-slate-400 font-sans max-w-sm mx-auto leading-relaxed">
          You need to be in at least one league before the Match Predictor
          unlocks. Create a private league or join with a code.
        </p>
        <button
          type="button"
          onClick={onOpenLeagues}
          className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold font-display cursor-pointer transition-colors"
        >
          Open Leagues
        </button>
      </div>
    );
  }

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
        </div>
      </div>

      {showEmerging ? (
        <EmergingSportWorkspace sport={activeSport} userId={user.id} />
      ) : !isUserInAnyLeague ? (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-8 text-center space-y-4">
          <h2 className="text-lg font-display font-extrabold text-white">
            Join a league to predict
          </h2>
          <p className="text-xs text-slate-400 font-sans max-w-sm mx-auto leading-relaxed">
            You need to be in at least one league before the Match Predictor
            unlocks.
          </p>
          <button
            type="button"
            onClick={onOpenLeagues}
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold font-display cursor-pointer transition-colors"
          >
            Open Leagues
          </button>
        </div>
      ) : (
        <MatchPredictor
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
          isEmailVerified={isEmailVerified}
          seenFeatures={seenFeatures}
          onFeatureSeen={onFeatureSeen}
          onScoreChange={onScoreChange}
          onRugbyPredictionChange={onRugbyPredictionChange}
          onSubmitPrediction={onSubmitPrediction}
        />
      )}
    </div>
  );
}
