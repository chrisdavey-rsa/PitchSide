/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SportType } from './types';
import {
  calculateFootballPoints as engineFootballPoints,
  calculateRugbyPoints as engineRugbyPoints,
  settlePredictionPoints,
  type AppliedPowerUp,
} from './services/scoringEngine';

/**
 * Football: Exact 5 · Exact GD 3 · Outcome 1 · Miss 0.
 * Keep in sync with SQL public.pitchside_football_points and scoringEngine.
 */
export function calculateFootballPoints(
  predictedHome: number,
  predictedAway: number,
  actualHome: number,
  actualAway: number
): number {
  return engineFootballPoints(predictedHome, predictedAway, actualHome, actualAway);
}

/**
 * Rugby: Exact margin 5 · within 7 → 3 · within 10 → 1.
 * Keep in sync with SQL public.pitchside_rugby_points and scoringEngine.
 */
export function calculateRugbyPoints(
  predictedHome: number,
  predictedAway: number,
  actualHome: number,
  actualAway: number
): number {
  return engineRugbyPoints(predictedHome, predictedAway, actualHome, actualAway);
}

/**
 * General scoring dispatch (base points only — no power-up modifiers).
 * Prefer settlePredictionWithPowerUp when a chip is applied.
 */
export function calculatePoints(
  sport: SportType,
  predictedHome: number,
  predictedAway: number,
  actualHome: number,
  actualAway: number
): number {
  if (sport === SportType.FOOTBALL) {
    return calculateFootballPoints(predictedHome, predictedAway, actualHome, actualAway);
  }
  return calculateRugbyPoints(predictedHome, predictedAway, actualHome, actualAway);
}

/** Full settlement including power-up overrides (mirrors pitchside_settle_prediction_points). */
export function settlePredictionWithPowerUp(
  sport: SportType,
  predictedHome: number,
  predictedAway: number,
  actualHome: number,
  actualAway: number,
  appliedPowerup?: AppliedPowerUp,
): { earnedPoints: number; isBankerExact: boolean; basePoints: number } {
  return settlePredictionPoints(
    sport,
    predictedHome,
    predictedAway,
    actualHome,
    actualAway,
    appliedPowerup,
  );
}

/** Monday 00:00 local time for the week containing `date`. */
function startOfCalendarWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function weekKey(date: Date): string {
  const start = startOfCalendarWeek(date);
  return `${start.getFullYear()}-${start.getMonth()}-${start.getDate()}`;
}

function subtractWeek(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - 7);
  return d;
}

/**
 * Consecutive calendar weeks (Mon–Sun) with at least one locked prediction.
 * Resets when a full week passes without a lock.
 */
export function computeWeeklyStreak(lockedAtTimestamps: string[]): number {
  if (lockedAtTimestamps.length === 0) return 0;

  const activeWeeks = new Set(
    lockedAtTimestamps.map((ts) => weekKey(new Date(ts))),
  );

  let streak = 0;
  let cursor = startOfCalendarWeek(new Date());

  if (!activeWeeks.has(weekKey(cursor))) {
    cursor = subtractWeek(cursor);
  }

  while (activeWeeks.has(weekKey(cursor))) {
    streak += 1;
    cursor = subtractWeek(cursor);
  }

  return streak;
}
