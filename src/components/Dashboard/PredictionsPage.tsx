import React, { useEffect } from "react";
import { SportType, Competition, Match, UserProfile } from "../../types";
import MatchPredictor from "./MatchPredictor";
import type { PredictionEntry } from "../../supabase";
import type { SeenFeatureKey, SeenFeatures } from "../../lib/seenFeatures";

interface PredictionsPageProps {
  user: UserProfile;
  isUserInAnyLeague: boolean;
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
 * Defaults sport tab from preferred_sport and hosts the MatchPredictor list.
 */
export default function PredictionsPage({
  user,
  isUserInAnyLeague,
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
  // Default to preferred sport whenever this page mounts without a selection.
  useEffect(() => {
    if (!selectedSport) {
      setSelectedSport(user.preferredSport ?? SportType.FOOTBALL);
    }
  }, [selectedSport, setSelectedSport, user.preferredSport]);

  if (!isUserInAnyLeague) {
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
      <div className="px-0.5">
        <h1 className="text-xl font-display font-extrabold text-white tracking-tight">
          Predictions
        </h1>
        <p className="text-xs text-slate-500 font-sans mt-1">
          Lock in your scores before kick-off.
        </p>
      </div>

      {/* Top-level Football / Rugby tabs */}
      <div
        role="tablist"
        aria-label="Sport"
        className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-950/70 border border-slate-800"
      >
        {(
          [
            { id: SportType.FOOTBALL, label: "Football" },
            { id: SportType.RUGBY, label: "Rugby" },
          ] as const
        ).map((tab) => {
          const active = selectedSport === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSelectedSport(tab.id)}
              className={`py-2.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                active
                  ? tab.id === SportType.FOOTBALL
                    ? "bg-blue-600 text-white shadow-md"
                    : "bg-amber-600 text-white shadow-md"
                  : "text-slate-500 hover:text-slate-300 hover:bg-slate-900"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

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
    </div>
  );
}
