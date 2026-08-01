/**
 * Display-name helpers for fixture team labels.
 */

const TEAM_ALIASES: Array<{ match: RegExp; label: string }> = [
  { match: /^heart\s+of\s+midlothian$/i, label: "Hearts" },
];

/** Map verbose API team names to short UI labels. */
export function displayTeamName(name: string | null | undefined): string {
  const raw = (name ?? "").trim();
  if (!raw) return "";
  for (const alias of TEAM_ALIASES) {
    if (alias.match.test(raw)) return alias.label;
  }
  return raw;
}
