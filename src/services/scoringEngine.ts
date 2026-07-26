/**
 * PitchSide scoring + power-up override engine.
 * Keep in sync with SQL:
 *   public.pitchside_football_points
 *   public.pitchside_rugby_points
 *   public.pitchside_apply_powerup
 *   public.pitchside_settle_prediction_points
 */

import type { PowerUpId } from "../constants/powerups";
import { SportType } from "../types";

export const FOOTBALL_OUTCOME_POINTS = 1;
export const FOOTBALL_EXACT_GD_POINTS = 3;
export const FOOTBALL_EXACT_SCORE_POINTS = 5;

export const RUGBY_EXACT_MARGIN_POINTS = 5;
export const RUGBY_NEAR_MARGIN_POINTS = 3; // within 7
export const RUGBY_WIDE_MARGIN_POINTS = 1; // within 10
export const SAFETY_NET_FLOOR_POINTS = 5;

export type AppliedPowerUp = PowerUpId | null | undefined;

export interface SettleResult {
  earnedPoints: number;
  isBankerExact: boolean;
  basePoints: number;
}

function outcomeOf(home: number, away: number): "home" | "away" | "draw" {
  if (home > away) return "home";
  if (home < away) return "away";
  return "draw";
}

/** Football base: Exact 5 · Exact GD 3 · Outcome 1 · Miss 0. */
export function calculateFootballPoints(
  predictedHome: number,
  predictedAway: number,
  actualHome: number,
  actualAway: number,
): number {
  if (outcomeOf(predictedHome, predictedAway) !== outcomeOf(actualHome, actualAway)) {
    return 0;
  }
  if (predictedHome === actualHome && predictedAway === actualAway) {
    return FOOTBALL_EXACT_SCORE_POINTS;
  }
  if (predictedHome - predictedAway === actualHome - actualAway) {
    return FOOTBALL_EXACT_GD_POINTS;
  }
  return FOOTBALL_OUTCOME_POINTS;
}

/**
 * Rugby base: Exact margin 5 · within 7 → 3 · within 10 → 1 · else 0.
 */
export function calculateRugbyPoints(
  predictedHome: number,
  predictedAway: number,
  actualHome: number,
  actualAway: number,
): number {
  if (outcomeOf(predictedHome, predictedAway) !== outcomeOf(actualHome, actualAway)) {
    return 0;
  }
  const predictedMargin = Math.abs(predictedHome - predictedAway);
  const actualMargin = Math.abs(actualHome - actualAway);
  const marginDifference = Math.abs(predictedMargin - actualMargin);

  if (marginDifference === 0) return RUGBY_EXACT_MARGIN_POINTS;
  if (marginDifference <= 7) return RUGBY_NEAR_MARGIN_POINTS;
  if (marginDifference <= 10) return RUGBY_WIDE_MARGIN_POINTS;
  return 0;
}

export function applyPowerUpModifiers(
  basePoints: number,
  appliedPowerup: AppliedPowerUp,
  opts: { isExact: boolean; outcomeCorrect: boolean },
): { earnedPoints: number; isBankerExact: boolean } {
  let points = basePoints;
  let isBankerExact = false;

  if (!appliedPowerup) {
    return { earnedPoints: points, isBankerExact: false };
  }

  if (appliedPowerup === "banker") {
    if (opts.outcomeCorrect) {
      points = FOOTBALL_EXACT_SCORE_POINTS;
      isBankerExact = true;
    }
  } else if (appliedPowerup === "sniper") {
    if (opts.isExact) {
      points = Math.round(points * 1.5);
    }
  }

  if (appliedPowerup === "double_bubble") {
    points *= 2;
  } else if (appliedPowerup === "pitchside_master") {
    points *= 3;
  }

  if (appliedPowerup === "safety_net" && points === 0) {
    points = SAFETY_NET_FLOOR_POINTS;
  }

  return { earnedPoints: points, isBankerExact };
}

export function settlePredictionPoints(
  sport: "football" | "rugby" | SportType,
  predictedHome: number,
  predictedAway: number,
  actualHome: number,
  actualAway: number,
  appliedPowerup?: AppliedPowerUp,
): SettleResult {
  const sportKey =
    sport === SportType.FOOTBALL || sport === "football" ? "football" : "rugby";

  const basePoints =
    sportKey === "football"
      ? calculateFootballPoints(predictedHome, predictedAway, actualHome, actualAway)
      : calculateRugbyPoints(predictedHome, predictedAway, actualHome, actualAway);

  const outcomeCorrect =
    outcomeOf(predictedHome, predictedAway) === outcomeOf(actualHome, actualAway);
  const isExact =
    predictedHome === actualHome && predictedAway === actualAway;

  const mod = applyPowerUpModifiers(basePoints, appliedPowerup, {
    isExact,
    outcomeCorrect,
  });

  return {
    earnedPoints: mod.earnedPoints,
    isBankerExact: mod.isBankerExact,
    basePoints,
  };
}

/** Drop allowances — mirrors public.pitchside_competition_drops. */
export const COMPETITION_DROPS_ALLOWED: Record<string, number> = {
  "f-epl": 3,
  "f-spfl": 3,
  "f-championship": 4,
};

export function dropsAllowedForCompetition(competitionId?: string | null): number {
  if (!competitionId) return 0;
  return COMPETITION_DROPS_ALLOWED[competitionId] ?? 0;
}

/**
 * Football forgiveness: drop lowest N gameweek totals when weeks played > N.
 */
export function applyFootballDropWeeks(
  gameweekTotals: number[],
  dropsAllowed: number,
): { officialScore: number; ghostPoints: number; dropsUsed: number } {
  const ghostPoints = gameweekTotals.reduce((sum, n) => sum + n, 0);
  const weeks = gameweekTotals.length;
  if (weeks <= dropsAllowed || dropsAllowed <= 0) {
    return { officialScore: ghostPoints, ghostPoints, dropsUsed: 0 };
  }
  const sortedAsc = [...gameweekTotals].sort((a, b) => a - b);
  const dropsUsed = dropsAllowed;
  const officialScore = sortedAsc.slice(dropsUsed).reduce((sum, n) => sum + n, 0);
  return { officialScore, ghostPoints, dropsUsed };
}
