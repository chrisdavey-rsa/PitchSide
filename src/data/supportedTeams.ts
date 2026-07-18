/**
 * Supported-team catalog for signup / profile editors.
 * Writes to profiles.supported_team (client field: supportedTeam).
 */

export type TeamSport = "Football" | "Rugby";
export type TeamCategory = "country" | "club";

export interface SupportedTeamOption {
  name: string;
  sport: TeamSport;
  category: TeamCategory;
  /** Lowercase ISO / flagcdn code — only for category === "country". */
  countryCode?: string;
}

/** National sides (Countries) + clubs, split for the team picker UI. */
export const SUPPORTED_TEAMS: SupportedTeamOption[] = [
  // —— Football countries (World Cup relevant) ——
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
  { name: "Bournemouth", sport: "Football", category: "club" },
  { name: "Brentford", sport: "Football", category: "club" },
  { name: "Brighton & Hove Albion", sport: "Football", category: "club" },
  { name: "Chelsea", sport: "Football", category: "club" },
  { name: "Crystal Palace", sport: "Football", category: "club" },
  { name: "Everton", sport: "Football", category: "club" },
  { name: "Fulham", sport: "Football", category: "club" },
  { name: "Ipswich Town", sport: "Football", category: "club" },
  { name: "Leicester City", sport: "Football", category: "club" },
  { name: "Liverpool", sport: "Football", category: "club" },
  { name: "Manchester City", sport: "Football", category: "club" },
  { name: "Manchester United", sport: "Football", category: "club" },
  { name: "Newcastle United", sport: "Football", category: "club" },
  { name: "Nottingham Forest", sport: "Football", category: "club" },
  { name: "Southampton", sport: "Football", category: "club" },
  { name: "Tottenham Hotspur", sport: "Football", category: "club" },
  { name: "West Ham United", sport: "Football", category: "club" },
  { name: "Wolverhampton Wanderers", sport: "Football", category: "club" },
  { name: "Real Madrid", sport: "Football", category: "club" },
  { name: "Barcelona", sport: "Football", category: "club" },
  { name: "Bayern Munich", sport: "Football", category: "club" },
  { name: "Paris Saint-Germain", sport: "Football", category: "club" },
  { name: "Inter Milan", sport: "Football", category: "club" },
  { name: "AC Milan", sport: "Football", category: "club" },
  { name: "Juventus", sport: "Football", category: "club" },
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
  { name: "Samoa", sport: "Rugby", category: "country", countryCode: "ws" },

  // —— Rugby clubs ——
  { name: "Leinster", sport: "Rugby", category: "club" },
  { name: "Munster", sport: "Rugby", category: "club" },
  { name: "Saracens", sport: "Rugby", category: "club" },
  { name: "Leicester Tigers", sport: "Rugby", category: "club" },
  { name: "Toulouse", sport: "Rugby", category: "club" },
  { name: "La Rochelle", sport: "Rugby", category: "club" },
  { name: "Northampton Saints", sport: "Rugby", category: "club" },
  { name: "Harlequins", sport: "Rugby", category: "club" },
  { name: "Bath", sport: "Rugby", category: "club" },
  { name: "Stormers", sport: "Rugby", category: "club" },
  { name: "Bulls", sport: "Rugby", category: "club" },
  { name: "Crusaders", sport: "Rugby", category: "club" },
  { name: "Blues", sport: "Rugby", category: "club" },
];

export function teamsForSport(sport: TeamSport): SupportedTeamOption[] {
  return SUPPORTED_TEAMS.filter((t) => t.sport === sport);
}

export function filterTeams(
  sport: TeamSport,
  search: string,
): { countries: SupportedTeamOption[]; clubs: SupportedTeamOption[] } {
  const q = search.trim().toLowerCase();
  const list = teamsForSport(sport).filter(
    (t) => !q || t.name.toLowerCase().includes(q),
  );
  return {
    countries: list.filter((t) => t.category === "country"),
    clubs: list.filter((t) => t.category === "club"),
  };
}
