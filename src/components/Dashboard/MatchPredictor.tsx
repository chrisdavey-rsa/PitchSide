import React from "react";
import { motion } from "motion/react";
import { UserProfile, SportType } from "../../types";
import { getCompetitions } from "../../competitions";

interface Match {
  id: string;
  homeTeam: string;
  awayTeam: string;
  kickoffTime: string;
  competitionId: string;
}

interface Prediction {
  home: number;
  away: number;
  submitted: boolean;
}

interface MatchPredictorProps {
  user: UserProfile;
  selectedSport: SportType;
  selectedCompId: string | null;
  setSelectedCompId: (id: string) => void;
  allMatches?: Match[];
  predictions?: Record<string, Prediction>;
  onSavePrediction?: (matchId: string, home: number, away: number) => void;
  onSubmitPrediction?: (matchId: string) => void;
}

export default function MatchPredictor({
  user,
  selectedSport,
  selectedCompId,
  setSelectedCompId,
  allMatches = [],
  predictions = {},
}: MatchPredictorProps) {
  const filteredCompetitions = getCompetitions().filter(
    (c) => c.sport === selectedSport
  );

  const activeMatches = allMatches.filter(
    (m) => m.competitionId === selectedCompId
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-slate-900/60 rounded-3xl border border-slate-800 p-6 shadow-xl"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5 mb-5">
        <div>
          <span className="text-[10px] uppercase font-bold font-mono tracking-widest text-emerald-400">
            Live Division Filters
          </span>
          <h3 className="text-xl font-bold font-display text-white mt-0.5">
            {selectedSport === SportType.FOOTBALL ? "Football Leagues" : "Rugby Leagues"} Included
          </h3>
        </div>
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

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {filteredCompetitions.map((comp) => {
          const count = allMatches.filter((m) => m.competitionId === comp.id).length;
          const isSelected = selectedCompId === comp.id;
          return (
            <button
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

      {!selectedCompId ? (
        <div className="text-center py-10 text-slate-500 font-sans text-xs">
          👈 Select one of the competitions above to load fixtures and configure your score predictions.
        </div>
      ) : activeMatches.length === 0 ? (
        <div className="text-center py-10 text-slate-500 font-sans text-xs mt-6 pt-5 border-t border-slate-800">
          No upcoming fixtures scheduled for this competition yet.
        </div>
      ) : (
        <div className="mt-6 pt-5 border-t border-slate-800 space-y-4">
          {activeMatches.map((match) => {
            const pred = predictions[match.id];
            return (
              <div
                key={match.id}
                className="bg-slate-950/40 rounded-xl border border-slate-800 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="text-xs text-slate-400 font-sans">
                  <span className="font-semibold text-white">{match.homeTeam}</span>
                  <span className="mx-2 text-slate-600">vs</span>
                  <span className="font-semibold text-white">{match.awayTeam}</span>
                  <span className="ml-3 text-slate-500 font-mono text-[10px]">
                    {new Date(match.kickoffTime).toLocaleDateString()}
                  </span>
                </div>
                {pred && (
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                      pred.submitted
                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {pred.submitted ? `Locked: ${pred.home}–${pred.away}` : "Not locked"}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
