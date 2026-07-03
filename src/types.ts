/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface UserProfile {
  id: string;
  firstName: string;
  surname: string;
  email: string;
  dob: string;
  nickname: string;
  createdAt: string;
  emailVerified?: boolean;
  emailConfirmedAt?: string | null;
  isAdmin: boolean;
  agreedToTerms: boolean;
  nationality?: string;
  phone?: string;
  supportedTeam?: string;
  password?: string;
  isProfilePublic?: boolean;
  suspendedUntil?: string;
}

export interface SiteMessage {
  id: string;
  senderId: string;
  receiverId: string; // 'all' for site-wide
  subject: string;
  body: string;
  createdAt: string;
  read: boolean;
}

export enum SportType {
  FOOTBALL = "football",
  RUGBY = "rugby",
}

export interface Competition {
  id: string;
  name: string;
  sport: SportType;
  nationality?: string;
  logoUrl?: string;
  season?: string;
}

export interface Match {
  id: string;
  competitionId: string;
  sport: SportType;
  homeTeam: string;
  awayTeam: string;
  homeScore?: number; // Actual result (once played)
  awayScore?: number; // Actual result (once played)
  matchDate: string;
  status: "upcoming" | "live" | "completed";
  season?: string;
}

export interface Prediction {
  id: string;
  userId: string;
  matchId: string;
  predictedHomeScore: number;
  predictedAwayScore: number;
  pointsEarned?: number;
  createdAt: string;
}

export interface League {
  id: string;
  name: string;
  password?: string;
  competitionId: string;
  creatorId: string;
  creatorName: string;
  members: string[];
  inactiveMembers?: string[];
  isPublic?: boolean;
  maxParticipants?: number;
  season?: string;
  createdAt: string;
  updatedAt: string;
}
