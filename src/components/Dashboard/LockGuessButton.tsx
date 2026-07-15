import React, { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Lock } from "lucide-react";

interface LockGuessButtonProps {
  /** Whether this prediction has already been locked in. */
  submitted: boolean;
  /** Disables interaction (e.g. email not verified). */
  disabled?: boolean;
  onClick: () => void;
  id?: string;
}

/**
 * The "Lock Guess" submit control.
 *
 * Idle state shows a stylized PitchSide "P." mark. On click the "P" morphs
 * smoothly into a closed padlock to signal the prediction is being locked.
 * Once `submitted` is true the button settles into a solid green, padlocked
 * state to reinforce that the guess is committed.
 */
export default function LockGuessButton({
  submitted,
  disabled = false,
  onClick,
  id,
}: LockGuessButtonProps) {
  // Locally track the click so the morph plays even before the parent state
  // round-trips back through props.
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
      onClick={handleClick}
      disabled={disabled || submitted}
      whileTap={disabled || submitted ? undefined : { scale: 0.96 }}
      className={`group relative w-full sm:w-auto overflow-hidden font-bold font-display uppercase text-xs px-5 py-3 rounded-xl flex items-center justify-center gap-2 transition-colors duration-300 ${
        showLock
          ? "bg-emerald-500 border-2 border-emerald-400 text-slate-950 shadow-[0_0_18px_rgba(16,185,129,0.45)] cursor-default"
          : "bg-slate-950/60 border-2 border-emerald-500/40 text-emerald-300 hover:border-emerald-400 hover:text-emerald-200 cursor-pointer shadow-md shadow-emerald-500/10"
      }`}
    >
      {/* Morphing glyph: PitchSide "P." <-> closed padlock */}
      <span className="relative flex h-4 w-4 items-center justify-center">
        <AnimatePresence mode="popLayout" initial={false}>
          {showLock ? (
            <motion.span
              key="lock"
              initial={{ scale: 0.2, rotate: -35, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              exit={{ scale: 0.2, rotate: 35, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 20 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <Lock className="h-4 w-4 stroke-[2.5]" />
            </motion.span>
          ) : (
            <motion.span
              key="p"
              initial={{ scale: 0.2, rotate: 35, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              exit={{ scale: 0.2, rotate: -35, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 20 }}
              className="absolute inset-0 flex items-center justify-center font-display font-black leading-none"
            >
              <span className="relative text-base leading-none tracking-tighter">
                P
                <span className="absolute -bottom-0.5 -right-1 h-1 w-1 rounded-full bg-emerald-400 shadow-[0_0_4px_rgba(16,185,129,0.9)]" />
              </span>
            </motion.span>
          )}
        </AnimatePresence>
      </span>

      <span className="relative z-10">
        {showLock ? "Locked" : "Lock Guess"}
      </span>

      {/* One-shot shimmer sweep while idle. */}
      {!showLock && (
        <span className="pointer-events-none absolute inset-0 -translate-x-[150%] bg-linear-to-r from-transparent via-emerald-400/25 to-transparent group-hover:animate-[shimmer_0.8s_ease-in-out_1]" />
      )}
    </motion.button>
  );
}
