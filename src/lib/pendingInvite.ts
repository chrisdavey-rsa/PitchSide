/** Persists an invite deep-link across login / signup so users aren't lost. */
export const PENDING_INVITE_KEY = "pitchside_pending_invite_league";

export function storePendingInvite(leagueId: string): void {
  if (!leagueId) return;
  localStorage.setItem(PENDING_INVITE_KEY, leagueId);
}

export function readPendingInvite(): string | null {
  return localStorage.getItem(PENDING_INVITE_KEY);
}

export function clearPendingInvite(): void {
  localStorage.removeItem(PENDING_INVITE_KEY);
}
