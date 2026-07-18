import React from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { X, Trophy, Zap, Target, Lock } from "lucide-react";
import { getPowerUp } from "../../data/powerUps";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";

interface PowerUpModalProps {
  /** Id of the power-up to display (see src/data/powerUps.ts). */
  powerUpId: string | null;
  onClose: () => void;
}

interface DetailRow {
  label: string;
  value: string;
  icon: React.ReactNode;
}

/**
 * Reusable, game-styled pop-up explaining a single power-up chip. Rendered from
 * both the Match Predictor wallet and the Rules page so the explanation is
 * always identical. Portaled to document.body so `fixed` is viewport-relative
 * (RulesInfo uses overflow/blur which would otherwise trap the overlay).
 */
export default function PowerUpModal({ powerUpId, onClose }: PowerUpModalProps) {
  const powerUp = powerUpId ? getPowerUp(powerUpId) : undefined;
  useBodyScrollLock(!!powerUp);

  if (!powerUp) return null;

  const Icon = powerUp.icon;
  const { theme } = powerUp;

  const rows: DetailRow[] = [
    {
      label: "How to Earn",
      value: powerUp.howToEarn,
      icon: <Trophy className="h-4 w-4" />,
    },
    {
      label: "How to Use",
      value: powerUp.howToUse,
      icon: <Target className="h-4 w-4" />,
    },
    {
      label: "Game Impact",
      value: powerUp.gameImpact,
      icon: <Zap className="h-4 w-4" />,
    },
  ];

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="power-up-modal-title"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 16 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
        className={`relative w-full max-w-md max-h-[min(90dvh,40rem)] overflow-y-auto overflow-x-hidden rounded-2xl border ${theme.border} bg-slate-900/95 shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top accent bar */}
        <div className="h-1 w-full bg-linear-to-r from-blue-500 via-green-500 to-red-500" />

        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-4 z-10 rounded-lg p-1.5 text-slate-500 hover:bg-slate-800 hover:text-slate-200 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative p-6">
          {/* Hero icon */}
          <div className="relative mb-4 flex items-center gap-4">
            <div className={`pointer-events-none absolute -left-6 -top-6 h-32 w-32 rounded-full blur-3xl ${theme.glow}`} />
            <div className={`relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border ${theme.border} ${theme.bg}`}>
              <Icon className={`h-8 w-8 ${theme.iconText}`} />
            </div>
            <div className="relative min-w-0">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500">
                Power-Up Chip
              </span>
              <h2
                id="power-up-modal-title"
                className={`text-xl font-extrabold font-display tracking-tight ${theme.accentText}`}
              >
                {powerUp.name}
              </h2>
            </div>
          </div>

          <p className="mb-5 text-sm leading-relaxed text-slate-300">
            {powerUp.description}
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

          {/* Dormant status footer */}
          <div className="mt-5 flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-950/60 py-2.5 text-slate-500">
            <Lock className="h-3.5 w-3.5" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest">
              Deploy coming soon
            </span>
          </div>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
