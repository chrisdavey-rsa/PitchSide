import { useQuery } from "@tanstack/react-query";
import { dbFetchFollowingIds } from "../lib/userFollows";

export function useFollowingIdsQuery(userId?: string | null) {
  return useQuery({
    queryKey: ["userFollows", "following", userId || "guest"],
    queryFn: () => dbFetchFollowingIds(userId!),
    enabled: Boolean(userId),
    staleTime: 60_000,
  });
}
