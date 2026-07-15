import React from "react";
import { motion } from "motion/react";
import {
  Target,
  Ruler,
  Trophy,
  LifeBuoy,
  Ban,
  Play,
  X,
} from "lucide-react";

type IntroSport = "football" | "rugby";

interface SportIntroModalProps {
  sport: IntroSport;
  onDismiss: () => void;
}

interface ScoringRow {
  points: string;
  title: string;
  desc: string;
  icon: React.ReactNode;
  accent: string;
}

const FOOTBALL_ROWS: ScoringRow[] = [
  {
    points: "5",
    title: "Exact Score",
    desc: "Nail the precise final scoreline.",
    icon: <Target className="h-4 w-4" />,
    accent: "text-emerald-400 bg-emerald-500/15",
  },
  {
    points: "3",
    title: "Correct Margin",
    desc: "Right outcome and goal margin.",
    icon: <Ruler className="h-4 w-4" />,
    accent: "text-blue-400 bg-blue-500/15",
  },
  {
    points: "2",
    title: "Correct Winner",
    desc: "Right result, wrong margin.",
    icon: <Trophy className="h-4 w-4" />,
    accent: "text-slate-300 bg-slate-500/20",
  },
];

const RUGBY_ROWS: ScoringRow[] = [
  {
    points: "5",
    title: "Exact Margin",
    desc: "Correct winner and exact winning margin.",
    icon: <Target className="h-4 w-4" />,
    accent: "text-emerald-400 bg-emerald-500/15",
  },
  {
    points: "3",
    title: "Within 7 Points",
    desc: "Correct winner, margin off by 7 or fewer.",
    icon: <Ruler className="h-4 w-4" />,
    accent: "text-amber-400 bg-amber-500/15",
  },
  {
    points: "1",
    title: "Within 10 Points",
    desc: "Correct winner, margin off by 10 or fewer.",
    icon: <Ruler className="h-4 w-4" />,
    accent: "text-slate-300 bg-slate-500/20",
  },
];

/**
 * Just-in-time onboarding modal shown the first time a player opens a Football
 * or Rugby competition. Explains the scoring brackets for that sport and the
 * sport-specific forgiveness rule (Football has Drops, Rugby does not).
 */
export default function SportIntroModal({ sport, onDismiss }: SportIntroModalProps) {
  const isFootball = sport === "football";
  const rows = isFootball ? FOOTBALL_ROWS : RUGBY_ROWS;

  const theme = isFootball
    ? {
        label: "FOOTBALL",
        accentText: "text-blue-300",
        glow: "bg-blue-500/20",
        ring: "border-blue-500/30",
        button: "bg-blue-500 hover:bg-blue-600",
        chip: "bg-blue-500/10 text-blue-300 border-blue-500/20",
      }
    : {
        label: "RUGBY",
        accentText: "text-amber-300",
        glow: "bg-amber-500/20",
        ring: "border-amber-500/30",
        button: "bg-amber-500 hover:bg-amber-600 text-slate-950",
        chip: "bg-amber-500/10 text-amber-300 border-amber-500/20",
      };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismiss();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 12 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
        className={`relative w-full max-w-md overflow-hidden rounded-2xl border ${theme.ring} bg-slate-900/95 shadow-2xl`}
      >
        {/* Top accent bar */}
        <div className="h-1 w-full bg-linear-to-r from-blue-500 via-green-500 to-red-500" />

        {/* Ambient glow */}
        <div className={`pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl ${theme.glow}`} />

        <button
          type="button"
          onClick={onDismiss}
          className="absolute right-3 top-4 z-10 rounded-lg p-1.5 text-slate-500 hover:bg-slate-800 hover:text-slate-200 transition-colors cursor-pointer"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative p-6">
          <div className="mb-4">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-bold font-mono uppercase tracking-widest ${theme.chip}`}>
              {theme.label} • How Scoring Works
            </span>
            <h2 className="mt-3 text-xl font-extrabold font-display tracking-tight text-white">
              {isFootball ? "Predict the scoreline" : "Predict the margin"}
            </h2>
            <p className="mt-1 text-xs text-slate-400 leading-relaxed">
              {isFootball
                ? "Points reward how close you get — from the exact score down to just the winner."
                : "Pick the winner, then get as close to the winning margin as you can."}
            </p>
          </div>

          <div className="space-y-2.5">
            {rows.map((row) => (
              <div
                key={row.title}
                className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3"
              >
                <div className={`flex h-9 w-11 shrink-0 items-center justify-center rounded-lg font-mono text-sm font-black ${row.accent}`}>
                  {row.points}
                </div>
                <div className="flex items-center gap-2 text-slate-400">{row.icon}</div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-white leading-tight">{row.title}</h3>
                  <p className="text-[11px] text-slate-400 leading-tight">{row.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Forgiveness mechanic differs by sport */}
          <div
            className={`mt-4 flex items-start gap-2.5 rounded-xl border p-3 ${
              isFootball
                ? "border-emerald-500/20 bg-emerald-950/20"
                : "border-slate-700/50 bg-slate-950/50"
            }`}
          >
            {isFootball ? (
              <>
                <LifeBuoy className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <p className="text-[11px] leading-relaxed text-emerald-200/90">
                  <span className="font-bold text-emerald-300">The Forgiveness Mechanic:</span>{" "}
                  your worst rounds get automatically dropped in long league seasons, so a bad
                  week won't sink you.
                </p>
              </>
            ) : (
              <>
                <Ban className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                <p className="text-[11px] leading-relaxed text-slate-300">
                  <span className="font-bold text-white">No drops in Rugby.</span>{" "}
                  Tournaments are short, so every single prediction counts toward your total.
                </p>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={onDismiss}
            className={`mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold font-display uppercase tracking-wide text-white transition-colors cursor-pointer ${theme.button}`}
          >
            <Play className="h-3.5 w-3.5 fill-current" /> Let's Play
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
