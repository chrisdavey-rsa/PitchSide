import React, { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { Users, RefreshCw, X, Archive, ArchiveRestore } from 'lucide-react';
import { UserProfile, League } from '../../types';
import {
  dbAdminUpdateLeague,
  dbArchiveLeague,
  dbUnarchiveLeague,
} from '../../supabase';
import { isGlobalLeague } from '../../lib/leaguesConfig';

type LeagueViewTab = 'active' | 'archived';

interface AdminLeagueManagerProps {
  leagues: League[];
  loadingLeagues: boolean;
  registeredUsers: UserProfile[];
  onSuccess: (msg: string) => void;
  onError?: (msg: string) => void;
  onRefreshLeagues?: () => Promise<void>;
  onLeaguesChange: Dispatch<SetStateAction<League[]>>;
}

export default function AdminLeagueManager({
  leagues,
  loadingLeagues,
  registeredUsers,
  onSuccess,
  onError,
  onRefreshLeagues,
  onLeaguesChange,
}: AdminLeagueManagerProps) {
  const [viewTab, setViewTab] = useState<LeagueViewTab>('active');
  const [viewingLeague, setViewingLeague] = useState<League | null>(null);
  const [editName, setEditName] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editMaxPlayers, setEditMaxPlayers] = useState(20);
  const [editIsPrivate, setEditIsPrivate] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mutatingId, setMutatingId] = useState<string | null>(null);

  // Treat null/undefined as active (legacy rows before migration).
  const activeLeagues = useMemo(
    () => leagues.filter((l) => l.isArchived !== true),
    [leagues],
  );
  const archivedLeagues = useMemo(
    () => leagues.filter((l) => l.isArchived === true),
    [leagues],
  );
  const visibleLeagues = viewTab === 'active' ? activeLeagues : archivedLeagues;

  useEffect(() => {
    if (!viewingLeague) return;
    setEditName(viewingLeague.name);
    setEditPassword(viewingLeague.password || '');
    setEditMaxPlayers(viewingLeague.maxPlayers ?? viewingLeague.maxParticipants ?? 20);
    setEditIsPrivate(viewingLeague.isPrivate ?? viewingLeague.isPublic === false);
  }, [viewingLeague]);

  const toAdminNetworkError = (err: unknown, fallback: string) => {
    const raw =
      err instanceof Error
        ? err.message
        : typeof err === 'string'
          ? err
          : fallback;
    const lower = raw.toLowerCase();
    if (
      lower.includes('failed to fetch') ||
      lower.includes('networkerror') ||
      lower.includes('network request failed') ||
      lower.includes('err_internet_disconnected') ||
      lower.includes('internet_disconnected') ||
      lower.includes('offline') ||
      lower.includes('load failed')
    ) {
      return 'Network error: Could not connect to the database. Check your connection and try again.';
    }
    return raw || fallback;
  };

  const patchLeagueArchived = (leagueId: string, isArchived: boolean) => {
    // Functional update avoids stale `leagues` closure wiping other edits.
    onLeaguesChange((prev) =>
      prev.map((l) =>
        l.id === leagueId
          ? { ...l, isArchived, updatedAt: new Date().toISOString() }
          : l,
      ),
    );
  };

  const handleArchiveLeague = async (leagueId: string, leagueName: string) => {
    if (isGlobalLeague(leagueId)) {
      onError?.('The Global PitchSide League cannot be archived.');
      return;
    }
    if (!window.confirm(`Archive league "${leagueName}"?\n\nIt will be hidden from players but can be restored later.`)) {
      return;
    }

    setMutatingId(leagueId);
    try {
      await dbArchiveLeague(leagueId);
      patchLeagueArchived(leagueId, true);
      if (viewingLeague?.id === leagueId) setViewingLeague(null);
      onSuccess(`Archived "${leagueName}".`);
      // Refresh after local patch; if DB write failed we already threw above.
      if (onRefreshLeagues) {
        await onRefreshLeagues();
      }
    } catch (err) {
      console.error('[AdminLeagueManager] archive failed', err);
      onError?.(toAdminNetworkError(err, 'Failed to archive league.'));
    } finally {
      setMutatingId(null);
    }
  };

  const handleUnarchiveLeague = async (leagueId: string, leagueName: string) => {
    if (!window.confirm(`Unarchive league "${leagueName}"?\n\nIt will become visible to players again.`)) {
      return;
    }

    setMutatingId(leagueId);
    try {
      await dbUnarchiveLeague(leagueId);
      patchLeagueArchived(leagueId, false);
      if (viewingLeague?.id === leagueId) {
        setViewingLeague((prev) => (prev ? { ...prev, isArchived: false } : prev));
      }
      setViewTab('active');
      onSuccess(`Unarchived "${leagueName}".`);
      if (onRefreshLeagues) {
        await onRefreshLeagues();
      }
    } catch (err) {
      console.error('[AdminLeagueManager] unarchive failed', err);
      onError?.(toAdminNetworkError(err, 'Failed to unarchive league.'));
    } finally {
      setMutatingId(null);
    }
  };

  const handleUpdateLeague = async () => {
    if (!viewingLeague) return;
    if (isGlobalLeague(viewingLeague.id)) {
      onError?.('The Global PitchSide League cannot be edited here.');
      return;
    }
    if (viewingLeague.isArchived) {
      onError?.('Unarchive this league before editing.');
      return;
    }

    const name = editName.trim();
    if (!name) {
      onError?.('League name is required.');
      return;
    }

    setSaving(true);
    try {
      await dbAdminUpdateLeague(viewingLeague.id, {
        name,
        password: editPassword,
        maxPlayers: editMaxPlayers,
        isPrivate: editIsPrivate,
      });

      const updated: League = {
        ...viewingLeague,
        name,
        password: editPassword,
        maxPlayers: editMaxPlayers,
        maxParticipants: editMaxPlayers,
        isPrivate: editIsPrivate,
        isPublic: !editIsPrivate,
        updatedAt: new Date().toISOString(),
      };

      onLeaguesChange((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
      setViewingLeague(updated);
      onSuccess(`Updated "${name}".`);
      if (onRefreshLeagues) {
        await onRefreshLeagues();
      }
    } catch (err) {
      console.error('[AdminLeagueManager] update failed', err);
      onError?.(toAdminNetworkError(err, 'Failed to update league.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h4 className="text-xs font-bold text-slate-300 font-mono uppercase tracking-wider flex items-center gap-1.5">
          <Users className="w-4 h-4 text-purple-400" /> Private Mini-Leagues Directory
        </h4>
        <p className="text-[10px] text-slate-500 font-sans mt-0.5">
          Monitor active leagues or restore soft-deleted (archived) ones.
        </p>
      </div>

      <div
        role="tablist"
        aria-label="League status"
        className="inline-flex rounded-xl border border-slate-800 bg-slate-950/60 p-1 gap-1"
      >
        <button
          type="button"
          role="tab"
          aria-selected={viewTab === 'active'}
          onClick={() => setViewTab('active')}
          className={`px-3.5 py-2 rounded-lg text-[10px] font-bold font-mono uppercase tracking-wider cursor-pointer transition-colors ${
            viewTab === 'active'
              ? 'bg-emerald-600 text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          Active Leagues ({activeLeagues.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={viewTab === 'archived'}
          onClick={() => setViewTab('archived')}
          className={`px-3.5 py-2 rounded-lg text-[10px] font-bold font-mono uppercase tracking-wider cursor-pointer transition-colors inline-flex items-center gap-1.5 ${
            viewTab === 'archived'
              ? 'bg-amber-600 text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Archive className="w-3.5 h-3.5" />
          Archived Leagues ({archivedLeagues.length})
        </button>
      </div>

      <div className="border border-slate-800/60 rounded-xl overflow-hidden bg-slate-950/15">
        {loadingLeagues ? (
          <div className="p-12 text-center text-slate-500 font-mono text-xs flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-purple-400" />
            <span>Loading mini-leagues...</span>
          </div>
        ) : visibleLeagues.length === 0 ? (
          <div className="p-12 text-center text-slate-500 font-mono text-xs">
            {viewTab === 'active'
              ? 'No active mini-leagues currently registered.'
              : 'No archived leagues.'}
          </div>
        ) : (
          <table className="w-full text-left font-mono text-[10px] sm:text-xs">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase tracking-widest text-[9px]">
              <tr>
                <th className="py-3 px-4 font-black">League Name</th>
                <th className="py-3 px-4 font-black text-center">Join Code</th>
                <th className="py-3 px-4 font-black text-center">Members</th>
                <th className="py-3 px-4 font-black">Creator</th>
                <th className="py-3 px-4 font-black text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {visibleLeagues.map((league) => (
                <tr key={league.id} className="hover:bg-slate-900/35 transition-colors">
                  <td
                    className="py-3 px-4 font-bold text-white cursor-pointer hover:text-blue-400 transition-colors"
                    onClick={() => setViewingLeague(league)}
                  >
                    {league.name}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="bg-slate-800 px-2 py-1 rounded text-slate-300 font-bold tracking-widest uppercase">
                      {league.id}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center text-slate-300">
                    <span className="inline-flex items-center justify-center bg-purple-500/10 text-purple-400 px-2.5 py-0.5 rounded-full font-bold">
                      {league.members?.length || 0}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-400">
                    {league.creatorName || 'Unknown'}
                  </td>
                  <td className="py-3 px-4 text-right flex justify-end gap-2">
                    {viewTab === 'active' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setViewingLeague(league)}
                          className="px-2.5 py-1.5 rounded-lg text-[9px] font-bold tracking-wider cursor-pointer font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
                        >
                          EDIT
                        </button>
                        <button
                          type="button"
                          disabled={mutatingId === league.id || isGlobalLeague(league.id)}
                          onClick={() => handleArchiveLeague(league.id, league.name)}
                          className="px-2.5 py-1.5 rounded-lg text-[9px] font-bold tracking-wider cursor-pointer font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1"
                        >
                          <Archive className="w-3 h-3" />
                          {mutatingId === league.id ? '…' : 'ARCHIVE'}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={mutatingId === league.id}
                        onClick={() => handleUnarchiveLeague(league.id, league.name)}
                        className="px-2.5 py-1.5 rounded-lg text-[9px] font-bold tracking-wider cursor-pointer font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1"
                      >
                        <ArchiveRestore className="w-3 h-3" />
                        {mutatingId === league.id ? '…' : 'UNARCHIVE'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {viewingLeague && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col font-mono text-sm animate-fade-in relative overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-800/80 bg-slate-900/50">
              <div>
                <h3 className="text-white font-bold text-lg flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-400" />
                  {viewingLeague.isArchived ? 'Archived League' : 'Edit League'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingLeague(null)}
                className="text-slate-500 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="bg-slate-900/30 border border-slate-800/80 rounded-xl p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-[9px] text-slate-500 uppercase tracking-widest mb-1.5">
                      League Name
                    </label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      disabled={isGlobalLeague(viewingLeague.id) || !!viewingLeague.isArchived}
                      className="w-full text-white font-bold bg-slate-950/50 px-3 py-2 border border-slate-800 rounded-lg outline-none focus:border-purple-500/50 disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] text-slate-500 uppercase tracking-widest mb-1.5">
                      Join Code
                    </label>
                    <div className="text-white font-bold bg-slate-950/50 px-3 py-2 border border-slate-800 rounded-lg tracking-widest">
                      {viewingLeague.id}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[9px] text-slate-500 uppercase tracking-widest mb-1.5">
                      Max Players
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={editMaxPlayers}
                      onChange={(e) => setEditMaxPlayers(Number(e.target.value) || 1)}
                      disabled={isGlobalLeague(viewingLeague.id) || !!viewingLeague.isArchived}
                      className="w-full text-white font-bold bg-slate-950/50 px-3 py-2 border border-slate-800 rounded-lg outline-none focus:border-purple-500/50 disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] text-slate-500 uppercase tracking-widest mb-1.5">
                      Entry Password
                    </label>
                    <input
                      type="text"
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      disabled={isGlobalLeague(viewingLeague.id) || !!viewingLeague.isArchived}
                      className="w-full text-white font-bold bg-slate-950/50 px-3 py-2 border border-slate-800 rounded-lg outline-none focus:border-purple-500/50 disabled:opacity-60"
                    />
                  </div>
                  <div className="flex items-end pb-1">
                    <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editIsPrivate}
                        onChange={(e) => setEditIsPrivate(e.target.checked)}
                        disabled={isGlobalLeague(viewingLeague.id) || !!viewingLeague.isArchived}
                        className="rounded border-slate-700"
                      />
                      Private league
                    </label>
                  </div>
                  <div>
                    <label className="block text-[9px] text-slate-500 uppercase tracking-widest mb-1.5">
                      Creator
                    </label>
                    <div className="text-slate-300 bg-slate-950/50 px-3 py-2 border border-slate-800 rounded-lg">
                      {viewingLeague.creatorName || 'Unknown'}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] text-slate-500 uppercase tracking-widest mb-1.5">
                    Members ({viewingLeague.members?.length || 0})
                  </label>
                  <div className="bg-slate-950/50 border border-slate-800 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                    {viewingLeague.members && viewingLeague.members.length > 0 ? (
                      <ul className="divide-y divide-slate-800/50 text-xs">
                        {viewingLeague.members.map((member, i) => {
                          const user = registeredUsers.find((u) => u.id === member);
                          return (
                            <li key={i} className="px-3 py-2 text-slate-300">
                              {user ? user.nickname : 'Unknown User'}
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <div className="px-3 py-4 text-center text-slate-500 text-xs">
                        No members found.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-slate-800/80 flex flex-col sm:flex-row gap-2 sm:justify-end bg-slate-900/40">
              {viewingLeague.isArchived ? (
                <button
                  type="button"
                  onClick={() => handleUnarchiveLeague(viewingLeague.id, viewingLeague.name)}
                  disabled={mutatingId === viewingLeague.id}
                  className="px-4 py-2 rounded-lg text-xs font-bold font-mono uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer disabled:opacity-40 inline-flex items-center justify-center gap-1.5"
                >
                  <ArchiveRestore className="w-3.5 h-3.5" />
                  Unarchive
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => handleArchiveLeague(viewingLeague.id, viewingLeague.name)}
                    disabled={mutatingId === viewingLeague.id || isGlobalLeague(viewingLeague.id)}
                    className="px-4 py-2 rounded-lg text-xs font-bold font-mono uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 cursor-pointer disabled:opacity-40"
                  >
                    Archive League
                  </button>
                  <button
                    type="button"
                    onClick={handleUpdateLeague}
                    disabled={saving || isGlobalLeague(viewingLeague.id)}
                    className="px-4 py-2 rounded-lg text-xs font-bold font-mono uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer disabled:opacity-40"
                  >
                    {saving ? 'Saving…' : 'Save changes'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
