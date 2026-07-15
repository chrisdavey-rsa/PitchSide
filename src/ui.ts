/**
 * Shared button style tokens so the pop-up screens (Leagues, Account, Rules)
 * use one consistent button design language.
 *
 * Compose with sizing utilities as needed, e.g.
 *   `${btnPrimary} flex-1 py-2 text-xs`
 */

/** Emerald filled call-to-action. */
export const btnPrimary =
  "bg-emerald-500 hover:bg-emerald-600 text-white font-bold font-mono rounded-lg transition-colors cursor-pointer shadow-[0_4px_12px_rgba(16,185,129,0.25)] disabled:opacity-50 disabled:cursor-not-allowed";

/** Neutral slate secondary / cancel action. */
export const btnSecondary =
  "bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";

/** Circular close (X) button used in every modal header. */
export const btnClose =
  "text-slate-400 hover:text-white bg-slate-800/70 hover:bg-slate-800 p-2 rounded-full transition-colors cursor-pointer shrink-0";
