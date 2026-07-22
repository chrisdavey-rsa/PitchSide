import React, { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Lock } from "lucide-react";
import PitchSideMark from "../PitchSideMark";

interface LockGuessButtonProps {
  /** Whether this prediction has already been locked in. */
  submitted: boolean;
  /** Disables interaction (e.g. email not verified). */
  disabled?: boolean;
  onClick: () => void;
  id?: string;
}

/**
 * Football / Rugby submit control — centred PitchSide "P." mark.
 * On lock, the mark briefly morphs to a padlock, then settles green with P.
 */
export default function LockGuessButton({
  submitted,
  disabled = false,
  onClick,
  id,
}: LockGuessButtonProps) {
  const [locking, setLocking] = useState(false);
  const showLock = submitted || locking;

  const handleClick = () => {
    if (disabled || submitted) return;
    setLocking(true);
    onClick();
  };

  return (
    <motion.button
      id={id}
      type="button"
      aria-label={showLock ? "Prediction locked" : "Confirm picks"}
      onClick={handleClick}
      disabled={disabled || submitted}
      whileTap={disabled || submitted ? undefined : { scale: 0.96 }}
      className={`group relative w-full sm:w-auto overflow-hidden px-5 py-3 rounded-xl flex items-center justify-center transition-colors duration-300 ${
        showLock
          ? "bg-emerald-500 border-2 border-emerald-400 shadow-[0_0_18px_rgba(16,185,129,0.45)] cursor-default"
          : "bg-slate-950/60 border-2 border-emerald-500/40 hover:border-emerald-400 cursor-pointer shadow-md shadow-emerald-500/10"
      }`}
    >
      <span className="relative flex h-7 w-7 items-center justify-center">
        <AnimatePresence mode="popLayout" initial={false}>
          {showLock && locking && !submitted ? (
            <motion.span
              key="lock"
              initial={{ scale: 0.2, rotate: -35, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              exit={{ scale: 0.2, rotate: 35, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 20 }}
              className="absolute inset-0 flex items-center justify-center text-slate-950"
            >
              <Lock className="h-5 w-5 stroke-[2.5]" />
            </motion.span>
          ) : (
            <motion.span
              key="p"
              initial={{ scale: 0.2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.2, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 20 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <PitchSideMark size={28} className="rounded-lg" />
            </motion.span>
          )}
        </AnimatePresence>
      </span>

      {!showLock && (
        <span className="pointer-events-none absolute inset-0 -translate-x-[150%] bg-linear-to-r from-transparent via-emerald-400/25 to-transparent group-hover:animate-[shimmer_0.8s_ease-in-out_1]" />
      )}
    </motion.button>
  );
}
