import React from "react";
import { Layers, Plus } from "lucide-react";
import CompetitionGlyph from "../predictions/CompetitionGlyph";
import {
  getCompetitionFlagCode,
  getCompetitionTitle,
} from "../../constants/competitions";
import { type GolfCoverageTier } from "../../constants/golfCoverage";

/** Sentinel id for the "All subscribed leagues" pill. */
export const ALL_LEAGUES_PILL_ID = "__all__";

export type VerticalPillItem = {
  id: string;
  label: string;
  flagCode: string | null;
  sport: "football" | "rugby" | "golf";
};

type VerticalLeaguePillsProps = {
  items: VerticalPillItem[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onAddClick: () => void;
  className?: string;
  orientation?: "vertical" | "horizontal";
};

export function buildPillItems(
  subscribedLeagues: readonly string[],
  _golfTier?: GolfCoverageTier | null,
): VerticalPillItem[] {
  const items: VerticalPillItem[] = [];
  const seen = new Set<string>();

  for (const id of subscribedLeagues) {
    if (!id || seen.has(id)) continue;
    if (id.startsWith("g-") || id.startsWith("f1-")) continue;
    seen.add(id);

    const sport = id.startsWith("r-") ? "rugby" : "football";
    items.push({
      id,
      label: getCompetitionTitle(id),
      flagCode: getCompetitionFlagCode(id),
      sport,
    });
  }

  return items;
}

const BTN =
  "group relative flex h-7 w-7 items-center justify-center rounded-full border transition-all duration-200 cursor-pointer shrink-0";
const BTN_ACTIVE =
  "scale-105 opacity-100 border-emerald-400/70 bg-slate-950 ring-2 ring-emerald-400/80 shadow-[0_0_10px_rgba(52,211,153,0.22)]";
const BTN_IDLE =
  "opacity-60 border-slate-700/80 bg-slate-950/80 hover:opacity-100 hover:border-slate-500";

/**
 * Compact subscribed-league pill rail: All → subscribed flags → +.
 * Desktop: vertical. Mobile: horizontal scrolling row.
 */
export default function VerticalLeaguePills({
  items,
  selectedId,
  onSelect,
  onAddClick,
  className = "",
  orientation = "vertical",
}: VerticalLeaguePillsProps) {
  const allActive =
    selectedId == null || selectedId === ALL_LEAGUES_PILL_ID;

  return (
    <div
      className={
        orientation === "vertical"
          ? `flex flex-col items-center gap-2 shrink-0 ${className}`
          : `flex flex-row flex-nowrap items-center gap-2 shrink-0 w-full max-w-full overflow-x-auto overscroll-x-contain pb-0.5 ${className}`
      }
      role="tablist"
      aria-label="Subscribed tournaments"
    >
      <button
        type="button"
        role="tab"
        aria-selected={allActive}
        title="All subscribed"
        aria-label="All subscribed tournaments"
        onClick={() => onSelect(null)}
        className={`${BTN} ${allActive ? BTN_ACTIVE : BTN_IDLE}`}
      >
        <Layers className="w-3.5 h-3.5 text-slate-200" aria-hidden />
      </button>

      {items.map((item) => {
        const active = selectedId === item.id;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            title={item.label}
            aria-label={item.label}
            onClick={() => onSelect(item.id)}
            className={`${BTN} ${active ? BTN_ACTIVE : BTN_IDLE}`}
          >
            <CompetitionGlyph
              competitionId={item.id}
              flagCode={item.flagCode}
              alt={item.label}
              size={16}
              className="rounded-sm"
            />
          </button>
        );
      })}

      <button
        type="button"
        onClick={onAddClick}
        title="Add tournament"
        aria-label="Add tournament"
        className={`${BTN} opacity-70 border-dashed border-slate-600 bg-slate-950/50 text-slate-300 hover:opacity-100 hover:border-emerald-500/50 hover:text-emerald-300`}
      >
        <Plus className="w-3.5 h-3.5" aria-hidden />
      </button>
    </div>
  );
}
