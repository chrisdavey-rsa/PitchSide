/**
 * Guest / replay product tour — dark PitchSide styling, swipeable slides.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, Crown, Trophy, X } from "lucide-react";
import { DoubleBubbleIcon, getPowerUp } from "../../constants/powerups";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";

type Props = {
  open: boolean;
  onClose: () => void;
};

const LB_NAMES = [
  "TacticalTom", "PredKing", "SidelineSam", "ExactEmma", "MarginMax",
  "FlyHalfFred", "CleanSheetC", "DerbyDan", "UltrasUna", "VarVictor",
];

function DummyFixture({
  sport,
  home,
  away,
  homeScore,
  awayScore,
}: {
  sport: "football" | "rugby";
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
}) {
  const accent = sport === "football" ? "border-l-blue-500" : "border-l-amber-500";
  return (
    <div
      className={`w-full rounded-2xl border border-slate-700/80 bg-slate-950/80 border-l-4 ${accent} px-4 py-4 sm:px-6 sm:py-5 shadow-lg shadow-black/20`}
    >
      <p className="text-[10px] sm:text-xs font-mono uppercase tracking-widest text-slate-500 mb-2">
        {sport === "football" ? "Football" : "Rugby"} · To be played
      </p>
      <div className="flex items-center justify-between gap-3">
        <span className="flex-1 text-sm sm:text-base font-display font-bold text-white truncate text-right">
          {home}
        </span>
        <span className="shrink-0 font-display font-black text-emerald-400 tabular-nums text-lg sm:text-xl px-2">
          {homeScore} – {awayScore}
        </span>
        <span className="flex-1 text-sm sm:text-base font-display font-bold text-white truncate">
          {away}
        </span>
      </div>
    </div>
  );
}

function LeaderboardClimb() {
  const rows = [
    { rank: 85, name: LB_NAMES[0], pts: 412, you: false },
    { rank: 86, name: LB_NAMES[1], pts: 408, you: false },
    { rank: 87, name: "You", pts: 401, you: true },
    { rank: 88, name: LB_NAMES[2], pts: 398, you: false },
    { rank: 89, name: LB_NAMES[3], pts: 391, you: false },
  ];
  return (
    <div className="space-y-3 w-full max-w-xl mx-auto">
      <div className="flex items-center justify-center gap-2 text-xs sm:text-sm font-mono text-emerald-400">
        <Trophy className="h-4 w-4" />
        Global · climbed 153 → 87
      </div>
      <div className="rounded-2xl border border-slate-700/80 overflow-hidden bg-slate-950/70">
        {rows.map((r) => (
          <div
            key={r.rank}
            className={`flex items-center gap-3 px-4 py-3 sm:px-5 sm:py-3.5 border-b border-slate-800/60 last:border-0 ${
              r.you ? "bg-emerald-500/15 border-l-2 border-l-emerald-400" : ""
            }`}
          >
            <span className="w-10 text-xs sm:text-sm font-mono text-slate-500 tabular-nums">
              #{r.rank}
            </span>
            <span
              className={`flex-1 text-sm sm:text-base font-display font-semibold truncate ${
                r.you ? "text-emerald-300" : "text-slate-200"
              }`}
            >
              {r.name}
            </span>
            <span className="text-xs sm:text-sm font-mono text-slate-400 tabular-nums">
              {r.pts}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PowerUpShowcase() {
  const bubble = getPowerUp("double_bubble");
  const master = getPowerUp("pitchside_master");
  return (
    <div className="flex flex-col sm:flex-row justify-center items-stretch gap-3 sm:gap-4 w-full max-w-xl mx-auto">
      {[bubble, master].map((def) => {
        if (!def) return null;
        const Icon = def.icon;
        return (
          <div
            key={def.id}
            className={`flex flex-1 flex-col items-center gap-2 rounded-2xl border-2 border-solid px-4 py-5 sm:py-6 ${
              def.isPremium
                ? "border-amber-300 bg-linear-to-br from-amber-200/25 via-yellow-500/15 to-slate-950"
                : `${def.theme.border} ${def.theme.bg}`
            }`}
          >
            <span
              className={`flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-xl border bg-slate-950/60 ${
                def.isPremium ? "border-amber-200/50" : def.theme.border
              }`}
            >
              {def.id === "double_bubble" ? (
                <DoubleBubbleIcon className={`text-lg sm:text-xl ${def.theme.iconText}`} />
              ) : (
                <Icon
                  className={`h-7 w-7 sm:h-8 sm:w-8 ${
                    def.isPremium ? "text-amber-200" : def.theme.iconText
                  }`}
                />
              )}
            </span>
            <span
              className={`text-xs sm:text-sm font-bold font-display text-center ${
                def.isPremium ? "text-amber-100" : def.theme.accentText
              }`}
            >
              {def.name}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const SLIDES = [
  {
    title: "Predict Scores",
    body: "Lock in football exact scores and rugby winners + margins before kick-off.",
    visual: (
      <div className="flex flex-col gap-3 sm:gap-4 w-full max-w-xl mx-auto">
        <DummyFixture
          sport="rugby"
          home="South Africa"
          away="England"
          homeScore={1}
          awayScore={0}
        />
        <DummyFixture
          sport="football"
          home="Man City"
          away="Arsenal"
          homeScore={2}
          awayScore={1}
        />
      </div>
    ),
  },
  {
    title: "Join Leagues",
    body: "Compete on the Global Leaderboard or create private pools with friends.",
    visual: (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 w-full max-w-xl mx-auto">
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/30 p-5 sm:p-6 text-center">
          <Trophy className="h-8 w-8 sm:h-10 sm:w-10 text-emerald-400 mx-auto mb-2" />
          <p className="text-sm sm:text-base font-display font-bold text-white">Global</p>
          <p className="text-xs text-slate-400 font-sans mt-1">Everyone plays</p>
        </div>
        <div className="rounded-2xl border border-sky-500/30 bg-sky-950/30 p-5 sm:p-6 text-center">
          <span className="block text-xs font-mono text-sky-300 mb-2">CLUTCHSTRIKER</span>
          <p className="text-sm sm:text-base font-display font-bold text-white">Private</p>
          <p className="text-xs text-slate-400 font-sans mt-1">Invite with a code</p>
        </div>
      </div>
    ),
  },
  {
    title: "Deploy Power-Ups",
    body: "Arm chips like Double Bubble and PitchSide Master on the fixtures that matter.",
    visual: <PowerUpShowcase />,
  },
  {
    title: "Climb Leaderboards",
    body: "Track your rank as results land — every exact score moves the needle.",
    visual: <LeaderboardClimb />,
  },
] as const;

export default function ProductTour({ open, onClose }: Props) {
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const touchX = useRef<number | null>(null);
  useBodyScrollLock(open);

  useEffect(() => {
    if (open) {
      setIndex(0);
      setDir(1);
    }
  }, [open]);

  const go = useCallback((nextDir: -1 | 1) => {
    setDir(nextDir);
    setIndex((i) => Math.min(SLIDES.length - 1, Math.max(0, i + nextDir)));
  }, []);

  if (!open) return null;

  const slide = SLIDES[index]!;
  const isLast = index === SLIDES.length - 1;

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-slate-950">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 right-0 h-96 w-96 rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.16)_0%,transparent_70%)]" />
        <div className="absolute bottom-0 -left-16 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(16,185,129,0.14)_0%,transparent_70%)]" />
      </div>

      <div className="relative z-10 flex items-center justify-between px-4 sm:px-8 pt-[max(1rem,env(safe-area-inset-top))] pb-2">
        <button
          type="button"
          onClick={onClose}
          className="text-[11px] font-mono uppercase tracking-wider text-slate-500 hover:text-slate-300 cursor-pointer"
        >
          Skip
        </button>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-slate-400">
          <Crown className="h-3.5 w-3.5 text-amber-400" />
          PitchSide Tour
        </span>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 cursor-pointer"
          aria-label="Close tour"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div
        className="relative z-10 flex-1 flex flex-col px-4 sm:px-10 lg:px-16 pb-6 min-h-0 overflow-hidden"
        onTouchStart={(e) => {
          touchX.current = e.changedTouches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          const start = touchX.current;
          const end = e.changedTouches[0]?.clientX;
          touchX.current = null;
          if (start == null || end == null) return;
          const dx = end - start;
          if (Math.abs(dx) < 48) return;
          go(dx < 0 ? 1 : -1);
        }}
      >
        <div className="flex-1 flex items-center justify-center min-h-0 py-4">
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={index}
              custom={dir}
              initial={{ opacity: 0, x: dir * 40, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: dir * -36, scale: 0.98 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-3xl flex flex-col gap-5 sm:gap-7"
            >
              <div className="text-center space-y-2 sm:space-y-3">
                <h2 className="text-2xl sm:text-4xl font-display font-extrabold text-white tracking-tight">
                  {slide.title}
                </h2>
                <p className="text-sm sm:text-base text-slate-400 font-sans leading-relaxed px-2 max-w-xl mx-auto">
                  {slide.body}
                </p>
              </div>
              <div className="w-full">{slide.visual}</div>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-auto pt-2 space-y-4 max-w-3xl mx-auto w-full">
          <div className="flex items-center justify-center gap-1.5">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Slide ${i + 1}`}
                onClick={() => {
                  setDir(i > index ? 1 : -1);
                  setIndex(i);
                }}
                className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                  i === index
                    ? "w-7 bg-emerald-400"
                    : "w-1.5 bg-slate-700 hover:bg-slate-500"
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={index === 0}
              onClick={() => go(-1)}
              className="h-12 w-12 shrink-0 rounded-xl border border-slate-700 bg-slate-900 text-slate-300 disabled:opacity-30 cursor-pointer flex items-center justify-center"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            {isLast ? (
              <button
                type="button"
                onClick={onClose}
                className="flex-1 h-12 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-bold text-sm cursor-pointer"
              >
                Back to login
              </button>
            ) : (
              <button
                type="button"
                onClick={() => go(1)}
                className="flex-1 h-12 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-bold text-sm cursor-pointer flex items-center justify-center gap-1"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
