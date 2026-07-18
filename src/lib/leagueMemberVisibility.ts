/**
 * Client-side list truncation for League Hub standings.
 * Full member/standings data is fetched once; expansion only slices local state.
 */

export type RankedMember = {
  playerId: string;
};

export type VisibleMembersResult<T extends RankedMember> = {
  /** Rows to render, in original rank order. */
  visible: T[];
  /** Original 1-based ranks keyed by playerId. */
  rankById: Map<string, number>;
  /** Private leagues: more others available beyond the current slice. */
  canShowMore: boolean;
  /** Global leagues: count of players not shown. */
  additionalCount: number;
};

/**
 * Private: current user + top N others (initial 9, then +10 per Show More).
 * Global: alphabetical member list — show up to 20 (you + 19 others);
 * no Show More — use additionalCount copy. Small rosters show everyone.
 */
export function selectVisibleRankedMembers<T extends RankedMember>(
  ranked: T[],
  currentUserId: string,
  options: {
    isGlobal: boolean;
    /** Extra others beyond the initial 9 (private only). Multiples of 10. */
    extraOthers?: number;
  },
): VisibleMembersResult<T> {
  const rankById = new Map<string, number>();
  ranked.forEach((row, idx) => rankById.set(row.playerId, idx + 1));

  if (ranked.length === 0) {
    return {
      visible: [],
      rankById,
      canShowMore: false,
      additionalCount: 0,
    };
  }

  const me = ranked.find((r) => r.playerId === currentUserId);
  const others = ranked.filter((r) => r.playerId !== currentUserId);

  if (options.isGlobal) {
    if (ranked.length <= 20) {
      return {
        visible: ranked,
        rankById,
        canShowMore: false,
        additionalCount: 0,
      };
    }
    const othersVisible = others.slice(0, 19);
    const idSet = new Set(othersVisible.map((r) => r.playerId));
    if (me) idSet.add(me.playerId);
    const visible = ranked.filter((r) => idSet.has(r.playerId));
    return {
      visible,
      rankById,
      canShowMore: false,
      additionalCount: Math.max(0, ranked.length - visible.length),
    };
  }

  const extra = Math.max(0, options.extraOthers ?? 0);
  const othersLimit = 9 + extra;
  const othersVisible = others.slice(0, othersLimit);
  const idSet = new Set(othersVisible.map((r) => r.playerId));
  if (me) idSet.add(me.playerId);
  const visible = ranked.filter((r) => idSet.has(r.playerId));

  return {
    visible,
    rankById,
    canShowMore: others.length > othersLimit,
    additionalCount: Math.max(0, ranked.length - visible.length),
  };
}
