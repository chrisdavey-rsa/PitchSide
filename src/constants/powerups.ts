/**
 * PitchSide universal Power-Up catalog + season-scoped instance model.
 * Canonical source — UI and rules should import from here.
 */

import React from "react";
import {
  Shield,
  Crosshair,
  Landmark,
  Crown,
  type LucideIcon,
} from "lucide-react";

/** Sport scope for power-up instances (engine vocabulary). */
export type PowerUpSportType = "football" | "rugby" | "f1" | "golf";

export type PowerUpId =
  | "double_bubble"
  | "safety_net"
  | "sniper"
  | "banker"
  | "pitchside_master";

export type PowerUpAllocation = "baseline" | "earned";

export interface PowerUpTheme {
  accentText: string;
  iconText: string;
  border: string;
  bg: string;
  glow: string;
}

export type PowerUpIcon = LucideIcon | React.FC<{ className?: string }>;

export interface PowerUpDefinition {
  id: PowerUpId;
  /** Marketing name on chips / rules. */
  name: string;
  tagline: string;
  description: string;
  howToEarn: string;
  howToUse: string;
  gameImpact: string;
  allocation: PowerUpAllocation;
  /** Short unlock criteria shown on locked chip tooltips. */
  unlockCriteria: string;
  /** Extra note (e.g. Banker vs Precision Boost interaction). */
  notes?: string;
  icon: PowerUpIcon;
  theme: PowerUpTheme;
  /** Premium platinum/gold treatment (PitchSide Master). */
  isPremium?: boolean;
}

/** Typographic 2× motif for Double Bubble (createElement — file is .ts, not .tsx). */
export function DoubleBubbleIcon({ className = "" }: { className?: string }) {
  return React.createElement(
    "span",
    {
      className: `inline-flex items-center justify-center font-display font-black tracking-tighter leading-none text-[10px] sm:text-[11px] ${className}`,
      "aria-hidden": true,
    },
    "2×",
  );
}

/**
 * A player's owned / progress-tracked power-up for one sport season.
 * Expires automatically when the linked season `is_active` becomes false.
 */
export interface UserPowerUpInstance {
  instanceId: string;
  powerUpId: PowerUpId;
  sportType: PowerUpSportType;
  sportSeasonId: string;
  /** Whether the player has unlocked this chip for the season. */
  unlocked: boolean;
  status: "available" | "armed" | "consumed" | "expired" | "locked";
  /** Progress copy for locked chips, e.g. "1 more Perfect Prediction needed…". */
  progressHint?: string;
  /** Fixture currently armed (if any). */
  armedMatchId?: string | null;
  earnedAt?: string | null;
  /** Always true — engine drops instances when season deactivates. */
  expiresWhenSeasonInactive: true;
}

export const POWER_UP_IDS: PowerUpId[] = [
  "double_bubble",
  "safety_net",
  "sniper",
  "banker",
  "pitchside_master",
];

export const POWER_UPS: PowerUpDefinition[] = [
  {
    id: "double_bubble",
    name: "Double Bubble",
    tagline: "2× points on one selected fixture.",
    description:
      "Double Bubble applies a 2× multiplier to every point you earn on a single selected fixture or event. It is part of your baseline season allocation — available from day one of an active sport season.",
    howToEarn:
      "Baseline allocation. One Double Bubble is granted at the start of each active sport season — no streak required.",
    howToUse:
      "Open your Power-Up wallet, tap Double Bubble, then assign it to an unlocked fixture before kick-off. Once armed, it locks with that prediction.",
    gameImpact:
      "All points earned on the selected fixture are doubled (Perfect Prediction, margin, and outcome bands).",
    allocation: "baseline",
    unlockCriteria: "Granted at season start (baseline allocation).",
    icon: DoubleBubbleIcon,
    theme: {
      accentText: "text-sky-300",
      iconText: "text-sky-400",
      border: "border-sky-500/35",
      bg: "bg-sky-500/10",
      glow: "bg-sky-500/25",
    },
  },
  {
    id: "safety_net",
    name: "Insurance",
    tagline: "Guaranteed floor if your prediction is completely wrong.",
    description:
      "Insurance (Safety Net) protects you from a total wipeout. If your prediction is completely incorrect, you still receive a guaranteed floor score for that fixture instead of zero.",
    howToEarn: "Earn by locking predictions in 3 consecutive weeks (any competition in that sport season).",
    howToUse:
      "Arm Insurance on a fixture before kick-off. If the prediction misses entirely, the floor score is applied automatically at settlement.",
    gameImpact:
      "Converts a 0-point miss into a guaranteed floor — softening bad weeks without rewarding incorrect calls above the floor.",
    allocation: "earned",
    unlockCriteria: "3-week prediction streak required.",
    icon: Shield,
    theme: {
      accentText: "text-emerald-300",
      iconText: "text-emerald-400",
      border: "border-emerald-500/35",
      bg: "bg-emerald-500/10",
      glow: "bg-emerald-500/25",
    },
  },
  {
    id: "sniper",
    name: "Precision Boost",
    tagline: "+50% bonus on Perfect Predictions.",
    description:
      "Precision Boost adds a +50% bonus on top of points from Perfect Predictions on the armed fixture.",
    howToEarn:
      "Land 3 Perfect Predictions within a rolling 10-week window. Perfect Predictions achieved via a Banker do NOT count toward this requirement.",
    howToUse:
      "Assign Precision Boost to a fixture you expect to nail exactly. The +50% applies only if you land a Perfect Prediction.",
    gameImpact:
      "Perfect Predictions pay 1.5× their normal points on the selected fixture.",
    allocation: "earned",
    unlockCriteria: "3 Perfect Predictions in a rolling 10-week window (Banker excluded).",
    notes:
      "Perfect Predictions achieved via a Banker do not count toward unlocking or progressing Precision Boost.",
    icon: Crosshair,
    theme: {
      accentText: "text-rose-300",
      iconText: "text-rose-400",
      border: "border-rose-500/35",
      bg: "bg-rose-500/10",
      glow: "bg-rose-500/25",
    },
  },
  {
    id: "banker",
    name: "Banker",
    tagline: "Max Perfect Prediction points if you get the outcome right.",
    description:
      "Banker automatically awards Perfect Prediction points for a selected fixture as long as you predict the correct match outcome (winner or draw) — even if the scoreline / margin is wrong.",
    howToEarn:
      "Earned through season milestones published per competition. Check your wallet progress for the current sport season.",
    howToUse:
      "Arm Banker on a fixture before kick-off. Predict the correct winner or draw; if the outcome is right, you receive Perfect Prediction points.",
    gameImpact:
      "Correct outcome → Perfect Prediction points. Incorrect outcome → normal scoring (no Banker benefit).",
    allocation: "earned",
    unlockCriteria: "Season milestone unlock (see wallet progress).",
    notes:
      "Perfect Predictions awarded via Banker do NOT count toward the Precision Boost 3-Perfect Prediction earning requirement.",
    icon: Landmark,
    theme: {
      accentText: "text-slate-200",
      iconText: "text-slate-300",
      border: "border-slate-400/45",
      bg: "bg-slate-500/15",
      glow: "bg-slate-400/20",
    },
  },
  {
    id: "pitchside_master",
    name: "PitchSide Master",
    tagline: "Ultimate 3× multiplier on one fixture.",
    description:
      "PitchSide Master is the ultimate season chip — a 3× multiplier on all points earned for a single selected fixture. Reserved for players who dominate across sports.",
    howToEarn:
      "8 consecutive weeks across 2+ sports with 65%+ accuracy unlocks PitchSide Master for the active season.",
    howToUse:
      "Arm PitchSide Master on one fixture before kick-off. Points from that fixture are tripled at settlement.",
    gameImpact: "3× multiplier on all points earned for the selected fixture.",
    allocation: "earned",
    unlockCriteria: "8 consecutive weeks across 2+ sports at 65%+ accuracy.",
    icon: Crown,
    isPremium: true,
    theme: {
      accentText: "text-amber-100",
      iconText: "text-amber-200",
      border: "border-amber-300/50",
      bg: "bg-linear-to-br from-amber-500/20 via-yellow-500/10 to-slate-900/80",
      glow: "bg-amber-400/30",
    },
  },
];

export function getPowerUp(id: string): PowerUpDefinition | undefined {
  return POWER_UPS.find((p) => p.id === id);
}

/** Map UI sport keys → power-up sportType. */
export function toPowerUpSportType(
  sport: "football" | "rugby" | "formula1" | "golf" | "f1" | string | null | undefined,
): PowerUpSportType {
  if (sport === "rugby") return "rugby";
  if (sport === "golf") return "golf";
  if (sport === "formula1" || sport === "f1") return "f1";
  return "football";
}

/**
 * Build season-scoped wallet rows for the selector UI.
 * Baseline Double Bubble starts unlocked; others show progress hints until earned.
 * Pass `seasonIsActive: false` to force every instance expired.
 */
export function buildSeasonWallet(options: {
  sportType: PowerUpSportType;
  sportSeasonId: string;
  seasonIsActive?: boolean;
  /** Override unlock / progress per power-up id. */
  overrides?: Partial<
    Record<
      PowerUpId,
      Pick<UserPowerUpInstance, "unlocked" | "status" | "progressHint" | "armedMatchId">
    >
  >;
}): UserPowerUpInstance[] {
  const {
    sportType,
    sportSeasonId,
    seasonIsActive = true,
    overrides = {},
  } = options;

  const defaults: Record<
    PowerUpId,
    Pick<UserPowerUpInstance, "unlocked" | "status" | "progressHint">
  > = {
    double_bubble: {
      unlocked: true,
      status: "available",
      progressHint: undefined,
    },
    safety_net: {
      unlocked: false,
      status: "locked",
      progressHint: "2 more weeks in your prediction streak to unlock Insurance.",
    },
    sniper: {
      unlocked: false,
      status: "locked",
      progressHint: "1 more Perfect Prediction needed in the next 4 weeks.",
    },
    banker: {
      unlocked: false,
      status: "locked",
      progressHint: "Complete the season milestone to unlock Banker.",
    },
    pitchside_master: {
      unlocked: false,
      status: "locked",
      progressHint: "Need 8 consecutive multi-sport weeks at 65%+ accuracy.",
    },
  };

  return POWER_UP_IDS.map((powerUpId) => {
    const base = defaults[powerUpId];
    const over: Partial<
      Pick<
        UserPowerUpInstance,
        "unlocked" | "status" | "progressHint" | "armedMatchId"
      >
    > = overrides[powerUpId] ?? {};
    const unlocked = over.unlocked ?? base.unlocked;
    let status = over.status ?? base.status;

    if (!seasonIsActive) {
      status = "expired";
    }

    return {
      instanceId: `${sportType}:${sportSeasonId}:${powerUpId}`,
      powerUpId,
      sportType,
      sportSeasonId,
      unlocked: seasonIsActive ? unlocked : false,
      status: seasonIsActive ? status : "expired",
      progressHint: over.progressHint ?? base.progressHint,
      armedMatchId: over.armedMatchId ?? null,
      earnedAt: unlocked && seasonIsActive ? new Date().toISOString() : null,
      expiresWhenSeasonInactive: true as const,
    };
  });
}
