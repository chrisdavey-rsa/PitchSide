export const queryKeys = {
  matches: ['matches'] as const,
  activeCompetitions: ['activeCompetitions'] as const,
  predictions: (userId: string) => ['predictions', userId] as const,
  leagueStandingsPredictions: (leagueId: string) =>
    ['leagueStandingsPredictions', leagueId] as const,
  leagues: ['leagues'] as const,
  userLeagues: (userId: string) => ['userLeagues', userId] as const,
  leagueMembers: (leagueId: string) => ['leagueMembers', leagueId] as const,
  leaguesMembership: (leagueIds: string[]) =>
    ['leaguesMembership', [...leagueIds].sort().join(',')] as const,
  leaderboard: ['leaderboard'] as const,
  /** Sum of provisional_points per user across currently live matches. */
  liveProvisional: (liveMatchIds: string[]) =>
    ['liveProvisional', [...liveMatchIds].sort().join(',')] as const,
  players: ['players'] as const,
  teams: ['teams'] as const,
};
