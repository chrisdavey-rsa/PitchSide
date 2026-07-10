import React, { useState } from "react";
import { motion } from "motion/react";
import { ChevronRight } from "lucide-react";
import { SportType } from "../../types";
import { getCompetitions } from "../../competitions";

interface SportTilesProps {
  selectedSport: SportType | null;
  setSelectedSport: (sport: SportType) => void;
  setSelectedCompId: (id: string | null) => void;
}

export default function SportTiles({ selectedSport, setSelectedSport, setSelectedCompId }: SportTilesProps) {
  const [fbHover, setFbHover] = useState(false);
  const [rbHover, setRbHover] = useState(false);

  const handleSportSelect = (sport: SportType) => {
    setSelectedSport(sport);
    const comps = getCompetitions().filter((c) => c.sport === sport);
    setSelectedCompId(comps.length > 0 ? comps[0].id : null);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">

      {/* Football Tile */}
      <div
        onClick={() => handleSportSelect(SportType.FOOTBALL)}
        onMouseEnter={() => setFbHover(true)}
        onMouseLeave={() => setFbHover(false)}
        className={`relative rounded-3xl p-8 border-2 transition-all duration-300 overflow-hidden cursor-pointer flex flex-col justify-between group min-h-[220px] ${
          selectedSport === SportType.FOOTBALL
            ? "bg-blue-950/40 border-blue-500 shadow-[0_0_24px_rgba(59,130,246,0.35)]"
            : "bg-slate-900/50 border-slate-800 hover:border-slate-700 hover:shadow-lg shadow-sm"
        }`}
      >
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <h2 className="text-3xl font-extrabold font-display text-white group-hover:text-blue-300 transition-colors">
              FOOTBALL
            </h2>
            <p className="text-slate-400 text-xs max-w-xs pt-1 font-sans">
              Predict goal lines across top global rosters and divisions.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 mt-6 font-mono text-xs text-blue-400 group-hover:translate-x-1 transition-transform">
          <span>Choose Football leagues</span>
          <ChevronRight className="w-4 h-4" />
        </div>
      </div>

      {/* Rugby Tile */}
      <div
        onClick={() => handleSportSelect(SportType.RUGBY)}
        onMouseEnter={() => setRbHover(true)}
        onMouseLeave={() => setRbHover(false)}
        className={`relative rounded-3xl p-8 border-2 transition-all duration-300 overflow-hidden cursor-pointer flex flex-col justify-between group min-h-[220px] ${
          selectedSport === SportType.RUGBY
            ? "bg-amber-950/40 border-amber-500 shadow-[0_0_24px_rgba(245,158,11,0.35)]"
            : "bg-slate-900/50 border-slate-800 hover:border-slate-700 hover:shadow-lg shadow-sm"
        }`}
      >
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <h2 className="text-3xl font-extrabold font-display text-white group-hover:text-amber-300 transition-colors">
              RUGBY
            </h2>
            <p className="text-slate-400 text-xs max-w-xs pt-1 font-sans">
              Predict winning score margins across global tournaments.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 mt-6 font-mono text-xs text-amber-400 group-hover:translate-x-1 transition-transform">
          <span>Choose Rugby leagues</span>
          <ChevronRight className="w-4 h-4" />
        </div>
      </div>

    </div>
  );
}