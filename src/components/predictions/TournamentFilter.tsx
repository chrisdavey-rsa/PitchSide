/**
 * Mobile tournament filter — Speed Dial FAB above the bottom nav.
 * Desktop tournament flags stay on VerticalLeaguePills (hidden md:flex rail).
 */
import React, { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Layers, Plus, SlidersHorizontal, X } from "lucide-react";
import CompetitionGlyph from "./CompetitionGlyph";
import { useOnClickOutside } from "../../hooks/useOnClickOutside";
import {
  ALL_LEAGUES_PILL_ID,
  type VerticalPillItem,
} from "../Dashboard/VerticalLeaguePills";

type Props = {
  items: VerticalPillItem[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onAddClick: () => void;
};

const FAB_BTN =
  "relative flex h-11 w-11 items-center justify-center rounded-full border transition-all duration-200 cursor-pointer shrink-0 shadow-lg shadow-black/40";
const FAB_ACTIVE =
  "scale-105 border-emerald-400/70 bg-slate-950 ring-2 ring-emerald-400/70";
const FAB_IDLE =
  "border-slate-600/80 bg-slate-950/95 opacity-90 hover:opacity-100 hover:border-slate-400";

export default function TournamentFilter({
  items,
  selectedId,
  onSelect,
  onAddClick,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useOnClickOutside(rootRef, () => setOpen(false), open);

  const allActive =
    selectedId == null || selectedId === ALL_LEAGUES_PILL_ID;

  const closeAnd = (fn: () => void) => {
    fn();
    setOpen(false);
  };

  return (
    <div className="md:hidden">
      {open ? (
        <button
          type="button"
          aria-label="Dismiss tournament filter"
          className="fixed inset-0 z-40 cursor-default bg-slate-950/40 backdrop-blur-[1px]"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <div
        ref={rootRef}
        data-tour="tour-league-pills-mobile"
        className="fixed bottom-24 right-4 z-50 flex flex-col-reverse items-center gap-2.5"
        aria-label="Tournament filter"
      >
        <button
          type="button"
          aria-label={open ? "Close tournament filter" : "Open tournament filter"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={`${FAB_BTN} h-12 w-12 border-2 border-emerald-400/70 bg-slate-950 text-emerald-300 shadow-[0_0_18px_rgba(52,211,153,0.35)]`}
        >
          <AnimatePresence mode="wait" initial={false}>
            {open ? (
              <motion.span
                key="close"
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <X className="h-5 w-5" aria-hidden />
              </motion.span>
            ) : (
              <motion.span
                key="filter"
                initial={{ rotate: 90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: -90, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <SlidersHorizontal className="h-5 w-5" aria-hidden />
              </motion.span>
            )}
          </AnimatePresence>
          {!open && selectedId ? (
            <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-950" />
          ) : null}
        </button>

        <AnimatePresence>
          {open ? (
            <motion.div
              key="dial"
              role="tablist"
              aria-label="Subscribed tournaments"
              className="flex flex-col items-center gap-2.5"
              initial="closed"
              animate="open"
              exit="closed"
              variants={{
                open: {
                  transition: { staggerChildren: 0.045 },
                },
                closed: {
                  transition: { staggerChildren: 0.03, staggerDirection: -1 },
                },
              }}
            >
              <motion.button
                type="button"
                role="tab"
                aria-selected={allActive}
                title="All subscribed"
                variants={{
                  open: { opacity: 1, y: 0, scale: 1 },
                  closed: { opacity: 0, y: 12, scale: 0.85 },
                }}
                onClick={() => closeAnd(() => onSelect(null))}
                className={`${FAB_BTN} ${allActive ? FAB_ACTIVE : FAB_IDLE} text-slate-200`}
              >
                <Layers className="h-4 w-4" aria-hidden />
              </motion.button>

              {items.map((item) => {
                const active = selectedId === item.id;
                return (
                  <motion.button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    title={item.label}
                    aria-label={item.label}
                    variants={{
                      open: { opacity: 1, y: 0, scale: 1 },
                      closed: { opacity: 0, y: 12, scale: 0.85 },
                    }}
                    onClick={() => closeAnd(() => onSelect(item.id))}
                    className={`${FAB_BTN} ${active ? FAB_ACTIVE : FAB_IDLE}`}
                  >
                    <CompetitionGlyph
                      competitionId={item.id}
                      flagCode={item.flagCode}
                      alt={item.label}
                      size={18}
                      className="rounded-sm"
                    />
                  </motion.button>
                );
              })}

              <motion.button
                type="button"
                title="Add tournament"
                aria-label="Add tournament"
                variants={{
                  open: { opacity: 1, y: 0, scale: 1 },
                  closed: { opacity: 0, y: 12, scale: 0.85 },
                }}
                onClick={() => closeAnd(onAddClick)}
                className={`${FAB_BTN} border-dashed border-slate-500 bg-slate-950/90 text-slate-300 hover:border-emerald-500/50 hover:text-emerald-300`}
              >
                <Plus className="h-4 w-4" aria-hidden />
              </motion.button>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
