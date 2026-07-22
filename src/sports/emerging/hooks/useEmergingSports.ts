/**
 * Emerging-sports profile + catalog hooks (isolated from Football/Rugby queries).
 */

import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../supabase';
import { normalizeRole, roleFromIsAdmin } from '../featureFlags';
import type {
  EmergingProfileSlice,
  F1Constructor,
  F1Driver,
  GolfPlayer,
  SportKey,
  UserRole,
} from '../types';

export const emergingQueryKeys = {
  profile: (userId: string) => ['emerging', 'profile', userId] as const,
  f1Constructors: ['emerging', 'f1_constructors'] as const,
  f1Drivers: ['emerging', 'f1_drivers'] as const,
  golfPlayers: ['emerging', 'golf_players'] as const,
};

/** Offline / empty-catalog scaffolding so UI is demoable before seed. */
const FALLBACK_CONSTRUCTORS: F1Constructor[] = [
  { id: 'mclaren', name: 'McLaren', nationality: 'British', countryCode: 'gb', teamColorHex: '#FF8000' },
  { id: 'ferrari', name: 'Ferrari', nationality: 'Italian', countryCode: 'it', teamColorHex: '#E8002D' },
  { id: 'red_bull', name: 'Red Bull Racing', nationality: 'Austrian', countryCode: 'at', teamColorHex: '#3671C6' },
  { id: 'mercedes', name: 'Mercedes', nationality: 'German', countryCode: 'de', teamColorHex: '#27F4D2' },
  { id: 'williams', name: 'Williams', nationality: 'British', countryCode: 'gb', teamColorHex: '#64C4FF' },
  { id: 'aston_martin', name: 'Aston Martin', nationality: 'British', countryCode: 'gb', teamColorHex: '#229971' },
  { id: 'alpine', name: 'Alpine', nationality: 'French', countryCode: 'fr', teamColorHex: '#0093CC' },
  { id: 'haas', name: 'Haas', nationality: 'American', countryCode: 'us', teamColorHex: '#B6BABD' },
  { id: 'racing_bulls', name: 'Racing Bulls', nationality: 'Italian', countryCode: 'it', teamColorHex: '#6692FF' },
  { id: 'sauber', name: 'Kick Sauber', nationality: 'Swiss', countryCode: 'ch', teamColorHex: '#52E252' },
  { id: 'cadillac', name: 'Cadillac', nationality: 'American', countryCode: 'us', teamColorHex: '#FFFFFF' },
];

const FALLBACK_DRIVERS: F1Driver[] = [
  { id: 'norris', name: 'Lando Norris', permanentNumber: 4, constructorId: 'mclaren', nationality: 'British', countryCode: 'gb', helmetImageUrl: null, teamColorHex: '#FF8000', constructorName: 'McLaren' },
  { id: 'piastri', name: 'Oscar Piastri', permanentNumber: 81, constructorId: 'mclaren', nationality: 'Australian', countryCode: 'au', helmetImageUrl: null, teamColorHex: '#FF8000', constructorName: 'McLaren' },
  { id: 'leclerc', name: 'Charles Leclerc', permanentNumber: 16, constructorId: 'ferrari', nationality: 'Monegasque', countryCode: 'mc', helmetImageUrl: null, teamColorHex: '#E8002D', constructorName: 'Ferrari' },
  { id: 'hamilton', name: 'Lewis Hamilton', permanentNumber: 44, constructorId: 'ferrari', nationality: 'British', countryCode: 'gb', helmetImageUrl: null, teamColorHex: '#E8002D', constructorName: 'Ferrari' },
  { id: 'verstappen', name: 'Max Verstappen', permanentNumber: 1, constructorId: 'red_bull', nationality: 'Dutch', countryCode: 'nl', helmetImageUrl: null, teamColorHex: '#3671C6', constructorName: 'Red Bull Racing' },
  { id: 'lawson', name: 'Liam Lawson', permanentNumber: 30, constructorId: 'red_bull', nationality: 'New Zealander', countryCode: 'nz', helmetImageUrl: null, teamColorHex: '#3671C6', constructorName: 'Red Bull Racing' },
  { id: 'russell', name: 'George Russell', permanentNumber: 63, constructorId: 'mercedes', nationality: 'British', countryCode: 'gb', helmetImageUrl: null, teamColorHex: '#27F4D2', constructorName: 'Mercedes' },
  { id: 'antonelli', name: 'Andrea Kimi Antonelli', permanentNumber: 12, constructorId: 'mercedes', nationality: 'Italian', countryCode: 'it', helmetImageUrl: null, teamColorHex: '#27F4D2', constructorName: 'Mercedes' },
  { id: 'albon', name: 'Alexander Albon', permanentNumber: 23, constructorId: 'williams', nationality: 'Thai', countryCode: 'th', helmetImageUrl: null, teamColorHex: '#64C4FF', constructorName: 'Williams' },
  { id: 'sainz', name: 'Carlos Sainz', permanentNumber: 55, constructorId: 'williams', nationality: 'Spanish', countryCode: 'es', helmetImageUrl: null, teamColorHex: '#64C4FF', constructorName: 'Williams' },
  { id: 'alonso', name: 'Fernando Alonso', permanentNumber: 14, constructorId: 'aston_martin', nationality: 'Spanish', countryCode: 'es', helmetImageUrl: null, teamColorHex: '#229971', constructorName: 'Aston Martin' },
  { id: 'stroll', name: 'Lance Stroll', permanentNumber: 18, constructorId: 'aston_martin', nationality: 'Canadian', countryCode: 'ca', helmetImageUrl: null, teamColorHex: '#229971', constructorName: 'Aston Martin' },
  { id: 'gasly', name: 'Pierre Gasly', permanentNumber: 10, constructorId: 'alpine', nationality: 'French', countryCode: 'fr', helmetImageUrl: null, teamColorHex: '#0093CC', constructorName: 'Alpine' },
  { id: 'colapinto', name: 'Franco Colapinto', permanentNumber: 43, constructorId: 'alpine', nationality: 'Argentine', countryCode: 'ar', helmetImageUrl: null, teamColorHex: '#0093CC', constructorName: 'Alpine' },
  { id: 'ocon', name: 'Esteban Ocon', permanentNumber: 31, constructorId: 'haas', nationality: 'French', countryCode: 'fr', helmetImageUrl: null, teamColorHex: '#B6BABD', constructorName: 'Haas' },
  { id: 'bearman', name: 'Oliver Bearman', permanentNumber: 87, constructorId: 'haas', nationality: 'British', countryCode: 'gb', helmetImageUrl: null, teamColorHex: '#B6BABD', constructorName: 'Haas' },
  { id: 'hadjar', name: 'Isack Hadjar', permanentNumber: 6, constructorId: 'racing_bulls', nationality: 'French', countryCode: 'fr', helmetImageUrl: null, teamColorHex: '#6692FF', constructorName: 'Racing Bulls' },
  { id: 'lindblad', name: 'Arvid Lindblad', permanentNumber: 41, constructorId: 'racing_bulls', nationality: 'British', countryCode: 'gb', helmetImageUrl: null, teamColorHex: '#6692FF', constructorName: 'Racing Bulls' },
  { id: 'hulkenberg', name: 'Nico Hulkenberg', permanentNumber: 27, constructorId: 'sauber', nationality: 'German', countryCode: 'de', helmetImageUrl: null, teamColorHex: '#52E252', constructorName: 'Kick Sauber' },
  { id: 'bortoleto', name: 'Gabriel Bortoleto', permanentNumber: 5, constructorId: 'sauber', nationality: 'Brazilian', countryCode: 'br', helmetImageUrl: null, teamColorHex: '#52E252', constructorName: 'Kick Sauber' },
  { id: 'bottas', name: 'Valtteri Bottas', permanentNumber: 77, constructorId: 'cadillac', nationality: 'Finnish', countryCode: 'fi', helmetImageUrl: null, teamColorHex: '#FFFFFF', constructorName: 'Cadillac' },
  { id: 'drugovich', name: 'Felipe Drugovich', permanentNumber: 11, constructorId: 'cadillac', nationality: 'Brazilian', countryCode: 'br', helmetImageUrl: null, teamColorHex: '#FFFFFF', constructorName: 'Cadillac' },
];

const FALLBACK_GOLFERS: GolfPlayer[] = [
  { id: 'scheffler', name: 'Scottie Scheffler', nationality: 'American', countryCode: 'us', pgaWorldRanking: 1, profileImageUrl: null },
  { id: 'mcilroy', name: 'Rory McIlroy', nationality: 'Northern Irish', countryCode: 'gb-nir', pgaWorldRanking: 2, profileImageUrl: null },
  { id: 'rahm', name: 'Jon Rahm', nationality: 'Spanish', countryCode: 'es', pgaWorldRanking: 3, profileImageUrl: null },
  { id: 'schauffele', name: 'Xander Schauffele', nationality: 'American', countryCode: 'us', pgaWorldRanking: 4, profileImageUrl: null },
  { id: 'homa', name: 'Max Homa', nationality: 'American', countryCode: 'us', pgaWorldRanking: 12, profileImageUrl: null },
];


function mapConstructor(row: Record<string, unknown>): F1Constructor {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    nationality: (row.nationality as string) ?? null,
    countryCode: (row.country_code as string) ?? null,
    teamColorHex: (row.team_color_hex as string) ?? null,
  };
}

function mapDriver(
  row: Record<string, unknown>,
  constructorsById: Map<string, F1Constructor>,
): F1Driver {
  const constructorId = (row.constructor_id as string) ?? null;
  const ctor = constructorId ? constructorsById.get(constructorId) : undefined;
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    permanentNumber:
      row.permanent_number != null ? Number(row.permanent_number) : null,
    constructorId,
    nationality: (row.nationality as string) ?? null,
    countryCode: (row.country_code as string) ?? null,
    helmetImageUrl: (row.helmet_image_url as string) ?? null,
    teamColorHex: ctor?.teamColorHex ?? null,
    constructorName: ctor?.name ?? null,
  };
}

function mapGolfer(row: Record<string, unknown>): GolfPlayer {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    nationality: (row.nationality as string) ?? null,
    countryCode: (row.country_code as string) ?? null,
    pgaWorldRanking:
      row.pga_world_ranking != null ? Number(row.pga_world_ranking) : null,
    profileImageUrl: (row.profile_image_url as string) ?? null,
  };
}

function parseSelectedSports(raw: unknown): SportKey[] {
  if (Array.isArray(raw)) {
    return raw.filter((s): s is SportKey => typeof s === 'string') as SportKey[];
  }
  return ['football', 'rugby'];
}

export async function fetchEmergingProfile(
  userId: string,
  fallbackIsAdmin = false,
): Promise<EmergingProfileSlice> {
  if (!supabase) {
    return {
      userId,
      role: roleFromIsAdmin(fallbackIsAdmin),
      selectedSports: ['football', 'rugby'],
      favoriteF1Team: null,
      favoriteGolfer: null,
      golfMulligansAvailable: 0,
    };
  }

  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, role, is_admin, selected_sports, favorite_f1_team, favorite_golfer, golf_mulligans_available',
    )
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) {
    console.warn('[emerging] profile fetch failed', error?.message);
    return {
      userId,
      role: roleFromIsAdmin(fallbackIsAdmin),
      selectedSports: ['football', 'rugby'],
      favoriteF1Team: null,
      favoriteGolfer: null,
      golfMulligansAvailable: 0,
    };
  }

  return {
    userId,
    role: data.is_admin
      ? 'admin'
      : normalizeRole(data.role, Boolean(data.is_admin)),
    selectedSports: parseSelectedSports(data.selected_sports),
    favoriteF1Team: data.favorite_f1_team ?? null,
    favoriteGolfer: data.favorite_golfer ?? null,
    golfMulligansAvailable: Number(data.golf_mulligans_available) || 0,
  };
}

export function useEmergingProfile(userId?: string, fallbackIsAdmin = false) {
  return useQuery({
    queryKey: emergingQueryKeys.profile(userId || 'guest'),
    queryFn: () => fetchEmergingProfile(userId!, fallbackIsAdmin),
    enabled: !!userId,
  });
}

export function useF1ConstructorsQuery() {
  return useQuery({
    queryKey: emergingQueryKeys.f1Constructors,
    queryFn: async (): Promise<F1Constructor[]> => {
      if (!supabase) return [];
      const { data, error } = await supabase
        .from('f1_constructors')
        .select('*')
        .order('name');
      if (error) throw error;
      const rows = (data || []).map((r) => mapConstructor(r as Record<string, unknown>));
      return rows.length > 0 ? rows : FALLBACK_CONSTRUCTORS;
    },
    staleTime: 60 * 60_000,
  });
}

export function useF1DriversQuery() {
  const constructorsQuery = useF1ConstructorsQuery();
  return useQuery({
    queryKey: emergingQueryKeys.f1Drivers,
    queryFn: async (): Promise<F1Driver[]> => {
      if (!supabase) return [];
      const { data, error } = await supabase
        .from('f1_drivers')
        .select('*')
        .order('name')
        .range(0, 199);
      if (error) throw error;
      const byId = new Map(
        (constructorsQuery.data || []).map((c) => [c.id, c] as const),
      );
      const mapped = (data || []).map((r) =>
        mapDriver(r as Record<string, unknown>, byId),
      );
      return mapped.length > 0 ? mapped : FALLBACK_DRIVERS;
    },
    enabled: constructorsQuery.isSuccess || constructorsQuery.isError,
    staleTime: 60 * 60_000,
  });
}

export function useGolfPlayersQuery() {
  return useQuery({
    queryKey: emergingQueryKeys.golfPlayers,
    queryFn: async (): Promise<GolfPlayer[]> => {
      if (!supabase) return [];
      const { data, error } = await supabase
        .from('golf_players')
        .select('*')
        .order('pga_world_ranking', { ascending: true, nullsFirst: false });
      if (error) throw error;
      const rows = (data || []).map((r) => mapGolfer(r as Record<string, unknown>));
      return rows.length > 0 ? rows : FALLBACK_GOLFERS;
    },
    staleTime: 60 * 60_000,
  });
}

export async function saveEmergingPreferences(input: {
  userId: string;
  selectedSports: SportKey[];
  favoriteF1Team?: string | null;
  favoriteGolfer?: string | null;
}): Promise<void> {
  if (!supabase) throw new Error('Database not connected.');
  const { error } = await supabase
    .from('profiles')
    .update({
      selected_sports: input.selectedSports,
      favorite_f1_team: input.favoriteF1Team ?? null,
      favorite_golfer: input.favoriteGolfer ?? null,
    })
    .eq('id', input.userId);
  if (error) throw error;
}

export async function requestEmergingSportNotify(
  userId: string,
  sportKey: 'golf' | 'formula1',
): Promise<void> {
  if (!supabase) return;
  // Lightweight interest flag inside seen_features / selected_sports metadata.
  const { data } = await supabase
    .from('profiles')
    .select('seen_features')
    .eq('id', userId)
    .maybeSingle();
  const seen =
    data?.seen_features && typeof data.seen_features === 'object'
      ? { ...(data.seen_features as Record<string, boolean>) }
      : {};
  seen[`notify_${sportKey}`] = true;
  await supabase.from('profiles').update({ seen_features: seen }).eq('id', userId);
}

export function useUserRole(
  userId?: string,
  fallbackIsAdmin = false,
): UserRole {
  const { data } = useEmergingProfile(userId, fallbackIsAdmin);
  return data?.role ?? roleFromIsAdmin(fallbackIsAdmin);
}

/** Local optimistic mulligan counter wired to profiles.golf_mulligans_available. */
export function useGolfMulliganWallet(userId?: string) {
  const queryClient = useQueryClient();
  const { data: profile } = useEmergingProfile(userId);
  const [pending, setPending] = useState(false);

  const available = profile?.golfMulligansAvailable ?? 0;

  const consumeMulligan = useCallback(async () => {
    if (!supabase || !userId || available <= 0) return false;
    setPending(true);
    try {
      const next = available - 1;
      const { error } = await supabase
        .from('profiles')
        .update({ golf_mulligans_available: next })
        .eq('id', userId);
      if (error) throw error;
      await queryClient.invalidateQueries({
        queryKey: emergingQueryKeys.profile(userId),
      });
      return true;
    } catch (err) {
      console.warn('[emerging] mulligan consume failed', err);
      return false;
    } finally {
      setPending(false);
    }
  }, [available, queryClient, userId]);

  return { available, pending, consumeMulligan };
}
