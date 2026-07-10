/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { motion } from "motion/react";
import { RotateCcw, Zap, Minus, Plus } from "lucide-react";
import { UserProfile, SportType } from "../../types";
import { getCompetitions } from "../../competitions";

interface MatchPredictorProps {
  user: UserProfile;
  selectedSport: SportType;
  selectedCompId: string | null;
  setSelectedCompId: (id: string) => void;
  // Note: Pass active matches, predictions, and save functions down from a custom hook in production
}

export default function MatchPredictor({
  user,
  selectedSport,
  selectedCompId,
  setSelectedCompId,
}: MatchPredictorProps) {
  const filteredCompetitions = getCompetitions().filter(
    (c) => c.sport === selectedSport
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
            {selectedSport === SportType.FOOTBALL
              ? "Football Leagues"
              : "Rugby Leagues"}{" "}
            Included
          </h3>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {filteredCompetitions.map((comp) => {
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
            </button>
          );
        })}
      </div>

      {!selectedCompId ? (
        <div className="text-center py-10 text-slate-500 font-sans text-xs">
          👈 Select one of the competitions above to load action items and configure score predictions.
        </div>
      ) : (
        <div className="mt-6 pt-5 border-t border-slate-800 space-y-4">
           {/* Replace this block with your mapping function that iterates over sortedActiveMatches 
               and renders the Home/Away plus and minus UI buttons */}
           <div className="text-center py-10 bg-slate-950/40 rounded-xl border border-slate-800 text-slate-400 text-xs">
               Map over Active Matches for {selectedCompId} here and render prediction inputs.
           </div>
        </div>
      )}
    </motion.div>
  );
}