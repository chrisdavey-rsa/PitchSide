/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback } from 'react';
import { UserProfile } from '../types';
import { useAdminData } from './admin/useAdminData';
import AdminLayout, { AdminTab } from './admin/AdminLayout';
import AdminDashboard from './admin/AdminDashboard';
import PredictionsViewer from './admin/PredictionsViewer';
import PlayerManager from './admin/PlayerManager';
import FixturesManager from './admin/FixturesManager';
import CompetitionsManager from './admin/CompetitionsManager';
import ArchivesManager from './admin/ArchivesManager';
import AdminLeagueManager from './admin/AdminLeagueManager';

interface AdminPanelProps {
  onClose: () => void;
  registeredUsers: UserProfile[];
  onToggleAdmin: (userId: string) => void;
  onDeleteUser: (userId: string) => void;
}

export default function AdminPanel({
  onClose,
  registeredUsers,
  onToggleAdmin,
  onDeleteUser,
}: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [fixtureFilter, setFixtureFilter] = useState<'all' | 'upcoming' | 'completed'>('all');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const {
    fixtures,
    leagues,
    archivedUsers,
    loadingLeagues,
    loadingArchives,
    refreshing,
    fetchArchives,
    handleRefresh,
  } = useAdminData(activeTab);

  const triggerSuccess = useCallback((msg: string) => {
    setSuccessMsg(msg);
    setErrorMsg('');
    setTimeout(() => setSuccessMsg(''), 5000);
  }, []);

  const triggerError = useCallback((msg: string) => {
    setErrorMsg(msg);
    setSuccessMsg('');
    setTimeout(() => setErrorMsg(''), 8000);
  }, []);

  const handleNavigate = useCallback(
    (tab: 'players' | 'fixtures' | 'predictions', filter?: 'upcoming' | 'completed' | 'all') => {
      setActiveTab(tab);
      if (filter && tab === 'fixtures') setFixtureFilter(filter);
    },
    []
  );

  return (
    <AdminLayout
      onClose={onClose}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      successMsg={successMsg}
      errorMsg={errorMsg}
      fixtureCount={fixtures.length}
      playerCount={registeredUsers.length}
      archiveCount={archivedUsers.length}
    >
      {activeTab === 'dashboard' && (
        <AdminDashboard onNavigate={handleNavigate} />
      )}

      {activeTab === 'predictions' && (
        <PredictionsViewer />
      )}

      {activeTab === 'players' && (
        <PlayerManager
          registeredUsers={registeredUsers}
          onToggleAdmin={onToggleAdmin}
          onDeleteUser={onDeleteUser}
          onRefresh={handleRefresh}
          onSuccess={triggerSuccess}
          onError={triggerError}
          onArchivesRefresh={fetchArchives}
          refreshing={refreshing}
        />
      )}

      {activeTab === 'fixtures' && (
        <FixturesManager
          initialFixtures={fixtures}
          fixtureFilter={fixtureFilter}
          setFixtureFilter={setFixtureFilter}
          onSuccess={triggerSuccess}
          onError={triggerError}
          onRefresh={handleRefresh}
        />
      )}

      {activeTab === 'competitions' && (
        <CompetitionsManager onSuccess={triggerSuccess} onError={triggerError} />
      )}

      {activeTab === 'backups' && (
        <ArchivesManager
          archivedUsers={archivedUsers}
          loadingArchives={loadingArchives}
          onRefresh={fetchArchives}
          onSuccess={triggerSuccess}
        />
      )}

      {activeTab === 'leagues' && (
        <AdminLeagueManager
          leagues={leagues}
          loadingLeagues={loadingLeagues}
          registeredUsers={registeredUsers}
          onSuccess={triggerSuccess}
        />
      )}
    </AdminLayout>
  );
}
