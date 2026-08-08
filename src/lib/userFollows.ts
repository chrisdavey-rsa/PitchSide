/**
 * User follow helpers — invite mutual-follow + following list for leaderboards.
 */

import { supabase } from "../supabase";

/** Create reciprocal follow edges with an inviter (SECURITY DEFINER RPC). */
export async function dbEstablishMutualFollow(
  otherUserId: string,
): Promise<void> {
  if (!supabase || !otherUserId.trim()) return;
  const { error } = await supabase.rpc("establish_mutual_follow", {
    p_other_user_id: otherUserId.trim(),
  });
  if (error) {
    console.warn("[userFollows] establish_mutual_follow failed:", error.message);
  }
}

/** IDs the current user is following (for Friends Only leaderboards). */
export async function dbFetchFollowingIds(userId: string): Promise<string[]> {
  if (!supabase || !userId) return [];
  const { data, error } = await supabase
    .from("user_follows")
    .select("following_id")
    .eq("follower_id", userId);
  if (error) {
    console.warn("[userFollows] fetch following failed:", error.message);
    return [];
  }
  return (data || [])
    .map((row) => row.following_id)
    .filter((id): id is string => Boolean(id));
}

/**
 * If a pending invite (or URL) carries `ref`, establish mutual follow once
 * the new/current user is authenticated. Safe to call repeatedly (ON CONFLICT).
 */
export async function processInviteFollowRef(
  currentUserId: string,
  inviterId?: string | null,
): Promise<void> {
  const other = (inviterId || "").trim();
  if (!other || !currentUserId || other === currentUserId) return;
  await dbEstablishMutualFollow(other);
}
