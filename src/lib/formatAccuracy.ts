/**
 * Accuracy display helpers — shared by leaderboards, league standings, and profiles.
 */

/** Coerce unknown numeric input to a finite number. */
export function safeAccuracyNum(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Format an accuracy percentage for display.
 * Whole numbers → "45%"; otherwise up to 2 decimal places → "45.67%".
 */
export function formatAccuracyPercent(value: number): string {
  if (!Number.isFinite(value) || Number.isNaN(value)) return "0%";
  const normalized = Number(value.toFixed(2));
  return Number.isInteger(normalized)
    ? `${normalized}%`
    : `${normalized.toFixed(2)}%`;
}

/**
 * Accuracy = (base_points / (settled_predictions × 5)) × 100 — no power-up multipliers.
 */
export function formatAccuracyFromBasePoints(
  basePoints: number,
  settledPredictions: number,
): string {
  const base = safeAccuracyNum(basePoints);
  const settled = safeAccuracyNum(settledPredictions);
  if (settled <= 0) return "0%";
  return formatAccuracyPercent((base / (settled * 5)) * 100);
}
