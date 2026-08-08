import React from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { Lock, Trophy, Zap, Target, X } from "lucide-react";
import { getChip } from "../../constants/chips";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";

interface ChipModalProps {
  /** Id of the chip to display (see src/constants/chips.ts). */
  chipId: string | null;
  onClose: () => void;
}

interface DetailRow {
  label: string;
  value: string;
  icon: React.ReactNode;
}

/**
 * Reusable, game-styled pop-up explaining a single chip. Rendered from
 * both the Match Predictor wallet and the Rules page so the explanation is
 * always identical. Portaled to document.body so `fixed` is viewport-relative
 * (RulesInfo uses overflow/blur which would otherwise trap the overlay).
 */
export default function ChipModal({ chipId, onClose }: ChipModalProps) {
  const chip = chipId ? getChip(chipId) : undefined;
  useBodyScrollLock(!!chip);

  if (!chip) return null;

  const Icon = chip.icon;
  const { theme } = chip;

  const rows: DetailRow[] = [
    {
      label: "How to Earn",
      value: chip.howToEarn,
      icon: <Trophy className="h-4 w-4" />,
    },
    {
      label: "How to Use",
      value: chip.howToUse,
      icon: <Target className="h-4 w-4" />,
    },
    {
      label: "Game Impact",
      value: chip.gameImpact,
      icon: <Zap className="h-4 w-4" />,
    },
  ];

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="chip-modal-title"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 16 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
        className={`relative w-full max-w-md max-h-[90dvh] overflow-y-auto overflow-x-hidden overscroll-contain rounded-2xl border ${theme.border} bg-slate-900/95 shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top accent bar */}
        <div className="h-1 w-full bg-linear-to-r from-blue-500 via-green-500 to-red-500" />

        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 sm:top-4 z-10 rounded-lg p-1.5 text-slate-500 hover:bg-slate-800 hover:text-slate-200 transition-colors cursor-pointer touch-manipulation"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative p-4 sm:p-6">
          {/* Hero icon */}
          <div className="relative mb-3 sm:mb-4 flex items-center gap-3 sm:gap-4">
            <div className={`pointer-events-none absolute -left-6 -top-6 h-32 w-32 rounded-full blur-3xl ${theme.glow}`} />
            <div className={`relative flex h-12 w-12 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-2xl border ${theme.border} ${theme.bg}`}>
              <Icon className={`h-6 w-6 sm:h-8 sm:w-8 ${theme.iconText}`} />
            </div>
            <div className="relative min-w-0">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500">
                Chip
              </span>
              <h2
                id="chip-modal-title"
                className={`text-lg sm:text-xl font-extrabold font-display tracking-tight ${theme.accentText}`}
              >
                {chip.name}
              </h2>
            </div>
          </div>

          <p className="mb-5 text-sm leading-relaxed text-slate-300">
            {chip.description}
          </p>

          <div className="space-y-2.5">
            {rows.map((row) => (
              <div
                key={row.label}
                className="rounded-xl border border-slate-800 bg-slate-950/50 p-3.5"
              >
                <div className={`mb-1 flex items-center gap-1.5 ${theme.iconText}`}>
                  {row.icon}
                  <span className="text-[10px] font-mono font-bold uppercase tracking-widest">
                    {row.label}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-slate-400">{row.value}</p>
              </div>
            ))}
          </div>

          {/* Season-scoped lifecycle footer */}
          <div className="mt-5 space-y-2">
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3.5">
              <div className="mb-1 flex items-center gap-1.5 text-slate-400">
                <Lock className="h-4 w-4" />
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest">
                  Season Expiry
                </span>
              </div>
              <p className="text-xs leading-relaxed text-slate-400">
                Chips are scoped to a sport season. When that season is no longer active,
                remaining chips expire automatically and cannot be carried over.
              </p>
            </div>
            {chip.notes && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5 text-xs text-amber-200/90 leading-relaxed">
                {chip.notes}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
