import React, { useEffect, useMemo, useState } from "react";
import { Layers } from "lucide-react";
import CountryFlag from "../CountryFlag";
import {
  FILTER_NATIONS,
  getNationIdForCompetition,
  type FilterNation,
} from "../../constants/competitions";
import type { Match } from "../../types";

const STORAGE_KEY = "pitchside_nation_filter_v1";

export type NationFilterOption = {
  id: string;
  label: string;
  flagCode: string | null;
};

function loadStoredIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

/** Distinct nations present in the current fixture feed (fallback: all). */
export function nationsFromMatches(matches: Match[]): NationFilterOption[] {
  const present = new Set<string>();
  for (const m of matches) {
    const nationId = getNationIdForCompetition(m.competitionId);
    if (nationId) present.add(nationId);
  }
  const list = FILTER_NATIONS.filter((n) => present.has(n.id));
  return (list.length > 0 ? list : FILTER_NATIONS).map((n) => ({
    id: n.id,
    label: n.label,
    flagCode: n.flagCode,
  }));
}

function FlagTooltip({ label }: { label: string }) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md border border-slate-700/80 bg-slate-950 px-2 py-1 text-[10px] font-mono font-semibold text-slate-100 opacity-0 shadow-lg shadow-black/50 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
    >
      {label}
    </span>
  );
}

const BTN_BASE =
  "group relative flex h-7 w-7 items-center justify-center rounded-full border transition-all duration-200 cursor-pointer shrink-0";
const BTN_ACTIVE =
  "scale-105 opacity-100 border-emerald-400/70 bg-slate-950 ring-2 ring-emerald-400/80 shadow-[0_0_10px_rgba(52,211,153,0.22)]";
const BTN_IDLE =
  "opacity-50 border-slate-700/80 bg-slate-950/80 hover:opacity-100 hover:border-slate-500";

function NationFlagButton({
  nation,
  active,
  onToggle,
  tooltipSide = "right",
}: {
  nation: NationFilterOption;
  active: boolean;
  onToggle: () => void;
  tooltipSide?: "right" | "left";
}) {
  return (
    <button
      type="button"
      title={nation.label}
      aria-label={nation.label}
      aria-pressed={active}
      onClick={onToggle}
      className={`${BTN_BASE} overflow-hidden ${active ? BTN_ACTIVE : BTN_IDLE}`}
    >
      <CountryFlag
        code={nation.flagCode}
        alt={nation.label}
        size={16}
        className="rounded-sm"
      />
      <span
        role="tooltip"
        className={`pointer-events-none absolute top-1/2 z-50 -translate-y-1/2 whitespace-nowrap rounded-md border border-slate-700/80 bg-slate-950 px-2 py-1 text-[10px] font-mono font-semibold text-slate-100 opacity-0 shadow-lg shadow-black/50 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 ${
          tooltipSide === "right"
            ? "left-full ml-2"
            : "right-full mr-2"
        }`}
      >
        {nation.label}
      </span>
    </button>
  );
}

/**
 * Consolidated national-flag filter buttons (no duplicate competitions).
 * Parent supplies sticky / absolute positioning.
 */
export default function CompetitionFilterRail({
  options,
  selectedIds,
  onChange,
  tooltipSide = "right",
  showAllButton = true,
}: {
  options: NationFilterOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  tooltipSide?: "right" | "left";
  showAllButton?: boolean;
}) {
  const resolved =
    options.length > 0
      ? options
      : FILTER_NATIONS.map((n) => ({
          id: n.id,
          label: n.label,
          flagCode: n.flagCode,
        }));

  const toggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const showAll = selectedIds.length === 0;

  return (
    <>
      {showAllButton ? (
        <button
          type="button"
          title="All nations"
          aria-label="All nations"
          aria-pressed={showAll}
          onClick={() => onChange([])}
          className={`${BTN_BASE} ${showAll ? BTN_ACTIVE : BTN_IDLE}`}
        >
          <Layers className="h-3.5 w-3.5 text-emerald-300" aria-hidden />
          <FlagTooltip label="All nations" />
        </button>
      ) : null}

      {resolved.map((opt) => (
        <NationFlagButton
          key={opt.id}
          nation={opt}
          active={selectedIds.includes(opt.id)}
          onToggle={() => toggle(opt.id)}
          tooltipSide={tooltipSide}
        />
      ))}
    </>
  );
}

/** Persist nation filter selections across reloads. */
export function usePersistedCompetitionFilter(storageKey = STORAGE_KEY): [
  string[],
  React.Dispatch<React.SetStateAction<string[]>>,
] {
  const [selectedIds, setSelectedIds] = useState<string[]>(() => loadStoredIds());

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(selectedIds));
    } catch {
      /* ignore */
    }
  }, [selectedIds, storageKey]);

  return [selectedIds, setSelectedIds];
}

export function useCompetitionFilterOptions(matches: Match[]) {
  return useMemo(() => nationsFromMatches(matches), [matches]);
}

export type { FilterNation };
