import React from "react";
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
  className?: string;
}

/**
 * Football / Rugby submit control — centred PitchSide "P." mark.
 * Visual lock state follows `submitted` only (cancel on confirm must not flip the icon).
 */
export default function LockGuessButton({
  submitted,
  disabled = false,
  onClick,
  id,
  className = "",
}: LockGuessButtonProps) {
  const handleClick = () => {
    if (disabled || submitted) return;
    onClick();
  };

  return (
    <motion.button
      id={id}
      type="button"
      aria-label={submitted ? "Prediction locked" : "Confirm picks"}
      onClick={handleClick}
      disabled={disabled || submitted}
      whileTap={disabled || submitted ? undefined : { scale: 0.96 }}
      className={`group relative overflow-hidden flex items-center justify-center transition-colors duration-300 h-6 sm:h-9 rounded-md border sm:rounded-lg sm:border-2 ${
        submitted
          ? "bg-emerald-500 border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.4)] sm:shadow-[0_0_18px_rgba(16,185,129,0.45)] cursor-default"
          : "bg-slate-950/60 border-emerald-500/40 hover:border-emerald-400 cursor-pointer shadow-md shadow-emerald-500/10"
      } ${className}`}
    >
      <span className="relative flex h-4 w-4 sm:h-6 sm:w-6 items-center justify-center">
        <AnimatePresence mode="popLayout" initial={false}>
          {submitted ? (
            <motion.span
              key="lock"
              initial={{ scale: 0.2, rotate: -35, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              exit={{ scale: 0.2, rotate: 35, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 20 }}
              className="absolute inset-0 flex items-center justify-center text-slate-950"
            >
              <Lock className="h-3.5 w-3.5 sm:h-5 sm:w-5 stroke-[2.5]" />
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
              <PitchSideMark
                size={24}
                className="h-4 w-4 rounded-md sm:h-6 sm:w-6 sm:rounded-lg"
              />
            </motion.span>
          )}
        </AnimatePresence>
      </span>

      {!submitted && (
        <span className="pointer-events-none absolute inset-0 -translate-x-[150%] bg-linear-to-r from-transparent via-emerald-400/25 to-transparent group-hover:animate-[shimmer_0.8s_ease-in-out_1]" />
      )}
    </motion.button>
  );
}
