/**
 * Emerging sports (Golf + Formula 1) — isolated from Football/Rugby domain types.
 */

export type EmergingSportKey = 'golf' | 'formula1';

export type CoreSportKey = 'football' | 'rugby';

export type SportKey = CoreSportKey | EmergingSportKey;

export type UserRole = 'admin' | 'player';

export type F1Constructor = {
  id: string;
  name: string;
  nationality: string | null;
  countryCode: string | null;
  teamColorHex: string | null;
};

export type F1Driver = {
  id: string;
  name: string;
  permanentNumber: number | null;
  constructorId: string | null;
  nationality: string | null;
  countryCode: string | null;
  helmetImageUrl: string | null;
  /** Joined constructor colour for helmet / accents. */
  teamColorHex?: string | null;
  constructorName?: string | null;
};

export type GolfPlayer = {
  id: string;
  name: string;
  nationality: string | null;
  countryCode: string | null;
  pgaWorldRanking: number | null;
  profileImageUrl: string | null;
};

export type EmergingProfileSlice = {
  userId: string;
  role: UserRole;
  selectedSports: SportKey[];
  favoriteF1Team: string | null;
  favoriteGolfer: string | null;
  golfMulligansAvailable: number;
};

/** Grid size for qualifying (top 10) vs race (top 6). */
export type F1GridMode = 'quali_top_10' | 'race_top_6';

export function gridSlotsForMode(mode: F1GridMode): number {
  return mode === 'quali_top_10' ? 10 : 6;
}

export const EMERGING_SPORT_META: Record<
  EmergingSportKey,
  { label: string; badge: string }
> = {
  golf: {
    label: 'Golf',
    badge: 'Coming soon',
  },
  formula1: {
    label: 'Formula 1',
    badge: 'Coming soon',
  },
};
