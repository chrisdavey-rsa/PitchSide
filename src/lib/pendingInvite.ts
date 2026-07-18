/** Persists an invite deep-link across login / signup so users aren't lost. */
export const PENDING_INVITE_KEY = "pitchside_pending_invite_league";

export type PendingInvite = {
  leagueId: string;
  /** Join password from invite URL `code` query param (optional). */
  code?: string;
};

export function storePendingInvite(leagueId: string, code?: string): void {
  if (!leagueId) return;
  const payload: PendingInvite = {
    leagueId,
    ...(code?.trim() ? { code: code.trim() } : {}),
  };
  localStorage.setItem(PENDING_INVITE_KEY, JSON.stringify(payload));
}

export function readPendingInvite(): PendingInvite | null {
  const raw = localStorage.getItem(PENDING_INVITE_KEY);
  if (!raw) return null;

  // Legacy: plain league id string
  if (!raw.startsWith("{")) {
    return { leagueId: raw };
  }

  try {
    const parsed = JSON.parse(raw) as PendingInvite;
    if (!parsed?.leagueId) return null;
    return {
      leagueId: parsed.leagueId,
      ...(parsed.code ? { code: parsed.code } : {}),
    };
  } catch {
    return { leagueId: raw };
  }
}

/** Path + query for navigating back to an invite after auth. */
export function pendingInviteToPath(invite: PendingInvite): string {
  const base = `/join/${encodeURIComponent(invite.leagueId)}`;
  if (!invite.code) return base;
  return `${base}?code=${encodeURIComponent(invite.code)}`;
}

export function clearPendingInvite(): void {
  localStorage.removeItem(PENDING_INVITE_KEY);
}
