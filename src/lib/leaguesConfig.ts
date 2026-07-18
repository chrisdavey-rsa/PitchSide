/**
 * System league ids and helpers for New Game Rules (multi-sport social leagues).
 */
export const GLOBAL_LEAGUE_ID = "GLOBAL_LEAGUE";

export function isGlobalLeague(leagueId: string | null | undefined): boolean {
  return leagueId === GLOBAL_LEAGUE_ID;
}
