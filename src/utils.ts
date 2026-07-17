/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SportType } from './types';

/**
 * Calculates scores based on Football Rules:
 *  - Exact score predicted correctly: 5 points
 *  - Correct outcome + correct goal difference/margin (exact score wrong): 3 points
 *  - Correct outcome but wrong margin (e.g. predicted 2–0, finished 1–0): 1 point
 *  - Incorrect match outcome: 0 points
 *
 * NOTE: keep in sync with supabase/functions/sync-settlement calculateFootballPoints
 * and SQL public.pitchside_football_points.
 */
export function calculateFootballPoints(
  predictedHome: number,
  predictedAway: number,
  actualHome: number,
  actualAway: number
): number {
  const predictedWinner = predictedHome > predictedAway ? 'home' : predictedHome < predictedAway ? 'away' : 'draw';
  const actualWinner = actualHome > actualAway ? 'home' : actualHome < actualAway ? 'away' : 'draw';

  // Incorrect outcome -> 0 points immediately
  if (predictedWinner !== actualWinner) {
    return 0;
  }

  // Exact Match
  if (predictedHome === actualHome && predictedAway === actualAway) {
    return 5;
  }

  // Correct winning team + correct winning margin + wrong scoreline
  const predictedMargin = predictedHome - predictedAway;
  const actualMargin = actualHome - actualAway;
  if (predictedMargin === actualMargin) {
    return 3;
  }

  // Correct winning team (or draw predicted) but margin and score wrong
  return 1;
}

/**
 * Calculates scores based on Rugby Rules:
 *  - Correct winning team and exact correct margin: 5 points
 *  - Correct winning team and margin difference within 7 points: 3 points
 *  - Correct winning team and margin difference within 10 points: 1 point
 *  - Correct winning team, margin difference greater than 10 points: 0 points
 *  - Incorrect outcome: 0 points
 *
 * NOTE: keep in sync with the SQL RPC public.pitchside_rugby_points.
 */
export function calculateRugbyPoints(
  predictedHome: number,
  predictedAway: number,
  actualHome: number,
  actualAway: number
): number {
  const predictedWinner = predictedHome > predictedAway ? 'home' : predictedHome < predictedAway ? 'away' : 'draw';
  const actualWinner = actualHome > actualAway ? 'home' : actualHome < actualAway ? 'away' : 'draw';

  // Incorrect outcome -> 0 points immediately
  if (predictedWinner !== actualWinner) {
    return 0;
  }

  const predictedMargin = Math.abs(predictedHome - predictedAway);
  const actualMargin = Math.abs(actualHome - actualAway);

  const marginDifference = Math.abs(predictedMargin - actualMargin);

  // Correct winning team and exact correct margin
  if (marginDifference === 0) {
    return 5;
  }

  // Correct winning team and margin difference within 7 points
  if (marginDifference <= 7) {
    return 3;
  }

  // Correct winning team and margin difference within 10 points
  if (marginDifference <= 10) {
    return 1;
  }

  return 0;
}

/**
 * General scoring dispatch
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
  } else {
    return calculateRugbyPoints(predictedHome, predictedAway, actualHome, actualAway);
  }
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
