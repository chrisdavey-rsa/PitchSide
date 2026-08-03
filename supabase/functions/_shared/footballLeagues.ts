/**
 * Canonical football league catalog for Edge sync functions.
 * Keep in sync with src/constants/competitions.ts FOOTBALL_LEAGUE_META.
 */

export type FootballLeagueDef = {
  slug: string;
  apiId: number;
  title: string;
};

export const FOOTBALL_LEAGUES: readonly FootballLeagueDef[] = [
  { slug: "f-epl", apiId: 39, title: "English Premier League" },
  { slug: "f-spfl", apiId: 179, title: "Scottish Premiership" },
  { slug: "f-championship", apiId: 40, title: "EFL Championship" },
  { slug: "f-ucl", apiId: 2, title: "UEFA Champions League" },
  { slug: "f-uel", apiId: 3, title: "UEFA Europa League" },
  { slug: "f-shield", apiId: 528, title: "FA Community Shield" },
  { slug: "f-facup", apiId: 45, title: "FA Cup" },
  { slug: "f-eflcup", apiId: 48, title: "EFL Cup" },
  { slug: "f-worldcup", apiId: 1, title: "FIFA World Cup" },
  { slug: "f-laliga", apiId: 140, title: "La Liga" },
  { slug: "f-seriea", apiId: 135, title: "Serie A" },
  { slug: "f-bundesliga", apiId: 78, title: "Bundesliga" },
  { slug: "f-ligue1", apiId: 61, title: "Ligue 1" },
] as const;

/** Legacy API id that previously mapped Community Shield incorrectly. */
const LEGACY_SHIELD_API_ID = 52;

export const FOOTBALL_API_IDS: ReadonlySet<number> = new Set([
  ...FOOTBALL_LEAGUES.map((l) => l.apiId),
  LEGACY_SHIELD_API_ID,
]);

export const FOOTBALL_SLUG_BY_API: Record<string, string> = {
  ...Object.fromEntries(
    FOOTBALL_LEAGUES.map((l) => [`football:${l.apiId}`, l.slug]),
  ),
  [`football:${LEGACY_SHIELD_API_ID}`]: "f-shield",
};

export const FOOTBALL_TITLE_BY_SLUG: Record<string, string> = Object.fromEntries(
  FOOTBALL_LEAGUES.map((l) => [l.slug, l.title]),
);

export function footballSlugForApiId(apiId: unknown): string | null {
  if (apiId == null) return null;
  const n = Number(apiId);
  if (!Number.isFinite(n)) return null;
  return FOOTBALL_SLUG_BY_API[`football:${n}`] || `football-${n}`;
}

export function footballTitleForSlug(
  slug: string | null,
  apiName?: string | null,
): string | null {
  if (slug && FOOTBALL_TITLE_BY_SLUG[slug]) return FOOTBALL_TITLE_BY_SLUG[slug];
  return apiName ?? null;
}
