import React from "react";
import { ChevronDown, Lock, Minus, Plus, X } from "lucide-react";
import { DoubleBubbleIcon, getPowerUp } from "../../constants/powerups";

export type HowToPredictSport = "football" | "rugby" | "formula1" | "golf";

type StepCopy = { title: string; body: string };

const COPY: Record<HowToPredictSport, [StepCopy, StepCopy, StepCopy]> = {
  football: [
    { title: "Step 1", body: "Decide which team you think is going to win." },
    { title: "Step 2", body: "Predict how many goals each team will score." },
    { title: "Step 3", body: "Lock in your predictions before the game starts." },
  ],
  rugby: [
    { title: "Step 1", body: "Decide which team you think is going to win." },
    {
      title: "Step 2",
      body: "Predict the margin that you think the team will win by.",
    },
    { title: "Step 3", body: "Lock in your predictions before the game starts." },
  ],
  formula1: [
    {
      title: "Step 1",
      body: "Decide which drivers will make the top qualifying and race positions.",
    },
    {
      title: "Step 2",
      body: "Predict the full Top 10 Qualifying grid, Top 6 Race finish, and Fastest Lap driver.",
    },
    {
      title: "Step 3",
      body: "Lock in your predictions before Qualifying begins.",
    },
  ],
  golf: [
    {
      title: "Step 1",
      body: "Build your 5-man roster by selecting one golfer from each Official World Golf Ranking tier.",
    },
    {
      title: "Step 2",
      body: "Predict the overall tournament winner and the final winning score.",
    },
    {
      title: "Step 3",
      body: "Lock in your picks before the first tee time on Thursday.",
    },
  ],
};

function MockScoreDial({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-950 px-1 py-0.5">
      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-slate-800 text-slate-400">
        <Minus className="h-3 w-3" />
      </span>
      <span className="w-5 text-center text-xs font-mono font-bold text-white tabular-nums">
        {value}
      </span>
      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-slate-800 text-slate-400">
        <Plus className="h-3 w-3" />
      </span>
    </div>
  );
}

function MockMarginSelect() {
  return (
    <div
      className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-950 px-2.5 py-1.5 text-[10px] font-semibold text-slate-200"
      aria-hidden
    >
      <span>Win by 1 to 5 points</span>
      <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
    </div>
  );
}

function StepCard({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <div className="h-full rounded-xl border border-slate-800/90 bg-slate-900/50 p-3 flex flex-col gap-2">
      <div className="rounded-lg border border-slate-800 bg-slate-950/80 px-2 py-2 min-h-[4.25rem] flex items-center justify-center shrink-0">
        {children}
      </div>
      <div className="flex-1 flex flex-col">
        <p className="text-[9px] font-mono uppercase tracking-widest text-emerald-400/90 mb-1">
          {title}
        </p>
        <p className="text-[10px] text-slate-300 font-sans leading-snug">{body}</p>
      </div>
    </div>
  );
}

function StepVisual({
  sport,
  stepIndex,
}: {
  sport: HowToPredictSport;
  stepIndex: 0 | 1 | 2;
}) {
  if (stepIndex === 0) {
    if (sport === "formula1") {
      return (
        <div className="flex items-center justify-center gap-1.5 py-1">
          {["01", "02", "03"].map((n) => (
            <div
              key={n}
              className="rounded-md border border-red-500/30 bg-slate-950 px-1.5 py-1 text-[9px] font-mono text-red-200"
            >
              P{n}
            </div>
          ))}
        </div>
      );
    }
    if (sport === "golf") {
      return (
        <div className="flex items-center justify-center gap-1 py-1">
          {["T1", "T2", "T3", "T4", "T5"].map((t) => (
            <div
              key={t}
              className="h-7 w-7 rounded-full border border-emerald-500/30 bg-emerald-950/40 text-[8px] font-mono text-emerald-200 flex items-center justify-center"
            >
              {t}
            </div>
          ))}
        </div>
      );
    }
    if (sport === "rugby") {
      return (
        <p className="text-center text-sm font-bold font-display text-white tracking-tight py-1">
          South Africa vs England
        </p>
      );
    }
    return (
      <p className="text-center text-sm font-bold font-display text-white tracking-tight py-1">
        Arsenal vs Chelsea
      </p>
    );
  }

  if (stepIndex === 1) {
    if (sport === "rugby") {
      return (
        <div className="flex flex-col items-center gap-2 py-1">
          <p className="text-[10px] font-mono uppercase tracking-wider text-amber-300">
            Winning margin
          </p>
          <MockMarginSelect />
        </div>
      );
    }
    if (sport === "formula1") {
      return (
        <div className="flex flex-col items-center gap-1 py-1 text-[9px] font-mono text-slate-400">
          <span>Q Top 10 · Race Top 6 · FL</span>
          <div className="flex gap-1">
            <span className="rounded border border-slate-700 px-1.5 py-0.5 text-slate-300">
              Grid
            </span>
            <span className="rounded border border-slate-700 px-1.5 py-0.5 text-slate-300">
              Race
            </span>
            <span className="rounded border border-slate-700 px-1.5 py-0.5 text-slate-300">
              FL
            </span>
          </div>
        </div>
      );
    }
    if (sport === "golf") {
      return (
        <div className="flex items-center justify-center gap-2 py-1">
          <div className="rounded-lg border border-emerald-500/30 bg-slate-950 px-2 py-1 text-center">
            <div className="text-[8px] font-mono text-slate-500 uppercase">Winner</div>
            <div className="text-[10px] font-semibold text-emerald-200">Player A</div>
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-center">
            <div className="text-[8px] font-mono text-slate-500 uppercase">Score</div>
            <div className="text-[10px] font-mono text-white">-12</div>
          </div>
        </div>
      );
    }
    return (
      <div className="flex items-end justify-center gap-3 py-1">
        <div className="flex flex-col items-center gap-1">
          <span className="text-[10px] font-bold font-display text-slate-300 tracking-wide">
            ARS
          </span>
          <MockScoreDial value={2} />
        </div>
        <span className="pb-1.5 text-[10px] text-slate-600 font-mono">-</span>
        <div className="flex flex-col items-center gap-1">
          <span className="text-[10px] font-bold font-display text-slate-300 tracking-wide">
            CHE
          </span>
          <MockScoreDial value={1} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-center py-1">
      <div className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-[10px] font-bold font-display uppercase tracking-wide text-white shadow-md shadow-emerald-950/40">
        <Lock className="h-3 w-3" />
        Lock prediction
      </div>
    </div>
  );
}

function ActiveBoostChipMock() {
  const def = getPowerUp("double_bubble");
  const Icon = def?.icon ?? DoubleBubbleIcon;
  return (
    <div
      className={`relative flex flex-col items-center gap-1 w-[4.5rem] rounded-xl border px-2 py-2 ${
        def?.theme.border ?? "border-sky-400/50"
      } ${def?.theme.bg ?? "bg-sky-500/15"} shadow-[0_0_16px_rgba(56,189,248,0.35)] ring-1 ring-sky-300/40`}
      aria-hidden
    >
      <span className={`${def?.theme.iconText ?? "text-sky-300"}`}>
        <Icon className="h-4 w-4" />
      </span>
      <span className={`text-[8px] font-bold font-display uppercase tracking-wide ${def?.theme.accentText ?? "text-sky-200"}`}>
        {def?.name ?? "Double Bubble"}
      </span>
    </div>
  );
}

function ConsumedBoostChipMock() {
  const def = getPowerUp("double_bubble");
  const Icon = def?.icon ?? DoubleBubbleIcon;
  return (
    <div
      className="relative flex flex-col items-center gap-1 w-[4.5rem] rounded-xl border border-slate-700/80 bg-slate-900/50 px-2 py-2 opacity-50 grayscale"
      aria-hidden
    >
      <span className="text-slate-500">
        <Icon className="h-4 w-4" />
      </span>
      <span className="text-[8px] font-bold font-display uppercase tracking-wide text-slate-500">
        {def?.name ?? "Double Bubble"}
      </span>
      <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-slate-950/55">
        <Lock className="h-4 w-4 text-slate-300" />
      </span>
    </div>
  );
}

type Props = {
  sport: HowToPredictSport;
  /** Show dismiss control (prediction workspace first-run). */
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
};

/**
 * Visual "How to Predict" + "How to Apply a Power-Up" guide.
 */
export default function HowToPredictStepper({
  sport,
  dismissible = false,
  onDismiss,
  className = "",
}: Props) {
  const steps = COPY[sport] ?? COPY.football;

  return (
    <div
      className={`relative rounded-2xl border border-slate-800 bg-slate-950/60 p-3 sm:p-4 space-y-4 ${className}`}
      data-no-swipe="true"
    >
      <div className="flex items-center justify-between gap-2 px-0.5">
        <h3 className="text-xs font-bold font-display text-white uppercase tracking-wide">
          How to Predict
        </h3>
        {dismissible && onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900/80 px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-slate-400 hover:text-white cursor-pointer"
            aria-label="Dismiss how to predict"
          >
            <X className="h-3 w-3" />
            Got it
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-stretch">
        {steps.map((step, i) => (
          <StepCard key={step.title} title={step.title} body={step.body}>
            <StepVisual sport={sport} stepIndex={i as 0 | 1 | 2} />
          </StepCard>
        ))}
      </div>

      <div className="pt-1 border-t border-slate-800/80 space-y-3">
        <h3 className="text-xs font-bold font-display text-white uppercase tracking-wide px-0.5">
          How to Apply a Power-Up
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-stretch">
          <StepCard
            title="Step 1"
            body="Select your Boost. Tap an available chip from your inventory to assign it to a specific fixture."
          >
            <ActiveBoostChipMock />
          </StepCard>
          <StepCard
            title="Step 2"
            body="Lock and Burn. Locking your prediction consumes the chip permanently. Use them strategically, as you will need to earn them again."
          >
            <ConsumedBoostChipMock />
          </StepCard>
        </div>
      </div>
    </div>
  );
}
