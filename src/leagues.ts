import { League, Competition, SportType } from "./types";

/**
 * Resolve the season a league belongs to. Leagues don't always carry an explicit
 * season, so we fall back to the competition's season, then the league's own
 * season field, and finally the year the league was created.
 */
export function getLeagueSeason(league: League, competition?: Competition): string {
  return competition?.season || league.season || league.createdAt.substring(0, 4);
}

export interface LeagueFilterCriteria {
  /** Free-text search across name, competition, sport and season. */
  search: string;
  sport: SportType | "ALL";
  competitionId: string | "ALL";
  season: string | "ALL";
}

export type LeagueSortKey = "name" | "members" | "privacy";
export type LeagueSortDir = "asc" | "desc";

/**
 * Shared league search/filter used by the League Hub View tab. Free-text search
 * works together with the sport / competition / season dropdown filters.
 */
export function filterLeagues(
  leagues: League[],
  competitions: Competition[],
  { search, sport, competitionId, season }: LeagueFilterCriteria,
): League[] {
  const query = search.trim().toLowerCase();

  return leagues.filter((league) => {
    const competition = competitions.find((c) => c.id === league.competitionId);

    if (sport !== "ALL" && competition?.sport !== sport) return false;
    if (competitionId !== "ALL" && league.competitionId !== competitionId) return false;

    const leagueSeason = getLeagueSeason(league, competition);
    if (season !== "ALL" && leagueSeason !== season) return false;

    if (query) {
      const haystack = [
        league.name,
        competition?.name ?? "",
        competition?.sport ?? "",
        leagueSeason,
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }

    return true;
  });
}

function isLeaguePrivate(league: League): boolean {
  return !!(league.isPrivate || league.isPublic === false);
}

/**
 * Sort leagues for directory / My Leagues views.
 * Default: name A→Z. Privacy asc = Public first; desc = Private first.
 */
export function sortLeagues(
  leagues: League[],
  key: LeagueSortKey = "name",
  dir: LeagueSortDir = "asc",
): League[] {
  const mul = dir === "asc" ? 1 : -1;
  return [...leagues].sort((a, b) => {
    if (key === "name") {
      return mul * a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    }
    if (key === "members") {
      const diff = (a.members?.length ?? 0) - (b.members?.length ?? 0);
      if (diff !== 0) return mul * diff;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    }
    // privacy
    const diff = Number(isLeaguePrivate(a)) - Number(isLeaguePrivate(b));
    if (diff !== 0) return mul * diff;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

/**
 * Distinct list of sports present in the competitions data, preserving order.
 * Adding new sports to the competitions data automatically surfaces them here.
 */
export function getAvailableSports(competitions: Competition[]): SportType[] {
  const seen = new Set<SportType>();
  const sports: SportType[] = [];
  for (const comp of competitions) {
    if (!seen.has(comp.sport)) {
      seen.add(comp.sport);
      sports.push(comp.sport);
    }
  }
  return sports;
}

/** Human-friendly label for a sport value (e.g. "football" -> "Football"). */
export function sportLabel(sport: SportType): string {
  return sport.charAt(0).toUpperCase() + sport.slice(1);
}

function randomInt(max: number): number {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] % max;
  }
  return Math.floor(Math.random() * max);
}

/**
 * Generate a reasonably strong random password containing at least one
 * uppercase letter, lowercase letter, number and symbol. Visually ambiguous
 * characters (0/O, 1/l/I) are excluded for legibility when shared verbally.
 */
export function generateStrongPassword(length = 14): string {
  const upper = "ABCDEFGHJKMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const numbers = "23456789";
  const symbols = "!@#$%^&*-_=+?";
  const all = upper + lower + numbers + symbols;

  const pick = (set: string) => set[randomInt(set.length)];
  const chars = [pick(upper), pick(lower), pick(numbers), pick(symbols)];
  for (let i = chars.length; i < length; i++) chars.push(pick(all));

  // Fisher-Yates shuffle so the guaranteed characters aren't always up front.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}
