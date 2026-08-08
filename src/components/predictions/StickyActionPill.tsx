/**
 * Mobile sticky shortcut: jump back to competitions, or open Chips
 * while scrolled deep into the fixture list.
 */
import React, { useEffect, useState } from "react";
import ChipSelector from "./ChipSelector";
import type {
  ChipId,
  ChipSportType,
  UserChipInstance,
} from "../../constants/chips";

type Props = {
  /** When true, the pill fades/slides into view. */
  visible: boolean;
  sportType: ChipSportType;
  instances: UserChipInstance[];
  assigningChipId?: ChipId | null;
  assignedChipIds?: ChipId[];
  hasOpenFixtures?: boolean;
  onSelectChip: (chipId: ChipId) => void;
};

export default function StickyActionPill({
  visible,
  sportType,
  instances,
  assigningChipId = null,
  assignedChipIds = [],
  hasOpenFixtures = true,
  onSelectChip,
}: Props) {
  const [isChipMenuOpen, setIsChipMenuOpen] = useState(false);
  const [menuEntered, setMenuEntered] = useState(false);

  useEffect(() => {
    if (!visible) setIsChipMenuOpen(false);
  }, [visible]);

  useEffect(() => {
    if (!isChipMenuOpen) {
      setMenuEntered(false);
      return;
    }
    const id = requestAnimationFrame(() => setMenuEntered(true));
    return () => cancelAnimationFrame(id);
  }, [isChipMenuOpen]);

  const scrollToCompetitions = () => {
    setIsChipMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!visible && !isChipMenuOpen) {
    return null;
  }

  return (
    <div className="md:hidden" data-no-swipe="true">
      {isChipMenuOpen && (
        <div
          className="fixed inset-0 z-40"
          aria-hidden
          onClick={() => setIsChipMenuOpen(false)}
        />
      )}

      <div
        className={`fixed left-1/2 z-50 -translate-x-1/2 transition-all duration-300 ease-out ${
          visible
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 -translate-y-3 pointer-events-none"
        }`}
        style={{ top: "max(1rem, env(safe-area-inset-top, 0px))" }}
      >
        <div className="relative">
          <div className="relative z-50 flex items-center overflow-hidden rounded-full border border-slate-700 bg-slate-800 shadow-2xl">
            <button
              type="button"
              onClick={scrollToCompetitions}
              className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold font-display uppercase tracking-wide text-slate-200 transition-colors hover:bg-slate-700/80 hover:text-white cursor-pointer"
              aria-label="Back to competitions"
            >
              Competitions
            </button>

            <span className="h-5 w-px shrink-0 bg-slate-600/80" aria-hidden />

            <button
              type="button"
              onClick={() => setIsChipMenuOpen((open) => !open)}
              className={`whitespace-nowrap px-4 py-2.5 text-[10px] font-bold font-display uppercase tracking-wide transition-colors cursor-pointer ${
                isChipMenuOpen
                  ? "bg-violet-500/20 text-violet-100"
                  : "text-slate-200 hover:bg-slate-700/80 hover:text-white"
              }`}
              aria-label="Open chips"
              aria-expanded={isChipMenuOpen}
            >
              Chips
            </button>
          </div>

          {isChipMenuOpen && (
            <div
              role="dialog"
              aria-label="Chips"
              className={`absolute top-full left-1/2 z-50 mt-2 w-[92vw] max-w-sm origin-top rounded-xl border border-slate-700/50 bg-slate-900/85 p-2 shadow-2xl backdrop-blur-md transition-all duration-150 ease-out ${
                menuEntered
                  ? "-translate-x-1/2 translate-y-0 scale-100 opacity-100"
                  : "-translate-x-1/2 -translate-y-2.5 scale-95 opacity-0"
              }`}
            >
              {/* Caret under the Chips half of the centred pill */}
              <div
                aria-hidden
                className="absolute -top-1.5 right-[20%] h-3 w-3 rotate-45 border-l border-t border-slate-700/50 bg-slate-900/85 backdrop-blur-md"
              />
              <ChipSelector
                sportType={sportType}
                instances={instances}
                assigningChipId={assigningChipId}
                assignedChipIds={assignedChipIds}
                hasOpenFixtures={hasOpenFixtures}
                showHeader={false}
                isCompact
                onSelect={(chipId) => {
                  onSelectChip(chipId);
                  setIsChipMenuOpen(false);
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
