import React, { useEffect, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import CompetitionFilterRail, {
  type NationFilterOption,
} from "./CompetitionFilterRail";

type Props = {
  options: NationFilterOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
};

/**
 * Mobile-only floating nation filter (above bottom nav).
 * Sliders FAB expands a vertical stack of consolidated national flags.
 */
export default function MobileFilterFab({
  options,
  selectedIds,
  onChange,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  const activeCount = selectedIds.length;

  return (
    <div className="md:hidden">
      {isOpen ? (
        <button
          type="button"
          aria-label="Close filters"
          className="fixed inset-0 z-40 cursor-default bg-transparent"
          onClick={() => setIsOpen(false)}
        />
      ) : null}

      <div className="fixed bottom-24 right-4 z-50 flex flex-col items-center gap-2">
        {isOpen ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-slate-700/80 bg-slate-950/95 p-2 shadow-xl shadow-black/50 backdrop-blur-md">
            <CompetitionFilterRail
              options={options}
              selectedIds={selectedIds}
              onChange={onChange}
              tooltipSide="left"
              showAllButton
            />
          </div>
        ) : null}

        <button
          type="button"
          aria-label={isOpen ? "Close filters" : "Open filters"}
          aria-expanded={isOpen}
          onClick={() => setIsOpen((o) => !o)}
          className="relative flex h-12 w-12 items-center justify-center rounded-full border-2 border-emerald-400/70 bg-slate-950 text-emerald-300 shadow-[0_0_18px_rgba(52,211,153,0.35)] cursor-pointer"
        >
          <SlidersHorizontal className="h-5 w-5" aria-hidden />
          {!isOpen && activeCount > 0 ? (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[9px] font-mono font-bold text-slate-950">
              {activeCount}
            </span>
          ) : null}
        </button>
      </div>
    </div>
  );
}
