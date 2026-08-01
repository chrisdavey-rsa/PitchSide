/**
 * Sticky feed filters: All / Football / Rugby + coming-soon teasers + unmade toggle.
 */
import React from "react";
import { Lock } from "lucide-react";
import { SportIcon } from "../../sports/emerging/sportIcons";
import type { SportKey } from "../../sports/emerging/types";

export type FeedSportFilter = "all" | "football" | "rugby";

type Props = {
  sportFilter: FeedSportFilter;
  onSportFilterChange: (filter: FeedSportFilter) => void;
  onlyUnmade: boolean;
  onOnlyUnmadeChange: (value: boolean) => void;
  className?: string;
};

const CORE: { key: FeedSportFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "football", label: "Football" },
  { key: "rugby", label: "Rugby" },
];

const TEASERS: { key: SportKey; label: string }[] = [
  { key: "formula1", label: "F1" },
  { key: "golf", label: "Golf" },
];

export default function PredictionsFeedFilter({
  sportFilter,
  onSportFilterChange,
  onlyUnmade,
  onOnlyUnmadeChange,
  className = "",
}: Props) {
  return (
    <div
      className={`sticky top-0 z-30 space-y-2 rounded-xl border border-slate-800 bg-slate-950/90 backdrop-blur-md p-2 shadow-lg shadow-black/20 ${className}`}
      data-no-swipe="true"
    >
      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
        {CORE.map(({ key, label }) => {
          const active = sportFilter === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSportFilterChange(key)}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-semibold font-display tracking-wide border transition-colors cursor-pointer ${
                active
                  ? key === "football"
                    ? "bg-blue-500/20 text-blue-100 border-blue-500/40"
                    : key === "rugby"
                      ? "bg-amber-500/20 text-amber-100 border-amber-500/40"
                      : "bg-emerald-500/20 text-emerald-100 border-emerald-500/40"
                  : "bg-slate-900/60 text-slate-400 border-slate-800 hover:border-slate-600 hover:text-slate-200"
              }`}
            >
              {key !== "all" && (
                <SportIcon sport={key} className="h-3.5 w-3.5" />
              )}
              {label}
            </button>
          );
        })}
        {TEASERS.map(({ key, label }) => (
          <span
            key={key}
            title="Coming soon"
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-semibold font-display tracking-wide border border-slate-800/80 bg-slate-900/40 text-slate-600 cursor-not-allowed opacity-70"
          >
            <Lock className="h-3 w-3" />
            <SportIcon sport={key} className="h-3.5 w-3.5 opacity-60" />
            {label}
            <span className="text-[8px] font-mono uppercase tracking-wider text-slate-600">
              Soon
            </span>
          </span>
        ))}
      </div>

      <label className="flex items-center justify-between gap-3 px-1 cursor-pointer select-none">
        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
          Only show unmade picks
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={onlyUnmade}
          onClick={() => onOnlyUnmadeChange(!onlyUnmade)}
          className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors cursor-pointer ${
            onlyUnmade
              ? "bg-emerald-500/30 border-emerald-400/50"
              : "bg-slate-800 border-slate-700"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
              onlyUnmade ? "translate-x-[1.35rem]" : "translate-x-0"
            }`}
          />
        </button>
      </label>
    </div>
  );
}
