/** Hide exact low member counts until a meaningful public threshold. */
export const LEAGUE_MEMBER_DISPLAY_THRESHOLD = 100;

export function formatLeagueMemberBadge(count: number): string {
  if (count >= LEAGUE_MEMBER_DISPLAY_THRESHOLD) {
    return `${count} member${count === 1 ? "" : "s"}`;
  }
  return "Active";
}

export function formatLeagueMemberCountCell(count: number): string {
  if (count >= LEAGUE_MEMBER_DISPLAY_THRESHOLD) return String(count);
  return "Active";
}
