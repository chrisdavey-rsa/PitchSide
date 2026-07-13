export const queryKeys = {
  matches: ['matches'] as const,
  predictions: (userId: string) => ['predictions', userId] as const,
  leagues: ['leagues'] as const,
  userLeagues: (userId: string) => ['userLeagues', userId] as const,
  leagueMembers: (leagueId: string) => ['leagueMembers', leagueId] as const,
  leaderboard: ['leaderboard'] as const,
  players: ['players'] as const,
};
