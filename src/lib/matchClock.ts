/**
 * Format live / finished match clock labels for the Predictions feed.
 *
 * Accepts either a stored `match_minute` string (from sync-live) or raw
 * provider fields (`status` short-code, `elapsed`, `extra`).
 */

export type MatchClockInput = {
  /** Domain status (upcoming|live|completed) or provider short (HT, 1H, FT…). */
  status?: string | null;
  /** Stored clock from matches.match_minute. */
  matchMinute?: string | null;
  /** Provider elapsed minutes (fixture.status.elapsed). */
  elapsed?: number | null;
  /** Provider stoppage / added minutes (fixture.status.extra). */
  extra?: number | null;
};

const LABEL_STATUSES = new Set(["HT", "FT", "AET", "PEN"]);

function toUpper(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

function parseNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Normalize a clock string for display (always ends with ' for minute forms).
 */
export function formatLiveMatchClock(input: MatchClockInput): string | null {
  const statusShort = toUpper(input.status);

  if (LABEL_STATUSES.has(statusShort)) {
    return statusShort;
  }

  const raw = String(input.matchMinute ?? "").trim();
  const rawUpper = toUpper(raw.replace(/'$/, ""));

  if (LABEL_STATUSES.has(rawUpper)) {
    return rawUpper;
  }

  // Already formatted added time: 45+2 or 45+2'
  const addedMatch = raw.match(/^(\d+)\+(\d+)'?$/);
  if (addedMatch) {
    return `${addedMatch[1]}+${addedMatch[2]}'`;
  }

  // Plain minutes already stored: 63 or 63'
  const plainMatch = raw.match(/^(\d+)'?$/);
  const elapsedFromRaw = plainMatch ? Number(plainMatch[1]) : null;

  const elapsed = parseNumber(input.elapsed) ?? elapsedFromRaw;
  const extra = parseNumber(input.extra);

  if (elapsed != null && extra != null && extra > 0) {
    return `${elapsed}+${extra}'`;
  }

  if (elapsed != null) {
    return `${elapsed}'`;
  }

  if (raw) {
    // Preserve provider shorts that landed in match_minute (e.g. "1H", "ET").
    if (/^[A-Z]{1,4}$/i.test(raw.replace(/'$/, ""))) {
      return rawUpper;
    }
    return raw.endsWith("'") ? raw : `${raw}'`;
  }

  return null;
}

/**
 * Build match_minute for DB writes from an API-Sports fixture payload.
 * Shared shape: fixture.status.{short,elapsed,extra}
 */
export function formatMatchMinuteFromProvider(status: {
  short?: string | null;
  elapsed?: number | string | null;
  extra?: number | string | null;
} | null | undefined): string | null {
  if (!status) return null;
  return formatLiveMatchClock({
    status: status.short,
    elapsed: parseNumber(status.elapsed),
    extra: parseNumber(status.extra),
  });
}
