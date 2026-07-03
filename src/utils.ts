/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SportType } from './types';

/**
 * Calculates scores based on Football Rules:
 *  - Exact score predicted correctly: 5 points
 *  - Correct winning team (2 points) + correct winning margin (1 point), exact score wrong: 3 points
 *  - Correct winning team (or correct draw predicted), margin/score wrong: 2 points
 *  - Incorrect match outcome: 0 points
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
  return 2;
}

/**
 * Calculates scores based on Rugby Rules:
 *  - Correct winning team and exact correct margin: 5 points
 *  - Correct winning team and predicted margin is within 3 points: 3 points
 *  - Correct winning team and predicted margin is within 5 points: 1 point
 *  - Correct winning team, predicted margin off by more than 5 points: 0 points
 *  - Incorrect outcome: 0 points
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

  // Correct winning team and margin within 3 points
  if (marginDifference <= 3) {
    return 3;
  }

  // Correct winning team and margin within 5 points
  if (marginDifference <= 5) {
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
