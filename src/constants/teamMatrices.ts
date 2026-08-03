/**
 * Preeminent teams + PitchSide Picks matrices.
 * Keep in sync with public.preeminent_teams / pitchside_picks_teams seeds
 * and supabase/functions/_shared/teamMatrices.ts
 */

export type PreeminentRegion =
  | "UK"
  | "Spain"
  | "Italy"
  | "Germany"
  | "France"
  | "Premiership"
  | "Top14"
  | "URC"
  | "SixNations"
  | "RugbyChampionship";

export const PREEMINENT_TEAMS: Record<
  "football" | "rugby",
  Partial<Record<PreeminentRegion, readonly string[]>>
> = {
  football: {
    UK: [
      "Manchester City",
      "Arsenal",
      "Liverpool",
      "Manchester United",
      "Chelsea",
      "Tottenham",
    ],
    Spain: [
      "Real Madrid",
      "Barcelona",
      "Atlético Madrid",
      "Atletico Madrid",
      "Sevilla",
      "Valencia",
      "Villarreal",
      "Real Sociedad",
    ],
    Italy: [
      "Inter Milan",
      "Inter",
      "AC Milan",
      "Milan",
      "Juventus",
      "Roma",
      "AS Roma",
      "Napoli",
      "Atalanta",
    ],
    Germany: [
      "Bayern Munich",
      "Bayern München",
      "Borussia Dortmund",
      "RB Leipzig",
      "Bayer Leverkusen",
    ],
    France: [
      "PSG",
      "Paris Saint Germain",
      "Paris Saint-Germain",
      "AS Monaco",
      "Monaco",
      "Lille",
      "Marseille",
      "Olympique Marseille",
      "Olympique Lyonnais",
      "Lyon",
    ],
  },
  rugby: {
    Premiership: [
      "Saracens",
      "Leicester Tigers",
      "Northampton Saints",
      "Sale Sharks",
      "Harlequins",
      "Bath Rugby",
      "Bath",
    ],
    Top14: [
      "Stade Toulousain",
      "Toulouse",
      "Stade Rochelais",
      "La Rochelle",
      "Racing 92",
      "Stade Français",
      "Stade Francais",
      "Union Bordeaux Bègles",
      "Bordeaux",
    ],
    URC: [
      "Leinster",
      "Munster Rugby",
      "Munster",
      "Bulls",
      "Stormers",
      "Glasgow Warriors",
      "Ulster Rugby",
      "Ulster",
      "Sharks",
    ],
    SixNations: [
      "England",
      "Ireland",
      "Wales",
      "Scotland",
      "France",
      "Italy",
    ],
    RugbyChampionship: [
      "South Africa",
      "New Zealand",
      "Australia",
      "Argentina",
    ],
  },
};

export const PITCHSIDE_PICKS_TEAMS: Record<
  "football" | "rugby",
  readonly string[]
> = {
  football: [
    "Manchester City",
    "Liverpool",
    "Barcelona",
    "Real Madrid",
    "PSG",
    "Paris Saint Germain",
    "Paris Saint-Germain",
    "Arsenal",
    "Borussia Dortmund",
    "Bayern Munich",
    "Bayern München",
  ],
  rugby: ["South Africa", "New Zealand", "England", "France", "Ireland"],
};

function normalizeTeamName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const PREEMINENT_FOOTBALL_SET = new Set(
  Object.values(PREEMINENT_TEAMS.football)
    .flatMap((list) => list ?? [])
    .map(normalizeTeamName),
);

const PITCHSIDE_FOOTBALL_SET = new Set(
  PITCHSIDE_PICKS_TEAMS.football.map(normalizeTeamName),
);
const PITCHSIDE_RUGBY_SET = new Set(
  PITCHSIDE_PICKS_TEAMS.rugby.map(normalizeTeamName),
);

export function isPreeminentFootballClub(teamName: string | null | undefined): boolean {
  if (!teamName) return false;
  return PREEMINENT_FOOTBALL_SET.has(normalizeTeamName(teamName));
}

export function isPitchsidePickTeam(
  sport: "football" | "rugby",
  homeTeam: string | null | undefined,
  awayTeam: string | null | undefined,
): boolean {
  const set = sport === "football" ? PITCHSIDE_FOOTBALL_SET : PITCHSIDE_RUGBY_SET;
  const home = homeTeam ? normalizeTeamName(homeTeam) : "";
  const away = awayTeam ? normalizeTeamName(awayTeam) : "";
  return (home && set.has(home)) || (away && set.has(away));
}

export function fixtureHasPreeminentFootballSide(
  homeTeam: string | null | undefined,
  awayTeam: string | null | undefined,
): boolean {
  return (
    isPreeminentFootballClub(homeTeam) || isPreeminentFootballClub(awayTeam)
  );
}
