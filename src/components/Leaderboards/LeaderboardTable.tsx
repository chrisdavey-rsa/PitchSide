/**
 * Friends-only leaderboard controls + row filtering helpers.
 * (Table markup remains in LeaderboardsPage; this module owns the friends gate.)
 */

import React from "react";
import { Users } from "lucide-react";

export type FriendsOnlyToggleProps = {
  enabled: boolean;
  onChange: (next: boolean) => void;
  followingCount: number;
  disabled?: boolean;
};

/** Toggle placed above the leaderboard list. */
export function FriendsOnlyToggle({
  enabled,
  onChange,
  followingCount,
  disabled = false,
}: FriendsOnlyToggleProps) {
  return (
    <div
      data-no-swipe="true"
      className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800"
    >
      <div className="flex items-center gap-2 min-w-0">
        <Users className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden />
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-200 font-mono uppercase tracking-wider">
            Friends Only
          </p>
          <p className="text-[10px] text-slate-500 font-sans truncate">
            {followingCount > 0
              ? `Showing you + ${followingCount} followed player${followingCount === 1 ? "" : "s"}`
              : "Follow players via invite links to build your friends list"}
          </p>
        </div>
      </div>
      <label
        className={`relative inline-flex items-center ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <input
          type="checkbox"
          className="sr-only peer"
          checked={enabled}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          aria-label="Friends only leaderboard"
        />
        <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500 peer-disabled:opacity-40" />
      </label>
    </div>
  );
}

/** Keep current user + anyone they follow. */
export function filterLeaderboardToFriends<T extends { playerId: string }>(
  rows: T[],
  currentUserId: string,
  followingIds: string[],
): T[] {
  const allowed = new Set<string>([currentUserId, ...followingIds]);
  return rows.filter((row) => allowed.has(row.playerId));
}

export default FriendsOnlyToggle;
