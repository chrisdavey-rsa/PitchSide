/** Shared leaderboard row / scope types used by LeaderboardsPage and Dashboard. */

export interface LeaderboardItem {
  playerId: string;
  rank: number;
  nickname: string;
  firstName?: string;
  surname?: string;
  nationality: string;
  /** Raw submitted predictions (engagement). */
  displayPredictions: number;
  /** Completed (FT) predictions — accuracy & Strike Rate denominator. */
  displaySettledPredictions: number;
  displayAccuracy: string;
  displayPoints: number;
  displayPerfectHits: number;
  displayGhostPoints: number;
  displayDropsUsed: number;
  displayDropsAllowed: number;
  /** Amber "As It Stands" live points — never mixed into locked displayPoints. */
  displayProvisionalPoints?: number;
  isCurrentUser: boolean;
  isProfilePublic: boolean;
}

export type LeaderboardScope = "league" | "global";
