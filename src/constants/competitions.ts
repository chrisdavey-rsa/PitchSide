/**
 * Canonical competition display titles + flagcdn country codes.
 * Fixture cards, filters, and league headers resolve names/flags from here.
 */
import { SportType, type Competition } from "../types";

export type CompetitionMeta = {
  id: string;
  name: string;
  /** API-Sports league id (football) when applicable. */
  apiSportsId?: number;
  /**
   * flagcdn.com code (e.g. `gb-eng`, `eu`). Null → Globe fallback
   * via CountryFlag (World / International).
   */
  flagCode: string | null;
  nationality: string;
  sport: SportType;
};

/** Football leagues synced from API-Sports. */
export const FOOTBALL_LEAGUE_META: CompetitionMeta[] = [
  {
    id: "f-epl",
    name: "English Premier League",
    apiSportsId: 39,
    flagCode: "gb-eng",
    nationality: "England",
    sport: SportType.FOOTBALL,
  },
  {
    id: "f-spfl",
    name: "Scottish Premiership",
    apiSportsId: 179,
    flagCode: "gb-sct",
    nationality: "Scotland",
    sport: SportType.FOOTBALL,
  },
  {
    id: "f-championship",
    name: "EFL Championship",
    apiSportsId: 40,
    flagCode: "gb-eng",
    nationality: "England",
    sport: SportType.FOOTBALL,
  },
  {
    id: "f-ucl",
    name: "UEFA Champions League",
    apiSportsId: 2,
    flagCode: "eu",
    nationality: "Europe",
    sport: SportType.FOOTBALL,
  },
  {
    id: "f-uel",
    name: "UEFA Europa League",
    apiSportsId: 3,
    flagCode: "eu",
    nationality: "Europe",
    sport: SportType.FOOTBALL,
  },
  {
    id: "f-shield",
    name: "FA Community Shield",
    apiSportsId: 528,
    flagCode: "gb-eng",
    nationality: "England",
    sport: SportType.FOOTBALL,
  },
  {
    id: "f-facup",
    name: "FA Cup",
    apiSportsId: 45,
    flagCode: "gb-eng",
    nationality: "England",
    sport: SportType.FOOTBALL,
  },
  {
    id: "f-eflcup",
    name: "EFL Cup",
    apiSportsId: 48,
    flagCode: "gb-eng",
    nationality: "England",
    sport: SportType.FOOTBALL,
  },
  {
    id: "f-worldcup",
    name: "FIFA World Cup",
    apiSportsId: 1,
    flagCode: null,
    nationality: "International",
    sport: SportType.FOOTBALL,
  },
  {
    id: "f-laliga",
    name: "La Liga",
    apiSportsId: 140,
    flagCode: "es",
    nationality: "Spain",
    sport: SportType.FOOTBALL,
  },
  {
    id: "f-seriea",
    name: "Serie A",
    apiSportsId: 135,
    flagCode: "it",
    nationality: "Italy",
    sport: SportType.FOOTBALL,
  },
  {
    id: "f-bundesliga",
    name: "Bundesliga",
    apiSportsId: 78,
    flagCode: "de",
    nationality: "Germany",
    sport: SportType.FOOTBALL,
  },
  {
    id: "f-ligue1",
    name: "Ligue 1",
    apiSportsId: 61,
    flagCode: "fr",
    nationality: "France",
    sport: SportType.FOOTBALL,
  },
];

export const COMPETITION_TITLES: Record<string, string> = {
  ...Object.fromEntries(FOOTBALL_LEAGUE_META.map((c) => [c.id, c.name])),
  "r-nations": "Nations Championship",
  "r-sixnations": "Six Nations",
  "r-championship": "The Rugby Championship",
  "r-worldcup": "Rugby World Cup",
  "r-urc": "URC (United Rugby Championship)",
  "r-top14": "Top 14",
  "r-prem": "Premiership Rugby",
  "r-heineken": "Heineken Champions Cup",
};

/** flagcdn codes for competition indicators (null → Globe). */
export const COMPETITION_FLAG_CODES: Record<string, string | null> = {
  ...Object.fromEntries(FOOTBALL_LEAGUE_META.map((c) => [c.id, c.flagCode])),
  "r-nations": null,
  "r-sixnations": "eu",
  "r-championship": null,
  "r-worldcup": null,
  "r-urc": "eu",
  "r-top14": "fr",
  "r-prem": "gb-eng",
  "r-heineken": "eu",
};

/** @deprecated Use COMPETITION_FLAG_CODES — kept as alias for flagcdn codes. */
export const COMPETITION_FLAGS = COMPETITION_FLAG_CODES;

/** API-Sports football league IDs ingested by sync-schedule / sync-live. */
export const FOOTBALL_API_SPORTS_IDS: readonly number[] =
  FOOTBALL_LEAGUE_META.map((c) => c.apiSportsId!).filter(Boolean);

export function getCompetitionTitle(
  competitionId: string | null | undefined,
  fallback?: string | null,
): string {
  if (competitionId && COMPETITION_TITLES[competitionId]) {
    return COMPETITION_TITLES[competitionId];
  }
  const trimmed = fallback?.trim();
  if (trimmed) return trimmed;
  if (competitionId) return `Competition ${competitionId}`;
  return "Competition";
}

/** flagcdn code for a competition, or null for Globe / unknown. */
export function getCompetitionFlagCode(
  competitionId: string | null | undefined,
): string | null {
  if (!competitionId) return null;
  if (!(competitionId in COMPETITION_FLAG_CODES)) return null;
  return COMPETITION_FLAG_CODES[competitionId] ?? null;
}

/** @deprecated Prefer getCompetitionFlagCode. */
export function getCompetitionFlag(
  competitionId: string | null | undefined,
): string | null {
  return getCompetitionFlagCode(competitionId);
}

/** Consolidated nation / region filter chips (desktop rail + mobile FAB). */
export type FilterNation = {
  id: string;
  label: string;
  /** flagcdn code; null → Globe */
  flagCode: string | null;
  competitionIds: readonly string[];
};

export const FILTER_NATIONS: readonly FilterNation[] = [
  {
    id: "england",
    label: "England",
    flagCode: "gb-eng",
    competitionIds: [
      "f-epl",
      "f-championship",
      "f-facup",
      "f-eflcup",
      "f-shield",
      "r-prem",
    ],
  },
  {
    id: "scotland",
    label: "Scotland",
    flagCode: "gb-sct",
    competitionIds: ["f-spfl"],
  },
  {
    id: "spain",
    label: "Spain",
    flagCode: "es",
    competitionIds: ["f-laliga"],
  },
  {
    id: "italy",
    label: "Italy",
    flagCode: "it",
    competitionIds: ["f-seriea"],
  },
  {
    id: "germany",
    label: "Germany",
    flagCode: "de",
    competitionIds: ["f-bundesliga"],
  },
  {
    id: "france",
    label: "France",
    flagCode: "fr",
    competitionIds: ["f-ligue1", "r-top14"],
  },
  {
    id: "europe",
    label: "Europe/UEFA",
    flagCode: "eu",
    competitionIds: [
      "f-ucl",
      "f-uel",
      "r-sixnations",
      "r-heineken",
      "r-urc",
    ],
  },
  {
    id: "world",
    label: "World",
    flagCode: null,
    competitionIds: [
      "f-worldcup",
      "r-worldcup",
      "r-nations",
      "r-championship",
    ],
  },
] as const;

const NATION_BY_COMPETITION: Record<string, string> = Object.fromEntries(
  FILTER_NATIONS.flatMap((n) => n.competitionIds.map((cid) => [cid, n.id])),
);

export function getNationIdForCompetition(
  competitionId: string | null | undefined,
): string | null {
  if (!competitionId) return null;
  return NATION_BY_COMPETITION[competitionId] ?? null;
}

/** Competition ids covered by the selected nation filters (empty → no restriction). */
export function competitionIdsForNations(
  nationIds: readonly string[],
): Set<string> {
  const out = new Set<string>();
  for (const nation of FILTER_NATIONS) {
    if (!nationIds.includes(nation.id)) continue;
    for (const cid of nation.competitionIds) out.add(cid);
  }
  return out;
}

export function matchPassesNationFilter(
  competitionId: string | null | undefined,
  selectedNationIds: readonly string[],
): boolean {
  if (selectedNationIds.length === 0) return true;
  const nationId = getNationIdForCompetition(competitionId);
  if (!nationId) return false;
  return selectedNationIds.includes(nationId);
}

export const FOOTBALL_COMPETITIONS: Competition[] = FOOTBALL_LEAGUE_META.map(
  (c) => ({
    id: c.id,
    name: c.name,
    sport: SportType.FOOTBALL,
    nationality: c.nationality,
  }),
);

export const RUGBY_COMPETITIONS: Competition[] = [
  {
    id: "r-nations",
    name: COMPETITION_TITLES["r-nations"],
    sport: SportType.RUGBY,
    nationality: "International",
  },
  {
    id: "r-sixnations",
    name: COMPETITION_TITLES["r-sixnations"],
    sport: SportType.RUGBY,
    nationality: "Europe",
  },
  {
    id: "r-championship",
    name: COMPETITION_TITLES["r-championship"],
    sport: SportType.RUGBY,
    nationality: "Southern Hemisphere",
  },
  {
    id: "r-worldcup",
    name: COMPETITION_TITLES["r-worldcup"],
    sport: SportType.RUGBY,
    nationality: "International",
  },
  {
    id: "r-urc",
    name: COMPETITION_TITLES["r-urc"],
    sport: SportType.RUGBY,
    nationality: "Multinational",
  },
  {
    id: "r-top14",
    name: COMPETITION_TITLES["r-top14"],
    sport: SportType.RUGBY,
    nationality: "France",
  },
  {
    id: "r-prem",
    name: COMPETITION_TITLES["r-prem"],
    sport: SportType.RUGBY,
    nationality: "England",
  },
  {
    id: "r-heineken",
    name: COMPETITION_TITLES["r-heineken"],
    sport: SportType.RUGBY,
    nationality: "Europe",
  },
];

export const ALL_COMPETITIONS = [
  ...FOOTBALL_COMPETITIONS,
  ...RUGBY_COMPETITIONS,
];
