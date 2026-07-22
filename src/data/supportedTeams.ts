/**
 * Supported-team helpers for signup / profile editors.
 * Primary source: public.teams (API-Sports cache). Static list is fallback only.
 * Writes still go to profiles.supported_team (client field: supportedTeam).
 */

export type TeamSport = "Football" | "Rugby";
export type TeamCategory = "country" | "club";

export interface SupportedTeamOption {
  id?: string;
  name: string;
  sport: TeamSport;
  category: TeamCategory;
  /** Lowercase ISO / flagcdn code — typically for category === "country". */
  countryCode?: string;
  apiSportsId?: number | null;
}

/** Static fallback if `public.teams` is empty / unreachable. */
export const SUPPORTED_TEAMS: SupportedTeamOption[] = [
  // —— Football countries ——
  { name: "England", sport: "Football", category: "country", countryCode: "gb-eng" },
  { name: "Scotland", sport: "Football", category: "country", countryCode: "gb-sct" },
  { name: "Wales", sport: "Football", category: "country", countryCode: "gb-wls" },
  { name: "Ireland", sport: "Football", category: "country", countryCode: "ie" },
  { name: "France", sport: "Football", category: "country", countryCode: "fr" },
  { name: "Germany", sport: "Football", category: "country", countryCode: "de" },
  { name: "Spain", sport: "Football", category: "country", countryCode: "es" },
  { name: "Portugal", sport: "Football", category: "country", countryCode: "pt" },
  { name: "Italy", sport: "Football", category: "country", countryCode: "it" },
  { name: "Netherlands", sport: "Football", category: "country", countryCode: "nl" },
  { name: "Belgium", sport: "Football", category: "country", countryCode: "be" },
  { name: "Brazil", sport: "Football", category: "country", countryCode: "br" },
  { name: "Argentina", sport: "Football", category: "country", countryCode: "ar" },
  { name: "United States", sport: "Football", category: "country", countryCode: "us" },
  { name: "Canada", sport: "Football", category: "country", countryCode: "ca" },
  { name: "Mexico", sport: "Football", category: "country", countryCode: "mx" },
  { name: "Japan", sport: "Football", category: "country", countryCode: "jp" },
  { name: "Australia", sport: "Football", category: "country", countryCode: "au" },
  { name: "South Africa", sport: "Football", category: "country", countryCode: "za" },
  { name: "New Zealand", sport: "Football", category: "country", countryCode: "nz" },

  // —— Football clubs ——
  { name: "Arsenal", sport: "Football", category: "club" },
  { name: "Aston Villa", sport: "Football", category: "club" },
  { name: "Chelsea", sport: "Football", category: "club" },
  { name: "Liverpool", sport: "Football", category: "club" },
  { name: "Manchester City", sport: "Football", category: "club" },
  { name: "Manchester United", sport: "Football", category: "club" },
  { name: "Tottenham Hotspur", sport: "Football", category: "club" },
  { name: "Real Madrid", sport: "Football", category: "club" },
  { name: "Barcelona", sport: "Football", category: "club" },
  { name: "Bayern Munich", sport: "Football", category: "club" },
  { name: "Paris Saint-Germain", sport: "Football", category: "club" },
  { name: "Celtic", sport: "Football", category: "club" },
  { name: "Rangers", sport: "Football", category: "club" },

  // —— Rugby countries ——
  { name: "All Blacks", sport: "Rugby", category: "country", countryCode: "nz" },
  { name: "Springboks", sport: "Rugby", category: "country", countryCode: "za" },
  { name: "Wallabies", sport: "Rugby", category: "country", countryCode: "au" },
  { name: "England", sport: "Rugby", category: "country", countryCode: "gb-eng" },
  { name: "Ireland", sport: "Rugby", category: "country", countryCode: "ie" },
  { name: "Wales", sport: "Rugby", category: "country", countryCode: "gb-wls" },
  { name: "Scotland", sport: "Rugby", category: "country", countryCode: "gb-sct" },
  { name: "France", sport: "Rugby", category: "country", countryCode: "fr" },
  { name: "Italy", sport: "Rugby", category: "country", countryCode: "it" },
  { name: "Japan", sport: "Rugby", category: "country", countryCode: "jp" },
  { name: "Los Pumas", sport: "Rugby", category: "country", countryCode: "ar" },
  { name: "Fiji", sport: "Rugby", category: "country", countryCode: "fj" },

  // —— Rugby clubs ——
  { name: "Leinster", sport: "Rugby", category: "club" },
  { name: "Munster", sport: "Rugby", category: "club" },
  { name: "Saracens", sport: "Rugby", category: "club" },
  { name: "Leicester Tigers", sport: "Rugby", category: "club" },
  { name: "Toulouse", sport: "Rugby", category: "club" },
  { name: "La Rochelle", sport: "Rugby", category: "club" },
  { name: "Stormers", sport: "Rugby", category: "club" },
  { name: "Crusaders", sport: "Rugby", category: "club" },
];

export function sportLabelToDb(sport: TeamSport): "football" | "rugby" {
  return sport === "Rugby" ? "rugby" : "football";
}

export function teamsForSport(
  catalog: SupportedTeamOption[],
  sport: TeamSport,
): SupportedTeamOption[] {
  return catalog.filter((t) => t.sport === sport);
}

export function filterTeams(
  catalog: SupportedTeamOption[],
  sport: TeamSport,
  search: string,
): { countries: SupportedTeamOption[]; clubs: SupportedTeamOption[] } {
  const q = search.trim().toLowerCase();
  const list = teamsForSport(catalog, sport).filter(
    (t) => !q || t.name.toLowerCase().includes(q),
  );
  return {
    countries: list.filter((t) => t.category === "country"),
    clubs: list.filter((t) => t.category === "club"),
  };
}

/** Prefer DB catalog; fall back to static list when empty. */
export function resolveTeamCatalog(
  dbTeams: SupportedTeamOption[] | undefined,
): SupportedTeamOption[] {
  return dbTeams && dbTeams.length > 0 ? dbTeams : SUPPORTED_TEAMS;
}
