/**
 * Preeminent + PitchSide Picks team matrices for Edge sync.
 * Keep aligned with src/constants/teamMatrices.ts
 */

const PREEMINENT_FOOTBALL = [
  "Manchester City",
  "Arsenal",
  "Liverpool",
  "Manchester United",
  "Chelsea",
  "Tottenham",
  "Real Madrid",
  "Barcelona",
  "Atlético Madrid",
  "Atletico Madrid",
  "Sevilla",
  "Valencia",
  "Villarreal",
  "Real Sociedad",
  "Inter Milan",
  "Inter",
  "AC Milan",
  "Milan",
  "Juventus",
  "Roma",
  "AS Roma",
  "Napoli",
  "Atalanta",
  "Bayern Munich",
  "Bayern München",
  "Borussia Dortmund",
  "RB Leipzig",
  "Bayer Leverkusen",
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
];

const PITCHSIDE_FOOTBALL = [
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
];

const PITCHSIDE_RUGBY = [
  "South Africa",
  "New Zealand",
  "England",
  "France",
  "Ireland",
];

function normalizeTeamName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const PREEMINENT_SET = new Set(PREEMINENT_FOOTBALL.map(normalizeTeamName));
const PICKS_FB = new Set(PITCHSIDE_FOOTBALL.map(normalizeTeamName));
const PICKS_RU = new Set(PITCHSIDE_RUGBY.map(normalizeTeamName));

export function isPreeminentFootballClub(teamName: string | null | undefined): boolean {
  if (!teamName) return false;
  return PREEMINENT_SET.has(normalizeTeamName(teamName));
}

export function fixtureHasPreeminentFootballSide(
  homeTeam: string | null | undefined,
  awayTeam: string | null | undefined,
): boolean {
  return (
    isPreeminentFootballClub(homeTeam) || isPreeminentFootballClub(awayTeam)
  );
}

export function isPitchsidePickTeam(
  sport: "football" | "rugby",
  homeTeam: string | null | undefined,
  awayTeam: string | null | undefined,
): boolean {
  const set = sport === "football" ? PICKS_FB : PICKS_RU;
  const home = homeTeam ? normalizeTeamName(homeTeam) : "";
  const away = awayTeam ? normalizeTeamName(awayTeam) : "";
  return (!!home && set.has(home)) || (!!away && set.has(away));
}
