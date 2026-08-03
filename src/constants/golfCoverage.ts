/**
 * Golf coverage tiers + major/marquee tournament name matching.
 */

export type GolfCoverageTier =
  | "MAJORS_ONLY"
  | "MAJORS_TEAMS"
  | "MAJORS_MARQUEE"
  | "ALL_PGA";

export const GOLF_COVERAGE_TIERS: readonly {
  id: GolfCoverageTier;
  leagueId: string;
  label: string;
  description: string;
}[] = [
  {
    id: "MAJORS_ONLY",
    leagueId: "g-majors",
    label: "The Majors",
    description: "Masters, PGA Championship, US Open, The Open",
  },
  {
    id: "MAJORS_TEAMS",
    leagueId: "g-majors-teams",
    label: "Team Events",
    description: "Majors plus Ryder Cup and Presidents Cup",
  },
  {
    id: "MAJORS_MARQUEE",
    leagueId: "g-majors-marquee",
    label: "Tier 1 Events",
    description: "Majors, team cups, and signature events (Players, Phoenix Open, …)",
  },
  {
    id: "ALL_PGA",
    leagueId: "g-all-pga",
    label: "Full PGA Tour",
    description: "Complete PGA Tour schedule",
  },
] as const;

export const GOLF_TIER_BY_LEAGUE_ID: Record<string, GolfCoverageTier> =
  Object.fromEntries(GOLF_COVERAGE_TIERS.map((t) => [t.leagueId, t.id]));

export const GOLF_LEAGUE_ID_BY_TIER: Record<GolfCoverageTier, string> =
  Object.fromEntries(GOLF_COVERAGE_TIERS.map((t) => [t.id, t.leagueId])) as Record<
    GolfCoverageTier,
    string
  >;

const MAJOR_PATTERNS = [
  /masters/i,
  /pga championship/i,
  /u\.?s\.?\s*open/i,
  /the open/i,
  /open championship/i,
  /british open/i,
];

const TEAM_EVENT_PATTERNS = [/ryder cup/i, /presidents cup/i];

const MARQUEE_PATTERNS = [
  /players championship/i,
  /the players/i,
  /wm phoenix/i,
  /waste management/i,
  /phoenix open/i,
  /arnold palmer/i,
  /memorial tournament/i,
  /genesis/i,
  /traveler/i,
  /fedex/i,
];

function matchesAny(name: string, patterns: RegExp[]): boolean {
  return patterns.some((re) => re.test(name));
}

/** Classify a golf tournament name into the minimum tier that includes it. */
export function golfTournamentMinTier(
  tournamentName: string | null | undefined,
): GolfCoverageTier {
  const name = (tournamentName || "").trim();
  if (!name) return "ALL_PGA";
  if (matchesAny(name, MAJOR_PATTERNS)) return "MAJORS_ONLY";
  if (matchesAny(name, TEAM_EVENT_PATTERNS)) return "MAJORS_TEAMS";
  if (matchesAny(name, MARQUEE_PATTERNS)) return "MAJORS_MARQUEE";
  return "ALL_PGA";
}

const TIER_RANK: Record<GolfCoverageTier, number> = {
  MAJORS_ONLY: 1,
  MAJORS_TEAMS: 2,
  MAJORS_MARQUEE: 3,
  ALL_PGA: 4,
};

export function golfTournamentVisibleForTier(
  tournamentName: string | null | undefined,
  userTier: GolfCoverageTier,
): boolean {
  if (userTier === "ALL_PGA") return true;
  const needed = golfTournamentMinTier(tournamentName);
  return TIER_RANK[needed] <= TIER_RANK[userTier];
}
