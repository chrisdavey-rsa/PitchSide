/**
 * PitchSide season helpers.
 * Seasons start at 2026 — no legacy pre-2026 years are exposed in the UI.
 */

/** First season PitchSide supports in product UI and filters. */
export const BASE_SEASON_YEAR = 2026;

/**
 * Returns season year strings from 2026 through the current calendar year.
 * Examples: in 2026 → `["2026"]`; in 2028 → `["2026", "2027", "2028"]`.
 */
export function getAvailableSeasons(now: Date = new Date()): string[] {
  const currentYear = now.getFullYear();
  const endYear = Math.max(BASE_SEASON_YEAR, currentYear);
  const seasons: string[] = [];
  for (let year = BASE_SEASON_YEAR; year <= endYear; year += 1) {
    seasons.push(String(year));
  }
  return seasons;
}

/** Newest season in the available range (current year, floored at 2026). */
export function getLatestSeason(now: Date = new Date()): string {
  const seasons = getAvailableSeasons(now);
  return seasons[seasons.length - 1] ?? String(BASE_SEASON_YEAR);
}
