import React, { useState } from 'react';
import {
  Search,
  RefreshCw,
  Trash2,
  User,
  Shield,
  Database,
  List,
  MessageSquare,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Mail,
  X,
} from 'lucide-react';
import { supabase } from '../../supabase';
import { UserProfile } from '../../types';

interface PlayerManagerProps {
  registeredUsers: UserProfile[];
  onToggleAdmin: (userId: string) => void;
  onDeleteUser: (userId: string) => void;
  onRefresh: () => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
  onArchivesRefresh: () => void;
  refreshing: boolean;
}

function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query || !text) return <>{text}</>;
  const parts = text.split(new RegExp(`(${query})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <span key={i} className="bg-blue-500/40 text-blue-200 px-0.5 rounded-sm">{part}</span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

export default function PlayerManager({
  registeredUsers,
  onToggleAdmin,
  onDeleteUser,
  onRefresh,
  onSuccess,
  onError,
  onArchivesRefresh,
  refreshing,
}: PlayerManagerProps) {
  const [playerSearchQuery, setPlayerSearchQuery] = useState('');
  const [editingPlayer, setEditingPlayer] = useState<UserProfile | null>(null);
  const [editPlayerForm, setEditPlayerForm] = useState({
    nickname: '',
    firstName: '',
    surname: '',
    dob: '',
    nationality: '',
  });
  const [auditTab, setAuditTab] = useState<'identity' | 'security' | 'ledger' | 'communications'>('identity');
  const [manualPointAdjust, setManualPointAdjust] = useState({ amount: 0, reason: '' });
  const [showPointAdjust, setShowPointAdjust] = useState(false);
  const [directMessage, setDirectMessage] = useState({ subject: '', body: '' });
  const [showSuspendForm, setShowSuspendForm] = useState(false);
  const [suspendForm, setSuspendForm] = useState({ until: '', adminPassword: '' });
  const [playerLedger, setPlayerLedger] = useState<any[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [predFilterType, setPredFilterType] = useState<'upcoming' | 'completed'>('upcoming');
  const [predSportFilter, setPredSportFilter] = useState<string | null>(null);
  const [predSearchTerm, setPredSearchTerm] = useState('');

  const filteredPlayers = registeredUsers.filter((u) => {
    const q = playerSearchQuery.toLowerCase();
    return (
      (u.id && u.id.toLowerCase().includes(q)) ||
      (u.nickname && u.nickname.toLowerCase().includes(q)) ||
      (u.firstName && u.firstName.toLowerCase().includes(q)) ||
      (u.surname && u.surname.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q))
    );
  });

  const openAuditModal = async (player: UserProfile) => {
    setEditingPlayer(player);
    setEditPlayerForm({
      nickname: player.nickname || '',
      firstName: player.firstName || '',
      surname: player.surname || '',
      dob: player.dob || '',
      nationality: player.nationality || '',
    });
    setAuditTab('identity');
    setShowPointAdjust(false);
    setManualPointAdjust({ amount: 0, reason: '' });
    setDirectMessage({ subject: '', body: '' });
    setShowSuspendForm(false);
    setSuspendForm({ until: '', adminPassword: '' });
    setLoadingLedger(true);
    setPlayerLedger([]);
    try {
      const { data, error } = await supabase
        .from('predictions')
        .select(`
          id, match_id, predicted_home_score, predicted_away_score, points_won, created_at,
          matches:match_id ( id, home_team, away_team, kickoff_time, actual_home_score, actual_away_score, status, sport )
        `)
        .eq('user_id', player.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setPlayerLedger(data || []);
    } catch (err: any) {
      onError(`Failed to fetch player ledger: ${err.message || 'Unknown error'}`);
    } finally {
      setLoadingLedger(false);
    }
  };

  const handleUpdatePlayerInfo = async () => {
    if (!editingPlayer) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          nickname: editPlayerForm.nickname,
          firstName: editPlayerForm.firstName,
          surname: editPlayerForm.surname,
          dob: editPlayerForm.dob,
          nationality: editPlayerForm.nationality,
        })
        .eq('id', editingPlayer.id);
      if (error) throw error;
      onSuccess('Player profile updated successfully.');
      setEditingPlayer(null);
      onRefresh();
    } catch (err: any) {
      onError(`Failed to update profile: ${err.message || 'Unknown error'}`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-bold text-slate-300 font-mono uppercase tracking-wider">
            Player Directories
          </h4>
          <p className="text-[10px] text-slate-500 font-sans">
            Toggle user privilege states or perform records removal.
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="p-1 px-2.5 bg-slate-950 hover:bg-slate-850 text-slate-400 hover:text-white rounded-md border border-slate-800 text-[10px] font-mono cursor-pointer transition-colors flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} /> Refresh Node
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500 font-bold" />
        <input
          type="text"
          placeholder="Search..."
          value={playerSearchQuery}
          onChange={(e) => setPlayerSearchQuery(e.target.value)}
          className="w-full bg-slate-950/80 border border-slate-800 text-slate-100 text-xs pl-9 pr-4 py-2 rounded-xl focus:border-blue-500 focus:outline-hidden transition-colors"
        />
      </div>

      <div className="bg-slate-950 rounded-xl border border-slate-800/80 overflow-hidden">
        {filteredPlayers.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500 font-mono">No player records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="bg-slate-900/80 border-b border-slate-800 text-slate-500 text-[9px] uppercase tracking-wider">
                  <th className="py-3 px-4">UUID</th>
                  <th className="py-3 px-4">Player ID</th>
                  <th className="py-3 px-4">Private Email Info</th>
                  <th className="py-3 px-4 text-center">Verification</th>
                  <th className="py-3 px-4 text-right">Action Gate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {filteredPlayers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-900/20 text-xs">
                    <td className="py-3 px-4 text-slate-500 text-[10px] font-mono">
                      <HighlightMatch text={u.id} query={playerSearchQuery} />
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => openAuditModal(u)}
                        className="font-bold text-white block text-[13px] hover:text-blue-400 cursor-pointer text-left transition-colors focus:outline-none w-full"
                      >
                        <HighlightMatch text={u.nickname} query={playerSearchQuery} />
                      </button>
                      <span className="text-[10px] text-slate-400 font-sans">
                        <HighlightMatch text={`${u.firstName} ${u.surname}`} query={playerSearchQuery} />
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      <HighlightMatch text={u.email} query={playerSearchQuery} />
                      <span className="text-[10px] text-slate-500 block">DOB MAPPED: {u.dob}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-sm text-[9px] font-bold ${
                          u.emailVerified
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-red-500/10 text-red-400 animate-pulse'
                        }`}
                      >
                        {u.emailVerified ? 'VERIFIED' : 'PENDING'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-1">
                      <button
                        onClick={() => openAuditModal(u)}
                        className="px-2.5 py-1.5 rounded-lg text-[9px] font-bold tracking-wider cursor-pointer font-mono bg-blue-500/15 text-blue-400 border border-blue-500/25 hover:bg-blue-500/25"
                      >
                        AUDIT / EDIT
                      </button>
                      <button
                        onClick={() => onToggleAdmin(u.id)}
                        className={`px-2.5 py-1.5 rounded-lg text-[9px] font-bold tracking-wider cursor-pointer font-mono ${
                          u.isAdmin
                            ? 'bg-red-500/15 text-red-400 border border-red-500/25 hover:bg-red-500/25'
                            : 'bg-purple-500/15 text-purple-400 border border-purple-500/25 hover:bg-purple-500/25'
                        }`}
                      >
                        {u.isAdmin ? 'REVOKE ADMIN' : 'MAKE ADMIN'}
                      </button>
                      <button
                        onClick={async () => {
                          if (
                            confirm(
                              `Are you sure you want to delete player ${u.nickname}?\n\nThis will backup their historic predictions, unsubscribe them from mailing lists, and fully delete their profile account.`
                            )
                          ) {
                            onDeleteUser(u.id);
                            setTimeout(() => onArchivesRefresh(), 1200);
                          }
                        }}
                        className="p-1.5 px-2 bg-slate-900 text-slate-400 hover:text-red-400 border border-slate-805 rounded-lg cursor-pointer transition-colors"
                        title="Eradicate Account"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Player Administration Modal */}
      {editingPlayer && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl h-[700px] max-h-[90vh] flex flex-col md:flex-row font-mono text-sm animate-fade-in relative overflow-hidden">
            {/* Sidebar Navigation */}
            <div className="w-full md:w-64 bg-slate-900/50 border-r border-slate-800/80 flex flex-col flex-shrink-0">
              <div className="p-5 border-b border-slate-800/80">
                <h3 className="text-white font-bold text-lg flex items-center gap-2">
                  <Database className="w-5 h-5 text-blue-400" /> Player Admin
                </h3>
                <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest break-all">
                  {editingPlayer.id}
                </p>
              </div>
              <div className="p-3 flex-1 space-y-1">
                {(
                  [
                    { key: 'identity', icon: User, label: 'Identity Overview', activeColor: 'blue' },
                    { key: 'security', icon: Shield, label: 'Access & Security', activeColor: 'purple' },
                    { key: 'ledger', icon: List, label: 'Predictions', activeColor: 'emerald' },
                    { key: 'communications', icon: MessageSquare, label: 'Communications', activeColor: 'amber' },
                  ] as const
                ).map(({ key, icon: Icon, label, activeColor }) => (
                  <button
                    key={key}
                    onClick={() => setAuditTab(key)}
                    className={`w-full flex items-center gap-2 px-4 py-3 rounded-lg text-xs font-bold transition-colors ${
                      auditTab === key
                        ? `bg-${activeColor}-500/10 text-${activeColor}-400 border border-${activeColor}-500/20`
                        : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    <Icon className="w-4 h-4" /> {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col relative overflow-hidden">
              <div className="absolute top-4 right-4 z-10">
                <button
                  onClick={() => setEditingPlayer(null)}
                  className="p-2 bg-slate-900/80 border border-slate-700/50 text-slate-400 hover:text-white rounded-full transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 md:p-8">
                {/* IDENTITY */}
                {auditTab === 'identity' && (
                  <div className="space-y-6 animate-fade-in">
                    <div>
                      <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 border-b border-slate-800 pb-2">
                        User Information
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-3">
                          <span className="block text-[9px] text-slate-500 uppercase tracking-widest mb-1">Account Created</span>
                          <span className="text-xs text-slate-300">{new Date(editingPlayer.createdAt).toLocaleString()}</span>
                        </div>
                        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-3">
                          <span className="block text-[9px] text-slate-500 uppercase tracking-widest mb-1">Supported Team</span>
                          <span className="text-xs text-slate-300">{editingPlayer.supportedTeam || 'Not Selected'}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 border-b border-slate-800 pb-2">
                        Identity Profile (Read-Only)
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        {[
                          { label: 'Nickname (Player ID)', value: editingPlayer.nickname },
                          { label: 'Date of Birth', value: editingPlayer.dob },
                          { label: 'First Name', value: editingPlayer.firstName },
                          { label: 'Surname', value: editingPlayer.surname },
                        ].map(({ label, value }) => (
                          <div key={label}>
                            <label className="block text-[9px] text-slate-500 uppercase tracking-widest mb-1.5">{label}</label>
                            <div className="w-full bg-slate-900/50 border border-slate-800 rounded-lg px-3 py-2.5 text-slate-400 text-xs">
                              {value || '-'}
                            </div>
                          </div>
                        ))}
                        <div className="sm:col-span-2">
                          <label className="block text-[9px] text-slate-500 uppercase tracking-widest mb-1.5">Nationality</label>
                          <div className="w-full bg-slate-900/50 border border-slate-800 rounded-lg px-3 py-2.5 text-slate-400 text-xs">
                            {editingPlayer.nationality || '-'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* SECURITY */}
                {auditTab === 'security' && (
                  <div className="space-y-6 animate-fade-in">
                    <div>
                      <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 border-b border-slate-800 pb-2">
                        Credentials & Verification
                      </h4>
                      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div>
                          <span className="block text-[9px] text-slate-500 uppercase tracking-widest mb-1">Registered Email Address</span>
                          <span className="text-sm font-bold text-white">{editingPlayer.email}</span>
                          <div className="mt-2">
                            {editingPlayer.emailVerified ? (
                              <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-md text-[10px] font-bold">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 bg-red-500/10 text-red-400 px-2.5 py-1 rounded-md text-[10px] font-bold">
                                <AlertTriangle className="w-3.5 h-3.5" /> Pending Verification
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 w-full sm:w-auto">
                          {!editingPlayer.emailVerified && (
                            <button
                              onClick={() => {
                                onSuccess(`Manually verified email for ${editingPlayer.nickname}.`);
                              }}
                              className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 px-4 py-2 rounded-lg text-xs font-bold transition-colors"
                            >
                              Manually Verify Email
                            </button>
                          )}
                          <button
                            onClick={() => {
                              onSuccess(`Secure password reset link dispatched to ${editingPlayer.email}.`);
                            }}
                            className="bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 border border-purple-500/30 px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2"
                          >
                            <Lock className="w-3.5 h-3.5" /> Force Password Reset
                          </button>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 border-b border-slate-800 pb-2">
                        Account Status
                      </h4>
                      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 flex items-center justify-between">
                        <div>
                          <span className="block text-sm font-bold text-white mb-1">Administrative Privileges</span>
                          <p className="text-[10px] text-slate-500">Toggle this user's ability to access the Admin Panel.</p>
                        </div>
                        <button
                          onClick={() => onToggleAdmin(editingPlayer.id)}
                          className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
                            editingPlayer.isAdmin
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
                              : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700'
                          }`}
                        >
                          {editingPlayer.isAdmin ? 'Revoke Admin' : 'Grant Admin'}
                        </button>
                      </div>

                      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 mt-4">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <span className="block text-sm font-bold text-white mb-1">Suspension Status</span>
                            <p className="text-[10px] text-slate-500">Temporarily lock this user out of the platform.</p>
                          </div>
                          {editingPlayer.suspendedUntil && new Date(editingPlayer.suspendedUntil) > new Date() ? (
                            <button
                              onClick={() => {
                                onSuccess(`User ${editingPlayer.nickname} has had gaming rights restored.`);
                                setEditingPlayer({ ...editingPlayer, suspendedUntil: undefined });
                              }}
                              className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 px-4 py-2 rounded-lg text-xs font-bold transition-colors"
                            >
                              Restore Gaming Rights
                            </button>
                          ) : (
                            <button
                              onClick={() => setShowSuspendForm(!showSuspendForm)}
                              className="bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 px-4 py-2 rounded-lg text-xs font-bold transition-colors"
                            >
                              {showSuspendForm ? 'Cancel' : 'Suspend User'}
                            </button>
                          )}
                        </div>

                        {showSuspendForm && (
                          <div className="mt-4 p-4 bg-slate-950 border border-amber-500/30 rounded-lg animate-fade-in">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-[9px] text-slate-500 uppercase tracking-widest mb-1.5">
                                  Suspend Until (Date &amp; Time)
                                </label>
                                <input
                                  type="datetime-local"
                                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-500/50"
                                  value={suspendForm.until}
                                  onChange={(e) => setSuspendForm({ ...suspendForm, until: e.target.value })}
                                />
                              </div>
                              <div>
                                <label className="block text-[9px] text-slate-500 uppercase tracking-widest mb-1.5">
                                  Admin Password
                                </label>
                                <input
                                  type="password"
                                  placeholder="Confirm your password"
                                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-500/50"
                                  value={suspendForm.adminPassword}
                                  onChange={(e) => setSuspendForm({ ...suspendForm, adminPassword: e.target.value })}
                                />
                              </div>
                            </div>
                            <div className="mt-4 flex justify-end">
                              <button
                                onClick={() => {
                                  if (!suspendForm.until || !suspendForm.adminPassword) {
                                    alert('Please fill in both the suspension date and your admin password.');
                                    return;
                                  }
                                  if (suspendForm.adminPassword !== 'admin') {
                                    alert('Invalid admin password.');
                                  }
                                  onSuccess(`User ${editingPlayer.nickname} suspended until ${new Date(suspendForm.until).toLocaleString()}.`);
                                  setEditingPlayer({ ...editingPlayer, suspendedUntil: suspendForm.until });
                                  setShowSuspendForm(false);
                                }}
                                className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-4 py-2 rounded-lg text-xs transition-colors"
                              >
                                Confirm Suspension
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* LEDGER */}
                {auditTab === 'ledger' && (
                  <div className="space-y-6 animate-fade-in">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                      <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Predictions</h4>
                      <button
                        onClick={() => setShowPointAdjust(!showPointAdjust)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-widest uppercase transition-colors shadow-lg"
                      >
                        {showPointAdjust ? 'Cancel Adjustment' : 'Manual Point Adjustment'}
                      </button>
                    </div>

                    {showPointAdjust && (
                      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 animate-fade-in">
                        <div className="flex flex-col sm:flex-row gap-4 items-end">
                          <div className="w-full sm:w-1/3">
                            <label className="block text-[9px] text-slate-400 uppercase tracking-widest mb-1.5">
                              Adjustment Amount (+/-)
                            </label>
                            <input
                              type="number"
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500/50"
                              value={manualPointAdjust.amount}
                              onChange={(e) =>
                                setManualPointAdjust({ ...manualPointAdjust, amount: parseInt(e.target.value) || 0 })
                              }
                            />
                          </div>
                          <div className="w-full sm:w-2/3">
                            <label className="block text-[9px] text-slate-400 uppercase tracking-widest mb-1.5">
                              Reason for Adjustment
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Correcting mistaken match outcome..."
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500/50"
                              value={manualPointAdjust.reason}
                              onChange={(e) =>
                                setManualPointAdjust({ ...manualPointAdjust, reason: e.target.value })
                              }
                            />
                          </div>
                          <button
                            onClick={() => {
                              if (!manualPointAdjust.reason) {
                                alert('Please provide a reason for the adjustment.');
                                return;
                              }
                              onSuccess(
                                `Successfully adjusted points by ${manualPointAdjust.amount} for ${editingPlayer.nickname}.`
                              );
                              setShowPointAdjust(false);
                            }}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors w-full sm:w-auto flex-shrink-0"
                          >
                            Apply
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/50 p-3 rounded-xl border border-slate-800">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => setPredFilterType('upcoming')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                            predFilterType === 'upcoming'
                              ? 'bg-amber-500 text-slate-950'
                              : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                          }`}
                        >
                          Upcoming Matches
                        </button>
                        <button
                          onClick={() => setPredFilterType('completed')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                            predFilterType === 'completed'
                              ? 'bg-amber-500 text-slate-950'
                              : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                          }`}
                        >
                          Completed Matches
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {[
                          { val: null, label: 'All Sports', activeClass: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' },
                          { val: 'football', label: 'Football', activeClass: 'bg-blue-500/20 text-blue-400 border border-blue-500/30' },
                          { val: 'rugby', label: 'Rugby', activeClass: 'bg-amber-500/20 text-amber-400 border border-amber-500/30' },
                        ].map(({ val, label, activeClass }) => (
                          <button
                            key={String(val)}
                            onClick={() => setPredSportFilter(val)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors ${
                              predSportFilter === val
                                ? activeClass
                                : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="relative mb-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                          type="text"
                          placeholder="Search predictions by team name..."
                          value={predSearchTerm}
                          onChange={(e) => setPredSearchTerm(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white text-xs focus:outline-none focus:border-amber-500/50"
                        />
                      </div>
                    </div>

                    <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
                      {loadingLedger ? (
                        <div className="p-12 text-center text-slate-500">
                          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-400" />
                          Fetching database records...
                        </div>
                      ) : playerLedger.length === 0 ? (
                        <div className="p-12 text-center text-slate-500 text-xs">
                          No predictions recorded for this user.
                        </div>
                      ) : (
                        (() => {
                          const filteredPredictions = playerLedger.filter((pred) => {
                            const isUpcoming =
                              pred.matches?.status === 'upcoming' ||
                              (!pred.matches?.actual_home_score &&
                                pred.matches?.actual_home_score !== 0 &&
                                !pred.matches?.home_score);
                            if (predFilterType === 'upcoming' && !isUpcoming) return false;
                            if (predFilterType === 'completed' && isUpcoming) return false;
                            if (predSportFilter && pred.matches?.sport !== predSportFilter) return false;
                            if (predSearchTerm.trim()) {
                              const s = predSearchTerm.toLowerCase();
                              const home = (pred.matches?.home_team || '').toLowerCase();
                              const away = (pred.matches?.away_team || '').toLowerCase();
                              if (!home.includes(s) && !away.includes(s)) return false;
                            }
                            return true;
                          });

                          if (filteredPredictions.length === 0) {
                            return (
                              <div className="p-8 text-center text-slate-500 text-xs font-mono">
                                No predictions match the current filters.
                              </div>
                            );
                          }

                          const highlightText = (text: string) => {
                            if (!predSearchTerm.trim()) return <>{text}</>;
                            const parts = text.split(new RegExp(`(${predSearchTerm})`, 'gi'));
                            return (
                              <span>
                                {parts.map((part, i) =>
                                  part.toLowerCase() === predSearchTerm.toLowerCase() ? (
                                    <span key={i} className="bg-amber-500/30 text-amber-200">{part}</span>
                                  ) : (
                                    part
                                  )
                                )}
                              </span>
                            );
                          };

                          return (
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs font-mono">
                                <thead>
                                  <tr className="bg-slate-900/80 border-b border-slate-800 text-slate-500 text-[9px] uppercase tracking-wider">
                                    <th className="py-3 px-4">Match</th>
                                    <th className="py-3 px-4">Sport</th>
                                    <th className="py-3 px-4">Kickoff</th>
                                    <th className="py-3 px-4 text-center">Prediction</th>
                                    {predFilterType === 'completed' && (
                                      <>
                                        <th className="py-3 px-4 text-center">Actual</th>
                                        <th className="py-3 px-4 text-right">Points Won</th>
                                      </>
                                    )}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/40">
                                  {filteredPredictions.map((pred) => {
                                    const matchTitle = pred.matches
                                      ? `${pred.matches.home_team} vs ${pred.matches.away_team}`
                                      : pred.match_id;
                                    return (
                                      <tr key={pred.id} className="hover:bg-slate-900/20">
                                        <td className="py-3 px-4 text-[11px] font-bold text-white">
                                          {highlightText(matchTitle)}
                                        </td>
                                        <td className="py-3 px-4 text-[10px] text-slate-400 capitalize">
                                          {pred.matches?.sport || '-'}
                                        </td>
                                        <td className="py-3 px-4 text-[10px] text-slate-500">
                                          {pred.matches?.kickoff_time
                                            ? new Date(pred.matches.kickoff_time).toLocaleString()
                                            : '-'}
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                          <span className="inline-block bg-slate-800 px-2 py-1 rounded text-white font-bold tracking-widest">
                                            {pred.predicted_home_score} - {pred.predicted_away_score}
                                          </span>
                                        </td>
                                        {predFilterType === 'completed' && (
                                          <>
                                            <td className="py-3 px-4 text-center">
                                              {pred.matches?.actual_home_score !== null &&
                                              pred.matches?.actual_home_score !== undefined ? (
                                                <span className="inline-block bg-slate-900 border border-slate-700 px-2 py-1 rounded text-slate-300 font-bold tracking-widest">
                                                  {pred.matches.actual_home_score} - {pred.matches.actual_away_score}
                                                </span>
                                              ) : (
                                                <span className="text-[10px] text-slate-500 italic">Pending</span>
                                              )}
                                            </td>
                                            <td className="py-3 px-4 text-right font-bold text-emerald-400">
                                              {pred.points_won !== null && pred.points_won !== undefined
                                                ? `+${pred.points_won}`
                                                : '-'}
                                            </td>
                                          </>
                                        )}
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          );
                        })()
                      )}
                    </div>
                  </div>
                )}

                {/* COMMUNICATIONS */}
                {auditTab === 'communications' && (
                  <div className="space-y-6 animate-fade-in">
                    <div>
                      <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 border-b border-slate-800 pb-2">
                        Direct User Contact
                      </h4>
                      <p className="text-[10px] text-slate-500 mb-6">
                        Send a secure site message to this user. This will appear in their account portal.
                      </p>
                      <div className="space-y-4 max-w-2xl">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[9px] text-slate-500 uppercase tracking-widest mb-1.5">
                              Recipient Name
                            </label>
                            <input
                              type="text"
                              disabled
                              className="w-full bg-slate-900/50 border border-slate-800 rounded-lg px-3 py-2 text-slate-400 text-xs cursor-not-allowed"
                              value={`${editingPlayer.firstName} ${editingPlayer.surname} (${editingPlayer.nickname})`}
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] text-slate-500 uppercase tracking-widest mb-1.5">
                              Recipient Email
                            </label>
                            <input
                              type="text"
                              disabled
                              className="w-full bg-slate-900/50 border border-slate-800 rounded-lg px-3 py-2 text-slate-400 text-xs cursor-not-allowed"
                              value={editingPlayer.email}
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[9px] text-slate-500 uppercase tracking-widest mb-1.5">
                            Message Subject
                          </label>
                          <input
                            type="text"
                            placeholder="Important Account Update"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-xs focus:outline-none focus:border-amber-500/50"
                            value={directMessage.subject}
                            onChange={(e) => setDirectMessage({ ...directMessage, subject: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] text-slate-500 uppercase tracking-widest mb-1.5">
                            Message Body
                          </label>
                          <textarea
                            rows={6}
                            placeholder="Type your message here..."
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-3 text-white text-xs focus:outline-none focus:border-amber-500/50 resize-none"
                            value={directMessage.body}
                            onChange={(e) => setDirectMessage({ ...directMessage, body: e.target.value })}
                          />
                        </div>
                        <div className="flex justify-end pt-2">
                          <button
                            onClick={() => {
                              if (!directMessage.subject || !directMessage.body) {
                                alert('Please provide a subject and a message body.');
                                return;
                              }
                              const newMessage = {
                                id: crypto.randomUUID(),
                                senderId: 'admin',
                                receiverId: editingPlayer.id,
                                subject: directMessage.subject,
                                body: directMessage.body,
                                createdAt: new Date().toISOString(),
                                read: false,
                              };
                              const existing = JSON.parse(
                                localStorage.getItem('pitchside_messages') || '[]'
                              );
                              localStorage.setItem(
                                'pitchside_messages',
                                JSON.stringify([...existing, newMessage])
                              );
                              onSuccess(`Secure site message sent to ${editingPlayer.nickname}.`);
                              setDirectMessage({ subject: '', body: '' });
                            }}
                            className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-6 py-2.5 rounded-lg text-xs transition-colors flex items-center gap-2 shadow-lg shadow-amber-900/20"
                          >
                            <Mail className="w-4 h-4" /> Send Secure Message
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
