import React from "react";
import { ChevronRight } from "lucide-react";
import SportTileGraphic from "./SportTileGraphic";

type SportKey = "football" | "rugby";

interface SportEntryTileProps {
  id: string;
  sport: SportKey;
  selected: boolean;
  onSelect: () => void;
}

const TILE_CONFIG = {
  football: {
    title: "FOOTBALL",
    description:
      "Predict goal lines across Premier League, Champions League, Europa rosters and FIFA divisions.",
    cta: "Choose Football leagues",
    titleHover: "group-hover:text-blue-300",
    ctaColor: "text-blue-400",
    selected:
      "bg-blue-950/40 border-blue-500 shadow-[0_0_24px_rgba(59,130,246,0.35)]",
    ambientSelected: "bg-blue-500 opacity-30",
    ambientHover: "bg-slate-500 group-hover:bg-blue-500",
  },
  rugby: {
    title: "RUGBY",
    description:
      "Predict winning score margins across Six Nations, Heineken, Top 14, and Rugby Worlds brackets.",
    cta: "Choose Rugby leagues",
    titleHover: "group-hover:text-amber-300",
    ctaColor: "text-amber-400",
    selected:
      "bg-amber-950/40 border-amber-500 shadow-[0_0_24px_rgba(245,158,11,0.35)]",
    ambientSelected: "bg-amber-500 opacity-30",
    ambientHover: "bg-slate-500 group-hover:bg-amber-500",
  },
} as const;

export default function SportEntryTile({
  id,
  sport,
  selected,
  onSelect,
}: SportEntryTileProps) {
  const config = TILE_CONFIG[sport];

  return (
    <div
      id={id}
      onClick={onSelect}
      className={`relative rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 border-2 transition-all duration-300 overflow-hidden cursor-pointer group h-full min-h-[180px] md:min-h-[220px] ${
        selected
          ? config.selected
          : "bg-slate-900/50 border-slate-800 hover:border-slate-700 hover:shadow-lg shadow-sm"
      }`}
    >
      <div
        className={`absolute -right-12 -bottom-12 w-48 h-48 rounded-full blur-3xl opacity-20 transition-all pointer-events-none ${
          selected ? config.ambientSelected : config.ambientHover
        }`}
      />

      {/* Mobile: centered title → icon → CTA */}
      <div className="relative z-10 flex md:hidden flex-col items-center text-center h-full">
        <h2
          className={`text-lg font-extrabold font-display text-white transition-colors w-full ${config.titleHover}`}
        >
          {config.title}
        </h2>

        <div className="flex-1 flex items-center justify-center w-full py-3">
          <SportTileGraphic sport={sport} />
        </div>

        <div
          className={`flex items-center justify-center gap-1.5 font-mono text-[10px] w-full ${config.ctaColor}`}
        >
          <span>{config.cta}</span>
          <ChevronRight className="w-4 h-4 shrink-0" />
        </div>
      </div>

      {/* Desktop: title + description left, icon right, CTA at bottom */}
      <div className="relative z-10 hidden md:flex flex-col justify-between h-full min-h-[220px]">
        <div className="flex justify-between items-start gap-2">
          <div className="space-y-1 min-w-0 flex-1">
            <h2
              className={`text-3xl font-extrabold font-display text-white transition-colors ${config.titleHover}`}
            >
              {config.title}
            </h2>
            <p className="text-slate-400 text-xs max-w-xs pt-1 font-sans">
              {config.description}
            </p>
          </div>

          <SportTileGraphic sport={sport} className="w-14 h-14" />
        </div>

        <div
          className={`flex items-center gap-1.5 mt-6 font-mono text-xs ${config.ctaColor} group-hover:translate-x-1 transition-transform`}
        >
          <span>{config.cta}</span>
          <ChevronRight className="w-4 h-4 shrink-0" />
        </div>
      </div>
    </div>
  );
}
