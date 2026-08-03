/**
 * Global feature-flag helper for emerging sports (Golf / F1).
 * Admins get full access; players see coming-soon / notify-me surfaces.
 */

import type { EmergingSportKey, UserRole } from './types';

const EMERGING_KEYS = new Set<EmergingSportKey>(['golf', 'formula1']);

export function isEmergingSport(sportKey: string): sportKey is EmergingSportKey {
  return EMERGING_KEYS.has(sportKey as EmergingSportKey);
}

/**
 * Golf / F1 are globally Coming Soon — not selectable for any role.
 * @param sportKey  e.g. 'golf' | 'formula1' (also accepts core sports → always true)
 * @param _userRole kept for call-site compatibility
 */
export function isSportAccessible(
  sportKey: string,
  _userRole?: UserRole | string | null,
): boolean {
  if (!isEmergingSport(sportKey)) return true;
  return false;
}

export function normalizeRole(
  role: UserRole | string | null | undefined,
  fallbackIsAdmin = false,
): UserRole {
  if (role === 'admin' || role === 'player') return role;
  return fallbackIsAdmin ? 'admin' : 'player';
}

/** Derive role when only the legacy `is_admin` flag is available in memory. */
export function roleFromIsAdmin(isAdmin: boolean | null | undefined): UserRole {
  return isAdmin ? 'admin' : 'player';
}
