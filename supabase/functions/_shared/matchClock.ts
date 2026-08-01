/**
 * Format live match clock for matches.match_minute (Edge Functions).
 * Mirrors src/lib/matchClock.ts rules for HT / FT / AET / PEN / added time.
 */

type StatusLike = {
  short?: string | null;
  elapsed?: number | string | null;
  extra?: number | string | null;
};

function parseNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function formatMatchMinuteFromProvider(
  status: StatusLike | null | undefined,
): string | null {
  if (!status) return null;

  const short = String(status.short ?? "")
    .trim()
    .toUpperCase();

  if (short === "HT" || short === "FT" || short === "AET" || short === "PEN") {
    return short;
  }

  const elapsed = parseNumber(status.elapsed);
  const extra = parseNumber(status.extra);

  if (elapsed != null && extra != null && extra > 0) {
    return `${elapsed}+${extra}'`;
  }
  if (elapsed != null) {
    return `${elapsed}'`;
  }
  return short || null;
}

/** Extract status object from API-Sports football/rugby fixture item. */
export function providerStatusFromItem(item: any): StatusLike {
  const fixture = item?.fixture ?? item ?? {};
  return fixture.status ?? item?.status ?? {};
}
