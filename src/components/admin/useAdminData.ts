import { useState, useEffect, useCallback } from 'react';
import { dbFetchMatches, dbFetchLeagues, dbFetchLeaguesMembership, dbFetchArchivedPlayers } from '../../supabase';
import { League, Match } from '../../types';

export interface AdminDataState {
  fixtures: Match[];
  leagues: League[];
  archivedUsers: any[];
  loadingFixtures: boolean;
  loadingLeagues: boolean;
  loadingArchives: boolean;
  refreshing: boolean;
  fetchFixtures: () => Promise<void>;
  fetchLeagues: () => Promise<void>;
  fetchArchives: () => Promise<void>;
  handleRefresh: () => void;
}

export function useAdminData(activeTab: string): AdminDataState {
  const [fixtures, setFixtures] = useState<Match[]>([]);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [archivedUsers, setArchivedUsers] = useState<any[]>([]);
  const [loadingFixtures, setLoadingFixtures] = useState(false);
  const [loadingLeagues, setLoadingLeagues] = useState(false);
  const [loadingArchives, setLoadingArchives] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFixtures = useCallback(async () => {
    setLoadingFixtures(true);
    try {
      const data = await dbFetchMatches();
      setFixtures(data);
    } catch (e) {
      console.warn('useAdminData: Failed to fetch fixtures', e);
    } finally {
      setLoadingFixtures(false);
    }
  }, []);

  const fetchLeagues = useCallback(async () => {
    setLoadingLeagues(true);
    try {
      const data = await dbFetchLeagues();
      // The legacy `members` JSONB column on `leagues` is deprecated and must be
      // ignored entirely — real membership lives in the `league_members` table.
      // Hydrate each league strictly from league_members so counts and the audit
      // modal reflect live data.
      const membership = await dbFetchLeaguesMembership(data.map((l) => l.id));
      const hydrated = data.map((l) => ({ ...l, members: membership[l.id] || [] }));
      setLeagues(hydrated);
    } catch (e) {
      console.warn('useAdminData: Failed to fetch leagues', e);
    } finally {
      setLoadingLeagues(false);
    }
  }, []);

  const fetchArchives = useCallback(async () => {
    setLoadingArchives(true);
    try {
      const data = await dbFetchArchivedPlayers();
      setArchivedUsers(data);
    } catch (e) {
      console.warn('useAdminData: Failed to fetch archives', e);
      setArchivedUsers([]);
    } finally {
      setLoadingArchives(false);
    }
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchFixtures().finally(() => {
      setTimeout(() => setRefreshing(false), 800);
    });
  }, [fetchFixtures]);

  useEffect(() => {
    fetchFixtures();
  }, [fetchFixtures]);

  useEffect(() => {
    if (activeTab === 'backups') {
      fetchArchives();
    } else if (activeTab === 'leagues') {
      fetchLeagues();
    }
  }, [activeTab, fetchArchives, fetchLeagues]);

  return {
    fixtures,
    leagues,
    archivedUsers,
    loadingFixtures,
    loadingLeagues,
    loadingArchives,
    refreshing,
    fetchFixtures,
    fetchLeagues,
    fetchArchives,
    handleRefresh,
  };
}
