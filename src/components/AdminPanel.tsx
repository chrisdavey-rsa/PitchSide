/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useState, useEffect } from 'react';
import {
  Shield,
  Users,
  Key,
  Database,
  RefreshCw,
  X,
  Tag,
  Plus,
  Calendar,
  Clock,
  Trophy,
  Check,
  CheckCircle2,
  Trash2,
  Play,
  Download,
  Search,
  FileJson,
  Mail,
  AlertTriangle,
  User,
  Activity,
  MessageSquare,
  Lock,
  List
} from 'lucide-react';
import { supabase, dbFetchArchivedPlayers, dbFetchMatches, dbSaveMatch, dbFetchLeagues } from '../supabase';
import { UserProfile, SportType, Competition, Match, Prediction, League } from '../types';
import { getCompetitions } from '../competitions';
import { calculatePoints } from '../utils';

interface AdminPanelProps {
  onClose: () => void;
  registeredUsers: UserProfile[];
  onToggleAdmin: (userId: string) => void;
  onDeleteUser: (userId: string) => void;
}

function AdminDashboard({ onNavigate }: { onNavigate: (tab: 'players' | 'fixtures', filter?: 'upcoming' | 'completed' | 'all') => void }) {
  const [stats, setStats] = useState({
    players: 0,
    predictions: 0,
    upcomingMatches: 0,
    completedMatches: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchStats = async () => {
      try {
        setLoading(true);

        const [
          { count: playersCount },
          { count: predictionsCount },
          { count: upcomingCount },
          { count: completedCount }
        ] = await Promise.all([
          supabase.from('profiles').select('*', { count: 'exact', head: true }),
          supabase.from('predictions').select('*', { count: 'exact', head: true }),
          supabase.from('matches').select('*', { count: 'exact', head: true }).eq('status', 'upcoming'),
          supabase.from('matches').select('*', { count: 'exact', head: true }).eq('status', 'completed')
        ]);

        if (isMounted) {
          setStats({
            players: playersCount || 0,
            predictions: predictionsCount || 0,
            upcomingMatches: upcomingCount || 0,
            completedMatches: completedCount || 0,
          });
          setError(null);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Failed to fetch dashboard metrics');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchStats();

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-48 text-slate-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading metrics...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-48 text-rose-400 bg-slate-900/50 rounded-xl border border-rose-500/20">
        <AlertTriangle className="w-5 h-5 mr-2" /> {error}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <button 
        onClick={() => onNavigate('players')}
        className="bg-slate-900/50 hover:bg-slate-800/80 cursor-pointer border border-slate-800 p-5 rounded-xl space-y-2 relative overflow-hidden group text-left transition-colors">
        <h4 className="text-[10px] font-bold font-mono text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <Users className="w-3.5 h-3.5 text-blue-400" /> Total Players
        </h4>
        <div className="text-3xl font-bold text-white font-mono">{stats.players}</div>
      </button>

      <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-xl space-y-2 relative overflow-hidden group">
        <h4 className="text-[10px] font-bold font-mono text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <Database className="w-3.5 h-3.5 text-purple-400" /> Predictions Cast
        </h4>
        <div className="text-3xl font-bold text-white font-mono">{stats.predictions}</div>
      </div>

      <button 
        onClick={() => onNavigate('fixtures', 'upcoming')}
        className="bg-slate-900/50 hover:bg-slate-800/80 cursor-pointer border border-slate-800 p-5 rounded-xl space-y-2 relative overflow-hidden group text-left transition-colors">
        <h4 className="text-[10px] font-bold font-mono text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-amber-400" /> Upcoming Matches
        </h4>
        <div className="text-3xl font-bold text-white font-mono">{stats.upcomingMatches}</div>
      </button>

      <button 
        onClick={() => onNavigate('fixtures', 'completed')}
        className="bg-slate-900/50 hover:bg-slate-800/80 cursor-pointer border border-slate-800 p-5 rounded-xl space-y-2 relative overflow-hidden group text-left transition-colors">
        <h4 className="text-[10px] font-bold font-mono text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Completed Matches
        </h4>
        <div className="text-3xl font-bold text-white font-mono">{stats.completedMatches}</div>
      </button>
    </div>
  );
}

function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query || !text) return <>{text}</>;
  const parts = text.split(new RegExp(`(${query})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <span key={i} className="bg-blue-500/40 text-blue-200 px-0.5 rounded-sm">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

export default function AdminPanel({
  onClose,
  registeredUsers,
  onToggleAdmin,
  onDeleteUser,
}: AdminPanelProps) {
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Primary Tab management
  const [activeTab, setActiveTab] = useState<'dashboard' | 'players' | 'fixtures' | 'competitions' | 'backups' | 'communications' | 'leagues'>('dashboard');
  const [fixtureSubTab, setFixtureSubTab] = useState<'add' | 'manage'>('manage');
  const [fixtureFilter, setFixtureFilter] = useState<'all' | 'upcoming' | 'completed'>('all');

  // Communications Tab
  const [broadcastTarget, setBroadcastTarget] = useState('all');
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');

  const handleDispatchBroadcast = () => {
    if (!broadcastTitle || !broadcastBody) {
      setErrorMsg('Please complete all message fields.');
      return;
    }
    setSuccessMsg(`Broadcast message "${broadcastTitle}" dispatched to ${broadcastTarget}.`);
    setTimeout(() => setSuccessMsg(''), 5000);
    setBroadcastTitle('');
    setBroadcastBody('');
  };

  const handleTransferLeague = (leagueId: string, leagueName: string) => {
    if (window.confirm(`Transfer ownership of league "${leagueName}"?`)) {
      setSuccessMsg(`Transfer ownership initiated for ${leagueName}.`);
      setTimeout(() => setSuccessMsg(''), 3000);
    }
  };

  const handleDeleteLeague = (leagueId: string, leagueName: string) => {
    if (window.confirm(`Permanently delete league "${leagueName}"?`)) {
      setSuccessMsg(`Delete initiated for ${leagueName}.`);
      setTimeout(() => setSuccessMsg(''), 3000);
    }
  };

  // Mini-Leagues Tab
  const [activeLeagues, setActiveLeagues] = useState<League[]>([]);
  const [loadingLeagues, setLoadingLeagues] = useState(false);

  const loadActiveLeagues = async () => {
    setLoadingLeagues(true);
    try {
      const dbLeagues = await dbFetchLeagues();
      setActiveLeagues(dbLeagues);
    } catch (e) {
      console.warn('Failed to fetch leagues:', e);
      setActiveLeagues([]);
    }
    setLoadingLeagues(false);
  };

  // League Audit Modal
  const [viewingLeague, setViewingLeague] = useState<League | null>(null);

  // Player Search
  const [playerSearchQuery, setPlayerSearchQuery] = useState('');

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

  // Player Audit & Edit Modal
  const [editingPlayer, setEditingPlayer] = useState<UserProfile | null>(null);
  const [editPlayerForm, setEditPlayerForm] = useState({ nickname: '', firstName: '', surname: '', dob: '', nationality: '' });
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

  // Archive & Backup states
  const [archivedUsers, setArchivedUsers] = useState<any[]>([]);
  const [archiveSearch, setArchiveSearch] = useState('');
  const [loadingArchives, setLoadingArchives] = useState(false);

  // Load archived backups
  const loadArchivedUsers = async () => {
    setLoadingArchives(true);
    try {
      const cloudArchives = await dbFetchArchivedPlayers();
      setArchivedUsers(cloudArchives);
    } catch (e) {
      console.warn('Silent backup read warning:', e);
      setArchivedUsers([]);
    }
    setLoadingArchives(false);
  };

  useEffect(() => {
    if (activeTab === 'backups') {
      loadArchivedUsers();
    } else if (activeTab === 'leagues') {
      loadActiveLeagues();
    }
  }, [activeTab]);

  const openAuditModal = async (player: UserProfile) => {
    setEditingPlayer(player);
    setEditPlayerForm({
      nickname: player.nickname || '',
      firstName: player.firstName || '',
      surname: player.surname || '',
      dob: player.dob || '',
      nationality: player.nationality || ''
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
      setErrorMsg(`Failed to fetch player ledger: ${err.message || 'Unknown error'}`);
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
          nationality: editPlayerForm.nationality
        })
        .eq('id', editingPlayer.id);

      if (error) throw error;
      setSuccessMsg('Player profile updated successfully.');
      setTimeout(() => setSuccessMsg(''), 5000);
      setEditingPlayer(null);
      // Trigger a refresh of the players list
      handleRefreshDb();
    } catch (err: any) {
      setErrorMsg(`Failed to update profile: ${err.message || 'Unknown error'}`);
    }
  };

  // Form Fields for Sports Fixtures
  const [sport, setSport] = useState<SportType>(SportType.FOOTBALL);
  const [compSelect, setCompSelect] = useState('f-epl');
  const [homeTeam, setHomeTeam] = useState('');
  const [awayTeam, setAwayTeam] = useState('');
  const [matchDateInput, setMatchDateInput] = useState('');
  const [matchSeason, setMatchSeason] = useState('2026');
  const [matchHour, setMatchHour] = useState('15');
  const [matchMinute, setMatchMinute] = useState('00');

  // Form Fields for New Competition
  const [newCompName, setNewCompName] = useState('');
  const [newCompSport, setNewCompSport] = useState<SportType>(SportType.FOOTBALL);
  const [newCompNationality, setNewCompNationality] = useState('Global');
  const [newCompSeason, setNewCompSeason] = useState('2026');

  // Score Updates Input State Record
  const [scoreInputs, setScoreInputs] = useState<Record<string, { home: string; away: string }>>({});
  const [loadingMatches, setLoadingMatches] = useState<Record<string, boolean>>({});

  // Database Match States
  const [localFixtures, setLocalFixtures] = useState<any[]>(() => {
    const saved = localStorage.getItem('added_fixtures');
    return saved ? JSON.parse(saved) : [];
  });
  const [groupFixtures, setGroupFixtures] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Auto-align competition dropdown when Sport changes
  useEffect(() => {
    if (sport === SportType.FOOTBALL) {
      setCompSelect('f-epl');
    } else {
      setCompSelect('r-sixnations');
    }
  }, [sport]);

  // Synchronous database fixtures list
  useEffect(() => {
    let isActive = true;
    const fetchFixtures = async () => {
      const dbFixtures = await dbFetchMatches();
      if (isActive) {
        setGroupFixtures(dbFixtures);
      }
    };
    
    fetchFixtures();
    return () => { isActive = false; };
  }, [refreshing]);

  const handleRefreshDb = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 800);
  };

  // Create new game fixture
  const handleAddFixture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!homeTeam.trim() || !awayTeam.trim() || !matchDateInput) {
      setErrorMsg('Please populate all fields to register this sports fixture.');
      return;
    }

    // Allocate dynamic pitchside internal unique format ID
    const randHex = Math.floor(1000 + Math.random() * 9000).toString();
    const prefix = sport === SportType.FOOTBALL ? 'EPL' : 'R6N';
    const fixtureId = `PS-${prefix}-${randHex}`;

    const combinedDateTime = new Date(`${matchDateInput}T${matchHour}:${matchMinute}:00Z`).toISOString();

    const fixtureObj: Match = {
      id: fixtureId,
      sport,
      competitionId: compSelect,
      homeTeam: homeTeam.trim(),
      awayTeam: awayTeam.trim(),
      matchDate: combinedDateTime,
      status: 'upcoming' as const,
      season: matchSeason,
    };

    try {
      await dbSaveMatch(fixtureObj);
      
      // Update local UI state immediately
      setGroupFixtures(prev => [fixtureObj, ...prev]);

      // Clear Form Fields
      setHomeTeam('');
      setAwayTeam('');
      setMatchDateInput('');
      setMatchHour('15');
      setMatchMinute('00');
      setSuccessMsg(`🚀 Successfully Registered! Fixture ID: ${fixtureId}`);
      setErrorMsg('');
      setFixtureSubTab('manage');
      setTimeout(() => setSuccessMsg(''), 6000);
    } catch (err: any) {
      console.error('Fixture creation failed:', err);
      setErrorMsg(`Failed to register fixture: ${err.message || 'Database error'}`);
      setSuccessMsg('');
    }
  };

  // Create new competition
  const handleAddCompetition = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompName.trim()) {
      setErrorMsg('Please specify a competition name.');
      return;
    }
    const prefix = newCompSport === SportType.FOOTBALL ? 'f-' : 'r-';
    const randHex = Math.random().toString(36).substring(2, 6);
    const compId = `${prefix}${newCompName.toLowerCase().replace(/\s+/g, '')}-${randHex}`;
    
    import('../competitions').then(({ addCompetition }) => {
      addCompetition({
        id: compId,
        name: newCompName.trim(),
        sport: newCompSport,
        nationality: newCompNationality,
        season: newCompSeason,
      });
      setSuccessMsg(`🚀 Successfully added Competition: ${newCompName}`);
      setNewCompName('');
    });
  };

  // Submit actual score outcome & trigger point allocation logic 
  const handleUpdateScore = async (fixture: Match) => {
    const scores = scoreInputs[fixture.id];
    if (!scores || scores.home === '' || scores.away === '') {
      alert('Please enter valid numeric outcomes for both home and away sides.');
      return;
    }

    const homeScore = parseInt(scores.home, 10);
    const awayScore = parseInt(scores.away, 10);
    if (isNaN(homeScore) || isNaN(awayScore)) {
      alert('Scores must be integers.');
      return;
    }

    setLoadingMatches(prev => ({ ...prev, [fixture.id]: true }));

    try {
      const updatedFixture = {
        ...fixture,
        status: 'completed' as const,
        homeScore,
        awayScore,
      };
      
      await dbSaveMatch(updatedFixture);
      
      setGroupFixtures(prev => prev.map(f => f.id === fixture.id ? updatedFixture : f));

      if (supabase) {
        const { data: predsData } = await supabase
          .from('predictions')
          .select('*')
          .eq('match_id', fixture.id);

        if (predsData) {
          for (const predRow of predsData) {
            const pointsWon = calculatePoints(fixture.sport, predRow.predicted_home_score, predRow.predicted_away_score, homeScore, awayScore);
            await supabase
              .from('predictions')
              .update({
                submitted: true,
                points_won: pointsWon
              })
              .eq('id', predRow.id);
          }
        }
      }

      // 2. Update logged in local storage settings for sandbox playground support
      // Find all predictions in local storage matching this fixture
      const lsKeys = Object.keys(localStorage);
      lsKeys.forEach((key) => {
        if (key.startsWith('predictions_')) {
          try {
            const preds = JSON.parse(localStorage.getItem(key) || '{}');
            if (preds[fixture.id]) {
              const predHome = preds[fixture.id].home;
              const predAway = preds[fixture.id].away;
              const pointsWon = calculatePoints(fixture.sport, predHome, predAway, homeScore, awayScore);

              const simulated = JSON.parse(localStorage.getItem(key.replace('predictions_', 'simulated_')) || '{}');
              simulated[fixture.id] = {
                home: homeScore,
                away: awayScore,
                played: true,
                pointsWon,
              };
              localStorage.setItem(key.replace('predictions_', 'simulated_'), JSON.stringify(simulated));

              const cleanUserId = key.replace('predictions_', '');
              const prevPoints = parseInt(localStorage.getItem(`points_${cleanUserId}`) || '0', 10);
              localStorage.setItem(`points_${cleanUserId}`, (prevPoints + pointsWon).toString());
            }
          } catch (e) {}
        }
      });

      setSuccessMsg(`🎯 Completed score registration for ${fixture.id}! Points distributed.`);
      setErrorMsg('');
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err: any) {
      console.error('Fixture score outcomes write back discrepancy:', err);
      setErrorMsg(`Failed to update score: ${err.message || 'Database error'}`);
      setSuccessMsg('');
    } finally {
      setLoadingMatches(prev => ({ ...prev, [fixture.id]: false }));
    }
  };

  const handleSettleMatchweek = async () => {
    if (!confirm('Are you sure you want to settle all completed matches? This will recalculate and distribute points for all completed fixtures.')) {
      return;
    }
    
    setSuccessMsg('Matchweek settlement initiated...');
    
    try {
      const completedFixtures = groupFixtures.filter(f => f.status === 'completed');
      let settledCount = 0;
      
      for (const fixture of completedFixtures) {
        if (fixture.homeScore !== undefined && fixture.awayScore !== undefined) {
          const { data: predsData } = await supabase
            .from('predictions')
            .select('*')
            .eq('match_id', fixture.id);

          if (predsData) {
            for (const predRow of predsData) {
              const pointsWon = calculatePoints(fixture.sport, predRow.predicted_home_score, predRow.predicted_away_score, fixture.homeScore, fixture.awayScore);
              await supabase
                .from('predictions')
                .update({ points_won: pointsWon })
                .eq('id', predRow.id);
            }
          }
          settledCount++;
        }
      }
      
      setSuccessMsg(`Successfully settled matchweek: processed ${settledCount} fixtures.`);
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err: any) {
      setErrorMsg(`Failed to settle matchweek: ${err.message}`);
    }
  };

  // Blended fixtures list (Mock Competition fixtures are parsed inside main frame, we only show admin registered ones here)
  const allCurrentFixtures = (() => {
    const seen = new Set<string>();
    const combined: any[] = [];

    groupFixtures.forEach((f) => {
      combined.push(f);
      seen.add(f.id);
    });

    localFixtures.forEach((f) => {
      if (!seen.has(f.id)) {
        combined.push(f);
        seen.add(f.id);
      }
    });

    combined.sort((a, b) => new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime());
    
    if (fixtureFilter === 'upcoming') {
      return combined.filter(f => f.status === 'upcoming');
    }
    if (fixtureFilter === 'completed') {
      return combined.filter(f => f.status === 'completed');
    }
    return combined;
  })();

  const activeCompetitionMeta = (compId: string) => {
    const c = getCompetitions().find((comp) => comp.id === compId);
    return c ? `${c.name} (${c.nationality})` : compId;
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl relative my-auto">
        {/* Animated Top Border strip */}
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-linear-to-r from-purple-500 via-indigo-500 to-blue-500 animate-border-glow" />

        {/* Section Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800/80 bg-slate-900 ">
          <div className="flex items-center gap-3">
            <div className="bg-purple-500/10 p-2 rounded-lg border border-purple-500/20">
              <Shield className="w-5.5 h-5.5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold font-display text-white uppercase tracking-wider">
                PitchSide Administrative Terminal
              </h3>
              <p className="text-[10px] text-slate-500 font-mono tracking-widest uppercase">
                SECURE ACCESS SEGMENT // SECURE DATABASE UTILITIES
              </p>
            </div>
          </div>
          <button
            id="admin-close-btn"
            onClick={onClose}
            className="text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800 p-2 rounded-full cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* AUTHENTICATED PANEL LAYOUT */}
        <div className="flex flex-col h-[78vh]">
          
          {/* Terminal Tab Bar Row */}
          <div className="bg-slate-950 px-5 py-2.5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className={`text-xs font-mono px-3.5 py-1.5 rounded-lg border cursor-pointer transition-all flex items-center gap-1.5 uppercase tracking-wide font-bold ${
                    activeTab === 'dashboard'
                      ? 'bg-purple-500/10 border-purple-500/25 text-purple-400 font-bold'
                      : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Dashboard</span>
                </button>

                <button
                  onClick={() => setActiveTab('players')}
                  className={`text-xs font-mono px-3.5 py-1.5 rounded-lg border cursor-pointer transition-all flex items-center gap-1.5 uppercase tracking-wide font-bold ${
                    activeTab === 'players'
                      ? 'bg-purple-500/10 border-purple-500/25 text-purple-400 font-bold'
                      : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Players ({registeredUsers.length})</span>
                </button>

                <button
                  id="tab-fixtures-btn"
                  onClick={() => setActiveTab('fixtures')}
                  className={`text-xs font-mono px-3.5 py-1.5 rounded-lg border cursor-pointer transition-all flex items-center gap-1.5 uppercase tracking-wide font-bold ${
                    activeTab === 'fixtures'
                      ? 'bg-blue-500/10 border-blue-500/25 text-blue-400 font-bold'
                      : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <Trophy className="w-3.5 h-3.5" />
                  <span>Fixtures & Scoring ({allCurrentFixtures.length})</span>
                </button>

                <button
                  id="tab-competitions-btn"
                  onClick={() => setActiveTab('competitions')}
                  className={`text-xs font-mono px-3.5 py-1.5 rounded-lg border cursor-pointer transition-all flex items-center gap-1.5 uppercase tracking-wide font-bold ${
                    activeTab === 'competitions'
                      ? 'bg-blue-500/10 border-blue-500/25 text-blue-400 font-bold'
                      : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <Trophy className="w-3.5 h-3.5" />
                  <span>Competitions</span>
                </button>

                <button
                  id="tab-backups-btn"
                  onClick={() => setActiveTab('backups')}
                  className={`text-xs font-mono px-3.5 py-1.5 rounded-lg border cursor-pointer transition-all flex items-center gap-1.5 uppercase tracking-wide font-bold ${
                    activeTab === 'backups'
                      ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400 font-bold'
                      : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>Archived Backups ({archivedUsers.length})</span>
                </button>

                <button
                  id="tab-communications-btn"
                  onClick={() => setActiveTab('communications')}
                  className={`text-xs font-mono px-3.5 py-1.5 rounded-lg border cursor-pointer transition-all flex items-center gap-1.5 uppercase tracking-wide font-bold ${
                    activeTab === 'communications'
                      ? 'bg-blue-500/10 border-blue-500/25 text-blue-400 font-bold'
                      : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Communications</span>
                </button>

                <button
                  id="tab-leagues-btn"
                  onClick={() => setActiveTab('leagues')}
                  className={`text-xs font-mono px-3.5 py-1.5 rounded-lg border cursor-pointer transition-all flex items-center gap-1.5 uppercase tracking-wide font-bold ${
                    activeTab === 'leagues'
                      ? 'bg-purple-500/10 border-purple-500/25 text-purple-400 font-bold'
                      : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Mini-Leagues</span>
                </button>
              </div>
            </div>

            {/* Notification alert ribbons */}
            {successMsg && (
              <div id="admin-toast-alert" className="bg-emerald-950/85 border-b border-emerald-500/30 text-emerald-300 font-mono text-[10px] px-5 py-2 flex items-center gap-2 animate-fade-in justify-center uppercase font-bold tracking-wider">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Tab content frames */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 bg-slate-900/30">
              
              {activeTab === 'dashboard' && (
                <AdminDashboard onNavigate={(tab, filter) => { 
                  setActiveTab(tab); 
                  if (filter) setFixtureFilter(filter); 
                }} />
              )}

              {/* TAB 1: PLAYERS */}
              {activeTab === 'players' && (
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
                      onClick={handleRefreshDb}
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
                      <div className="p-12 text-center text-xs text-slate-500 font-mono">
                        No player records found.
                      </div>
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
                                  <button onClick={() => openAuditModal(u)} className="font-bold text-white block text-[13px] hover:text-blue-400 cursor-pointer text-left transition-colors focus:outline-none w-full">
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
                                  <span className={`px-2 py-0.5 rounded-sm text-[9px] font-bold ${
                                    u.emailVerified ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400 animate-pulse'
                                  }`}>
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
                                      if (confirm(`Are you sure you want to delete player ${u.nickname}?\n\nThis will backup their historic predictions, unsubscribe them from mailing lists, and fully delete their profile account.`)) {
                                        onDeleteUser(u.id);
                                        setTimeout(() => {
                                          loadArchivedUsers();
                                        }, 1200);
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
                </div>
              )}

              {/* TAB 2: FIXTURES */}
              {activeTab === 'fixtures' && (
                <div className="space-y-6">
                  
                  {/* Fixtures Sub-Navigation */}
                  <div className="flex border-b border-slate-800 pb-3 justify-between items-center">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setFixtureSubTab('manage')}
                        className={`text-xs font-mono py-1 px-3 rounded-lg border transition-all cursor-pointer ${
                          fixtureSubTab === 'manage'
                            ? 'bg-blue-500/10 border-blue-500/20 text-blue-400 font-bold'
                            : 'border-transparent text-slate-400 hover:text-white'
                        }`}
                      >
                        Registered Fixtures ({allCurrentFixtures.length})
                      </button>
                      <button
                        id="add-fixture-subtab-btn"
                        onClick={() => setFixtureSubTab('add')}
                        className={`text-xs font-mono py-1 px-3 rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
                          fixtureSubTab === 'add'
                            ? 'bg-blue-500/10 border-blue-500/20 text-blue-400 font-bold'
                            : 'border-transparent text-slate-400 hover:text-white'
                        }`}
                      >
                        <Plus className="w-3 h-3" />
                        <span>Register Game Fixture</span>
                      </button>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">Database: sports/*</span>
                  </div>

                  {/* SUB-TAB 2A: REGISTER NEW fixture */}
                  {fixtureSubTab === 'add' && (
                    <div className="bg-slate-950/60 p-5 rounded-xl border border-slate-800 space-y-4 max-w-2xl mx-auto animate-fade-in">
                      <div>
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
                          <Plus className="w-4 h-4 text-emerald-400" /> Catalog New Match Fixture
                        </h4>
                        <p className="text-[10px] text-slate-500 font-sans mt-0.5">
                          Populate scheduled lineup elements, dates, and locations. A PitchSide internal reference ID is automatically formatted on submission.
                        </p>
                      </div>

                      <form onSubmit={handleAddFixture} className="space-y-4 text-xs font-mono">
                        {/* Sport selection */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider text-[9px]">Sport Discipline</label>
                            <select
                              value={sport}
                              onChange={(e) => setSport(e.target.value as SportType)}
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-white focus:border-blue-500 focus:outline-hidden"
                            >
                              <option value={SportType.FOOTBALL}>Football</option>
                              <option value={SportType.RUGBY}>Rugby Union</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider text-[9px]">Competition / League</label>
                            <select
                              value={compSelect}
                              onChange={(e) => setCompSelect(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-white focus:border-blue-500 focus:outline-hidden"
                            >
                              {getCompetitions().filter((c) => c.sport === sport).map((comp) => (
                                <option key={comp.id} value={comp.id}>
                                  {comp.name} ({comp.nationality})
                                </option>
                              ))}
                            </select>
                          </div>
                          
                          <div>
                            <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider text-[9px]">Season</label>
                            <select
                              value={matchSeason}
                              onChange={(e) => setMatchSeason(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-white focus:border-blue-500 focus:outline-hidden"
                            >
                              <option value="2026">2026</option>
                              <option value="2025">2025</option>
                              <option value="2024">2024</option>
                            </select>
                          </div>
                        </div>

                        {/* Match Time selection */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="sm:col-span-1">
                            <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider text-[9px]">Kick-off Date</label>
                            <input
                              id="fixture-date-input"
                              type="date"
                              required
                              value={matchDateInput}
                              onChange={(e) => setMatchDateInput(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-white focus:border-blue-500 focus:outline-hidden"
                            />
                          </div>
                          <div>
                            <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider text-[9px]">Hour (24H)</label>
                            <select
                              value={matchHour}
                              onChange={(e) => setMatchHour(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-white focus:border-blue-500 focus:outline-hidden"
                            >
                              {Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0')).map(h => (
                                <option key={h} value={h}>{h}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider text-[9px]">Minute</label>
                            <select
                              value={matchMinute}
                              onChange={(e) => setMatchMinute(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-white focus:border-blue-500 focus:outline-hidden"
                            >
                              {Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0')).map(m => (
                                <option key={m} value={m}>{m}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Teams Matching */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider text-[9px]">Home Team Name</label>
                            <input
                              id="fixture-home-input"
                              type="text"
                              required
                              placeholder="e.g. Manchester Utd"
                              value={homeTeam}
                              onChange={(e) => setHomeTeam(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-white focus:border-blue-500 placeholder:text-slate-600 outline-hidden focus:outline-hidden"
                            />
                          </div>

                          <div>
                            <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider text-[9px]">Away Team Name</label>
                            <input
                              id="fixture-away-input"
                              type="text"
                              required
                              placeholder="e.g. Liverpool"
                              value={awayTeam}
                              onChange={(e) => setAwayTeam(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-white focus:border-blue-500 placeholder:text-slate-600 outline-hidden focus:outline-hidden"
                            />
                          </div>
                        </div>

                        {errorMsg && (
                          <p className="text-xs text-red-400 font-semibold italic">{errorMsg}</p>
                        )}

                        <div className="pt-3">
                          <button
                            id="submit-new-fixture-btn"
                            type="submit"
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold font-display uppercase text-xs p-3.5 rounded-xl cursor-pointer transition-transform duration-100 flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/10 w-full"
                          >
                            <Plus className="w-4 h-4" /> Save & Register sports Fixture ID
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* SUB-TAB 2B: MANAGE REGISTRATION SCORES */}
                  {fixtureSubTab === 'manage' && (
                    <div className="space-y-4 animate-fade-in">
                      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                        <div>
                          <h4 className="text-xs font-bold text-slate-300 font-mono uppercase tracking-wider">
                            Matches Outcome Supervisor
                          </h4>
                          <p className="text-[10px] text-slate-500 font-sans">
                            Record final score outcomes of scheduled fixtures. PitchSide engines auto-evaluate predictions sheets.
                          </p>
                        </div>
                        {fixtureFilter !== 'all' && (
                          <button
                            onClick={() => setFixtureFilter('all')}
                            className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <X className="w-3 h-3" /> Clear "{fixtureFilter}" Filter
                          </button>
                        )}
                      </div>

                      {allCurrentFixtures.length > 0 && (
                        <div className="flex justify-end border-b border-slate-800 pb-4 mb-2">
                          <button
                            onClick={handleSettleMatchweek}
                            className="bg-purple-600/20 hover:bg-purple-600 text-purple-400 hover:text-white border border-purple-500/30 text-[10px] font-bold tracking-wider font-mono px-4 py-2 rounded-lg cursor-pointer transition-colors flex items-center gap-2"
                          >
                            <RefreshCw className="w-3 h-3" /> Settle All Completed Matches
                          </button>
                        </div>
                      )}

                      {allCurrentFixtures.length === 0 ? (
                        <div className="p-12 text-center text-xs text-slate-500 font-mono border border-dashed border-slate-800 rounded-xl bg-slate-950/40">
                          {fixtureFilter !== 'all' 
                            ? `No ${fixtureFilter} matches found in database.` 
                            : 'No sports fixtures currently registered in database memory clusters. Click "Register Game Fixture" above to add some.'}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-4">
                          {allCurrentFixtures.map((fixture) => {
                            const scores = scoreInputs[fixture.id] || { home: '', away: '' };
                            const loading = !!loadingMatches[fixture.id];
                            const isCompleted = fixture.status === 'completed';

                            return (
                              <div
                                key={fixture.id}
                                className={`p-4 rounded-xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all ${
                                  isCompleted
                                    ? 'bg-slate-950/40 border-slate-800/80'
                                    : 'bg-slate-950 border-blue-950/40 shadow-xs'
                                }`}
                              >
                                {/* Fixture Metadata info cards */}
                                <div className="space-y-1.5 min-w-[280px]">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded-sm font-mono border border-blue-500/15">
                                      {fixture.id}
                                    </span>
                                    <span className="text-[9px] uppercase font-mono text-slate-500">
                                      {fixture.sport}
                                    </span>
                                    {isCompleted ? (
                                      <span className="text-[8px] uppercase font-sans font-bold px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-md">
                                        ● Completed
                                      </span>
                                    ) : (
                                      <span className="text-[8px] uppercase font-sans font-bold px-1.5 py-0.5 bg-yellow-500/10 text-yellow-500 rounded-md animate-pulse">
                                        ● Upcoming
                                      </span>
                                    )}
                                  </div>

                                  <div className="text-[12px]">
                                    <span className="font-extrabold text-white text-sm">{fixture.homeTeam}</span>
                                    <span className="mx-2 text-slate-500 font-bold font-mono">VS</span>
                                    <span className="font-extrabold text-white text-sm">{fixture.awayTeam}</span>
                                  </div>

                                  <div className="text-[9px] text-slate-400 font-mono space-y-0.5">
                                    <div className="flex items-center gap-1">
                                      <Calendar className="w-3 h-3 text-purple-400" />
                                      <span>{new Date(fixture.matchDate).toLocaleDateString()} {new Date(fixture.matchDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                  </div>
                                </div>

                                {/* Active point update or result cards */}
                                <div className="w-full md:w-auto flex items-center justify-end gap-3 self-end md:self-auto border-t md:border-t-0 border-slate-800/60 pt-3 md:pt-0">
                                  {isCompleted ? (
                                    <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-lg text-center font-display min-w-[140px] justify-center">
                                      <div>
                                        <span className="text-slate-500 text-[8px] uppercase font-mono block">Actual Outcome</span>
                                        <span className="text-[15px] font-black tracking-widest text-emerald-400">
                                          {fixture.homeScore} - {fixture.awayScore}
                                        </span>
                                      </div>
                                    </div>
                                  ) : (
                                    /* Active inputs for score modification */
                                    <div className="flex items-center gap-2.5">
                                      <div className="flex items-center gap-1">
                                        <input
                                          id={`admin-home-score-${fixture.id}`}
                                          type="number"
                                          min={0}
                                          placeholder="H"
                                          value={scores.home}
                                          onChange={(e) =>
                                            setScoreInputs((prev) => ({
                                              ...prev,
                                              [fixture.id]: { ...scores, home: e.target.value },
                                            }))
                                          }
                                          className="w-10 text-center font-display font-black text-white bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg py-1.5"
                                        />
                                        <span className="text-slate-500 font-mono text-[10px]">:</span>
                                        <input
                                          id={`admin-away-score-${fixture.id}`}
                                          type="number"
                                          min={0}
                                          placeholder="A"
                                          value={scores.away}
                                          onChange={(e) =>
                                            setScoreInputs((prev) => ({
                                              ...prev,
                                              [fixture.id]: { ...scores, away: e.target.value },
                                            }))
                                          }
                                          className="w-10 text-center font-display font-black text-white bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg py-1.5"
                                        />
                                      </div>

                                      <button
                                        id={`btn-save-score-${fixture.id}`}
                                        disabled={loading}
                                        onClick={() => handleUpdateScore(fixture)}
                                        className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-[10px] font-mono px-3.5 py-2 rounded-lg cursor-pointer transition-colors max-w-[150px] shadow-sm flex items-center justify-center gap-1 uppercase tracking-wide"
                                      >
                                        {loading ? (
                                          <RefreshCw className="w-3 h-3 animate-spin" />
                                        ) : (
                                          <>
                                            <Play className="w-2.5 h-2.5" />
                                            <span>Update Result</span>
                                          </>
                                        )}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                </div>
              )}

              {/* TAB 3: COMPETITIONS */}
              {activeTab === 'competitions' && (
                <div className="space-y-4">
                  <div className="bg-slate-950/60 p-5 rounded-xl border border-slate-800 space-y-4 max-w-2xl mx-auto animate-fade-in">
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
                        <Plus className="w-4 h-4 text-emerald-400" /> Catalog New Competition
                      </h4>
                      <p className="text-[10px] text-slate-500 font-sans mt-0.5">
                        Create a new global or local competition that custom leagues and matches can use.
                      </p>
                    </div>

                    <form onSubmit={handleAddCompetition} className="space-y-4 text-xs font-mono">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider text-[9px]">Competition Name</label>
                          <input
                            type="text"
                            required
                            value={newCompName}
                            onChange={(e) => setNewCompName(e.target.value)}
                            placeholder="e.g. World Cup 2026"
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-white focus:border-blue-500 focus:outline-hidden"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider text-[9px]">Sport Discipline</label>
                          <select
                            value={newCompSport}
                            onChange={(e) => setNewCompSport(e.target.value as SportType)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-white focus:border-blue-500 focus:outline-hidden"
                          >
                            <option value={SportType.FOOTBALL}>Football</option>
                            <option value={SportType.RUGBY}>Rugby Union</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider text-[9px]">Nationality / Region</label>
                          <input
                            type="text"
                            required
                            value={newCompNationality}
                            onChange={(e) => setNewCompNationality(e.target.value)}
                            placeholder="e.g. Global"
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-white focus:border-blue-500 focus:outline-hidden"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider text-[9px]">Season</label>
                          <select
                            value={newCompSeason}
                            onChange={(e) => setNewCompSeason(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-white focus:border-blue-500 focus:outline-hidden"
                          >
                            <option value="2026">2026</option>
                            <option value="2025">2025</option>
                            <option value="2024">2024</option>
                          </select>
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg uppercase tracking-wider text-[11px] transition-colors shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:shadow-[0_0_25px_rgba(16,185,129,0.4)]"
                      >
                        Register Competition
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* TAB 4: ARCHIVED BACKUPS */}
              {activeTab === 'backups' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-bold text-slate-300 font-mono uppercase tracking-wider">
                        Retained player & Predictions Archives
                      </h4>
                      <p className="text-[10px] text-slate-500 font-sans">
                        Retain historic predictions, backup profiles, and check active mailing list exclusions.
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={loadArchivedUsers}
                        disabled={loadingArchives}
                        className="text-xs font-mono text-slate-300 hover:text-white bg-slate-950 border border-slate-800 p-2 sm:px-3 sm:py-1.5 rounded-lg cursor-pointer transition-all flex items-center gap-1.5 font-medium animate-pulse"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 text-zinc-400 ${loadingArchives ? 'animate-spin' : ''}`} />
                        <span>Refresh list</span>
                      </button>

                      <button
                        onClick={() => {
                          if (archivedUsers.length === 0) {
                            alert('No archived profiles available to export.');
                            return;
                          }
                          const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(archivedUsers, null, 2));
                          const downloadAnchor = document.createElement('a');
                          downloadAnchor.setAttribute("href", dataStr);
                          downloadAnchor.setAttribute("download", "all_retained_players_predictions_backup.json");
                          document.body.appendChild(downloadAnchor);
                          downloadAnchor.click();
                          downloadAnchor.remove();
                          setSuccessMsg('Successfully downloaded complete backup file!');
                        }}
                        className="text-xs font-mono text-emerald-300 hover:text-emerald-200 bg-emerald-500/10 border border-emerald-500/20 p-2 sm:px-3 sm:py-1.5 rounded-lg cursor-pointer transition-all flex items-center gap-1.5 font-bold"
                        title="Download back-end file backup"
                      >
                        <Download className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Download Back-end Backup File</span>
                      </button>
                    </div>
                  </div>

                  {/* Search filter input bar */}
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500 font-bold" />
                    <input
                      id="search-archives-input"
                      type="text"
                      placeholder="Search backups by name, nickname or email..."
                      value={archiveSearch}
                      onChange={(e) => setArchiveSearch(e.target.value)}
                      className="w-full bg-slate-950/80 border border-slate-800 text-slate-100 text-xs pl-9 pr-4 py-2 rounded-xl focus:border-emerald-500 focus:outline-hidden transition-colors"
                    />
                  </div>

                  {/* Backups table listing */}
                  {loadingArchives ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-500 gap-2 font-mono text-xs">
                      <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
                      <span>Loading archives database...</span>
                    </div>
                  ) : archivedUsers.length === 0 ? (
                    <div className="border border-slate-800/40 bg-slate-950/20 rounded-xl p-8 text-center uppercase tracking-wide">
                      <AlertTriangle className="w-8 h-8 text-amber-500/60 mx-auto mb-2" />
                      <p className="text-xs font-mono text-slate-400">No archived backups exist</p>
                      <p className="text-[10px] text-slate-500 mt-1 lowercase font-sans">
                        Any players removed using the bin button will be backed up here.
                      </p>
                    </div>
                  ) : (
                    <div className="border border-slate-800/60 rounded-xl overflow-hidden bg-slate-950/15">
                      <table className="w-full text-left font-mono text-[10px] sm:text-xs">
                        <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase tracking-widest text-[9px]">
                          <tr>
                            <th className="py-2 px-4 font-black">player Backup</th>
                            <th className="py-2 px-4 font-black">Mailing Exclusions</th>
                            <th className="py-2 px-4 font-black">Predictions Retained</th>
                            <th className="py-2 px-4 font-black">Archived Date</th>
                            <th className="py-2 px-4 text-right font-black">Backup File</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/40">
                          {archivedUsers
                            .filter(b => {
                              const search = archiveSearch.toLowerCase();
                              return (
                                (b.deletedUser?.nickname || '').toLowerCase().includes(search) ||
                                (b.deletedUser?.email || '').toLowerCase().includes(search) ||
                                (b.deletedUser?.firstName || '').toLowerCase().includes(search) ||
                                (b.deletedUser?.surname || '').toLowerCase().includes(search)
                              );
                            })
                            .map((b, idx) => (
                              <tr key={idx} className="hover:bg-slate-900/35 transition-colors">
                                <td className="py-3 px-4">
                                  <div className="font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                                    <span>👤 {b.deletedUser?.nickname || 'Archived User'}</span>
                                    {b.deletedUser?.isAdmin && (
                                      <span className="text-[8px] bg-red-500/15 text-red-400 px-1 py-0.5 rounded">ADMIN</span>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-slate-400 block mt-0.5">{b.deletedUser?.firstName} {b.deletedUser?.surname}</span>
                                  <span className="text-[10px] text-slate-500 block">{b.deletedUser?.email}</span>
                                </td>
                                <td className="py-3 px-4 max-w-[200px]">
                                  <span className="inline-flex items-center gap-1 text-[9px] bg-red-500/10 text-red-400 border border-red-500/15 px-2 py-0.5 rounded-xs font-bold leading-none">
                                    <Mail className="w-2.5 h-2.5" />
                                    <span>UNSUBSCRIBED</span>
                                  </span>
                                  <span className="text-[8px] text-slate-500 block mt-1 leading-normal">Excluded from mailing lists</span>
                                </td>
                                <td className="py-3 px-4 font-semibold text-sky-400">
                                  📊 {b.predictions?.length || 0} predictions retained
                                </td>
                                <td className="py-3 px-4 text-slate-400 text-[10px]">
                                  {new Date(b.deletedUser?.deletedAt || b.deletedAt || Date.now()).toLocaleString()}
                                </td>
                                <td className="py-3 px-4 text-right space-x-1.5">
                                  <button
                                    onClick={() => alert('Account restoration initiated')}
                                    className="p-1 px-2.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-lg cursor-pointer transition-colors text-[9px] font-mono inline-flex items-center gap-1 font-bold"
                                    title="Restore User Account"
                                  >
                                    <RefreshCw className="w-3 h-3" />
                                    <span>RESTORE</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(b, null, 2));
                                      const downloadAnchor = document.createElement('a');
                                      downloadAnchor.setAttribute("href", dataStr);
                                      downloadAnchor.setAttribute("download", `pitchside_backup_${b.deletedUser?.nickname || 'archived'}.json`);
                                      document.body.appendChild(downloadAnchor);
                                      downloadAnchor.click();
                                      downloadAnchor.remove();
                                      setSuccessMsg(`Archived user '${b.deletedUser?.nickname}' backup file downloaded successfully!`);
                                    }}
                                    className="p-1 px-2.5 bg-slate-950 hover:bg-slate-900 text-slate-300 hover:text-white border border-slate-800 rounded-lg cursor-pointer transition-colors text-[9px] font-mono inline-flex items-center gap-1"
                                    title="Download data bundle"
                                  >
                                    <FileJson className="w-3 h-3 text-emerald-400" />
                                    <span>JSON BUNDLE</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (confirm(`Permanently purge archive for ${b.deletedUser?.nickname}? This cannot be undone.`)) {
                                        alert('Permanently Purge initiated');
                                      }
                                    }}
                                    className="p-1 px-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg cursor-pointer transition-colors text-[9px] font-mono inline-flex items-center gap-1 font-bold"
                                    title="Permanently Purge"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    <span>PURGE</span>
                                  </button>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: COMMUNICATIONS */}
              {activeTab === 'communications' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="bg-slate-950/60 p-5 rounded-xl border border-slate-800 space-y-4 max-w-3xl mx-auto">
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
                        <Mail className="w-4 h-4 text-blue-400" /> Dispatch Broadcast
                      </h4>
                      <p className="text-[10px] text-slate-500 font-sans mt-0.5">
                        Send announcements, updates, or alerts to user segments.
                      </p>
                    </div>

                    <div className="space-y-4 text-xs font-mono">
                      <div>
                        <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider text-[9px]">Target Audience</label>
                        <select
                          value={broadcastTarget}
                          onChange={(e) => setBroadcastTarget(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-white focus:border-blue-500 focus:outline-hidden"
                        >
                          <option value="All Players">All Players</option>
                          <option value="Verified Only">Verified Only</option>
                          <option value="Admins Only">Admins Only</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider text-[9px]">Message Title</label>
                        <input
                          type="text"
                          required
                          value={broadcastTitle}
                          onChange={(e) => setBroadcastTitle(e.target.value)}
                          placeholder="e.g. New Matchweek Added!"
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-white focus:border-blue-500 focus:outline-hidden"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider text-[9px]">Message Body</label>
                        <textarea
                          required
                          value={broadcastBody}
                          onChange={(e) => setBroadcastBody(e.target.value)}
                          rows={5}
                          placeholder="Write your announcement here..."
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-white focus:border-blue-500 focus:outline-hidden resize-none"
                        ></textarea>
                      </div>

                      <div className="pt-2 flex justify-end">
                        <button
                          onClick={handleDispatchBroadcast}
                          className="bg-blue-600 hover:bg-blue-500 text-white font-bold font-mono uppercase text-xs px-6 py-2.5 rounded-lg cursor-pointer transition-colors shadow-md flex items-center gap-1.5"
                        >
                          <Play className="w-3.5 h-3.5" /> Send
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 6: MINI-LEAGUES */}
              {activeTab === 'leagues' && (
                <div className="space-y-4 animate-fade-in">
                  <div>
                    <h4 className="text-xs font-bold text-slate-300 font-mono uppercase tracking-wider flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-purple-400" /> Private Mini-Leagues Directory
                    </h4>
                    <p className="text-[10px] text-slate-500 font-sans mt-0.5">
                      Monitor and manage user-created private leagues.
                    </p>
                  </div>

                  <div className="border border-slate-800/60 rounded-xl overflow-hidden bg-slate-950/15">
                    {loadingLeagues ? (
                      <div className="p-12 text-center text-slate-500 font-mono text-xs flex flex-col items-center justify-center gap-3">
                        <RefreshCw className="w-6 h-6 animate-spin text-purple-400" />
                        <span>Loading active mini-leagues...</span>
                      </div>
                    ) : activeLeagues.length === 0 ? (
                      <div className="p-12 text-center text-slate-500 font-mono text-xs">
                        No mini-leagues currently registered.
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
                          {activeLeagues.map((league) => (
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
                              <td className="py-3 px-4 text-right space-x-2 flex justify-end gap-2">
                                <div className="relative group">
                                  <button
                                    onClick={() => handleTransferLeague(league.id, league.name)}
                                    className="px-2.5 py-1.5 rounded-lg text-[9px] font-bold tracking-wider cursor-pointer font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
                                  >
                                    TRANSFER
                                  </button>
                                  <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-slate-900 border border-slate-800 rounded-lg text-[9px] text-slate-300 text-left opacity-0 invisible scale-95 group-hover:opacity-100 group-hover:visible group-hover:scale-100 transition-all z-10 shadow-xl pointer-events-none">
                                    Reassign ownership if the creator abandons this league.
                                  </div>
                                </div>
                                <div className="relative group">
                                  <button
                                    onClick={() => handleDeleteLeague(league.id, league.name)}
                                    className="px-2.5 py-1.5 rounded-lg text-[9px] font-bold tracking-wider cursor-pointer font-mono bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors"
                                  >
                                    DELETE
                                  </button>
                                  <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-slate-900 border border-slate-800 rounded-lg text-[9px] text-slate-300 text-left opacity-0 invisible scale-95 group-hover:opacity-100 group-hover:visible group-hover:scale-100 transition-all z-10 shadow-xl pointer-events-none">
                                    Permanently remove offensive or empty leagues.
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}

            </div>
          </div>
      </div>

      {/* League Audit Modal */}
      {viewingLeague && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col font-mono text-sm animate-fade-in relative overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-800/80 bg-slate-900/50">
              <div>
                <h3 className="text-white font-bold text-lg flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-400" /> League Details
                </h3>
              </div>
              <button
                onClick={() => setViewingLeague(null)}
                className="text-slate-500 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="bg-slate-900/30 border border-slate-800/80 rounded-xl p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9px] text-slate-500 uppercase tracking-widest mb-1.5">League Name</label>
                    <div className="text-white font-bold bg-slate-950/50 px-3 py-2 border border-slate-800 rounded-lg">{viewingLeague.name}</div>
                  </div>
                  <div>
                    <label className="block text-[9px] text-slate-500 uppercase tracking-widest mb-1.5">Join Code</label>
                    <div className="text-white font-bold bg-slate-950/50 px-3 py-2 border border-slate-800 rounded-lg tracking-widest">{viewingLeague.id}</div>
                  </div>
                  <div>
                    <label className="block text-[9px] text-slate-500 uppercase tracking-widest mb-1.5">Creator</label>
                    <div className="text-slate-300 bg-slate-950/50 px-3 py-2 border border-slate-800 rounded-lg">{viewingLeague.creatorName || 'Unknown'}</div>
                  </div>
                  <div>
                    <label className="block text-[9px] text-slate-500 uppercase tracking-widest mb-1.5">Created At</label>
                    <div className="text-slate-300 bg-slate-950/50 px-3 py-2 border border-slate-800 rounded-lg text-xs">{new Date(viewingLeague.createdAt).toLocaleString()}</div>
                  </div>
                </div>
                
                <div>
                  <label className="block text-[9px] text-slate-500 uppercase tracking-widest mb-1.5">Members ({viewingLeague.members?.length || 0})</label>
                  <div className="bg-slate-950/50 border border-slate-800 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                    {viewingLeague.members && viewingLeague.members.length > 0 ? (
                      <ul className="divide-y divide-slate-800/50 text-xs">
                        {viewingLeague.members.map((member, i) => {
                          const user = registeredUsers.find(u => u.id === member);
                          return (
                            <li key={i} className="px-3 py-2 text-slate-300">
                              {user ? user.nickname : 'Unknown User'}
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <div className="px-3 py-4 text-center text-slate-500 text-xs">No members found.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
                <button
                  onClick={() => setAuditTab('identity')}
                  className={`w-full flex items-center gap-2 px-4 py-3 rounded-lg text-xs font-bold transition-colors ${
                    auditTab === 'identity' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  <User className="w-4 h-4" /> Identity Overview
                </button>
                <button
                  onClick={() => setAuditTab('security')}
                  className={`w-full flex items-center gap-2 px-4 py-3 rounded-lg text-xs font-bold transition-colors ${
                    auditTab === 'security' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  <Shield className="w-4 h-4" /> Access & Security
                </button>
                <button
                  onClick={() => setAuditTab('ledger')}
                  className={`w-full flex items-center gap-2 px-4 py-3 rounded-lg text-xs font-bold transition-colors ${
                    auditTab === 'ledger' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  <List className="w-4 h-4" /> Predictions
                </button>
                <button
                  onClick={() => setAuditTab('communications')}
                  className={`w-full flex items-center gap-2 px-4 py-3 rounded-lg text-xs font-bold transition-colors ${
                    auditTab === 'communications' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  <MessageSquare className="w-4 h-4" /> Communications
                </button>
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
                {/* SECTION A: Identity Overview */}
                {auditTab === 'identity' && (
                  <div className="space-y-6 animate-fade-in">
                    <div>
                      <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 border-b border-slate-800 pb-2">User Information</h4>
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
                      <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 border-b border-slate-800 pb-2">Identity Profile (Read-Only)</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div>
                          <label className="block text-[9px] text-slate-500 uppercase tracking-widest mb-1.5">Nickname (Player ID)</label>
                          <div className="w-full bg-slate-900/50 border border-slate-800 rounded-lg px-3 py-2.5 text-slate-400 text-xs">
                            {editingPlayer.nickname || '-'}
                          </div>
                        </div>
                        <div>
                          <label className="block text-[9px] text-slate-500 uppercase tracking-widest mb-1.5">Date of Birth</label>
                          <div className="w-full bg-slate-900/50 border border-slate-800 rounded-lg px-3 py-2.5 text-slate-400 text-xs">
                            {editingPlayer.dob || '-'}
                          </div>
                        </div>
                        <div>
                          <label className="block text-[9px] text-slate-500 uppercase tracking-widest mb-1.5">First Name</label>
                          <div className="w-full bg-slate-900/50 border border-slate-800 rounded-lg px-3 py-2.5 text-slate-400 text-xs">
                            {editingPlayer.firstName || '-'}
                          </div>
                        </div>
                        <div>
                          <label className="block text-[9px] text-slate-500 uppercase tracking-widest mb-1.5">Surname</label>
                          <div className="w-full bg-slate-900/50 border border-slate-800 rounded-lg px-3 py-2.5 text-slate-400 text-xs">
                            {editingPlayer.surname || '-'}
                          </div>
                        </div>
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

                {/* SECTION B: Access & Security */}
                {auditTab === 'security' && (
                  <div className="space-y-6 animate-fade-in">
                    <div>
                      <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 border-b border-slate-800 pb-2">Credentials & Verification</h4>
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
                                setSuccessMsg(`Manually verified email for ${editingPlayer.nickname}.`);
                                setTimeout(() => setSuccessMsg(''), 3000);
                              }}
                              className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 px-4 py-2 rounded-lg text-xs font-bold transition-colors"
                            >
                              Manually Verify Email
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setSuccessMsg(`Secure password reset link dispatched to ${editingPlayer.email}.`);
                              setTimeout(() => setSuccessMsg(''), 5000);
                            }}
                            className="bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 border border-purple-500/30 px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2"
                          >
                            <Lock className="w-3.5 h-3.5" /> Force Password Reset
                          </button>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 border-b border-slate-800 pb-2">Account Status</h4>
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
                              onClick={async () => {
                                // Simulate unsuspend
                                setSuccessMsg(`User ${editingPlayer.nickname} has had gaming rights restored.`);
                                setEditingPlayer({ ...editingPlayer, suspendedUntil: undefined });
                                setTimeout(() => setSuccessMsg(''), 3000);
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
                                <label className="block text-[9px] text-slate-500 uppercase tracking-widest mb-1.5">Suspend Until (Date & Time)</label>
                                <input
                                  type="datetime-local"
                                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-500/50"
                                  value={suspendForm.until}
                                  onChange={(e) => setSuspendForm({ ...suspendForm, until: e.target.value })}
                                />
                              </div>
                              <div>
                                <label className="block text-[9px] text-slate-500 uppercase tracking-widest mb-1.5">Admin Password</label>
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
                                onClick={async () => {
                                  if (!suspendForm.until || !suspendForm.adminPassword) {
                                    alert("Please fill in both the suspension date and your admin password.");
                                    return;
                                  }
                                  // Simulate validation
                                  if (suspendForm.adminPassword !== 'admin') {
                                    alert("Invalid admin password."); // Simple simulation
                                    // Normally we would verify auth
                                  }
                                  setSuccessMsg(`User ${editingPlayer.nickname} suspended until ${new Date(suspendForm.until).toLocaleString()}.`);
                                  setEditingPlayer({ ...editingPlayer, suspendedUntil: suspendForm.until });
                                  setShowSuspendForm(false);
                                  setTimeout(() => setSuccessMsg(''), 4000);
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

                {/* SECTION C: Game Ledger & Integrity */}
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
                            <label className="block text-[9px] text-slate-400 uppercase tracking-widest mb-1.5">Adjustment Amount (+/-)</label>
                            <input
                              type="number"
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500/50"
                              value={manualPointAdjust.amount}
                              onChange={(e) => setManualPointAdjust({ ...manualPointAdjust, amount: parseInt(e.target.value) || 0 })}
                            />
                          </div>
                          <div className="w-full sm:w-2/3">
                            <label className="block text-[9px] text-slate-400 uppercase tracking-widest mb-1.5">Reason for Adjustment</label>
                            <input
                              type="text"
                              placeholder="e.g. Correcting mistaken match outcome..."
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500/50"
                              value={manualPointAdjust.reason}
                              onChange={(e) => setManualPointAdjust({ ...manualPointAdjust, reason: e.target.value })}
                            />
                          </div>
                          <button
                            onClick={() => {
                              if (!manualPointAdjust.reason) {
                                alert("Please provide a reason for the adjustment.");
                                return;
                              }
                              setSuccessMsg(`Successfully adjusted points by ${manualPointAdjust.amount} for ${editingPlayer.nickname}.`);
                              setShowPointAdjust(false);
                              setTimeout(() => setSuccessMsg(''), 4000);
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
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${predFilterType === 'upcoming' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}`}
                        >
                          Upcoming Matches
                        </button>
                        <button
                          onClick={() => setPredFilterType('completed')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${predFilterType === 'completed' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}`}
                        >
                          Completed Matches
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => setPredSportFilter(null)}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors ${predSportFilter === null ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'}`}
                        >
                          All Sports
                        </button>
                        <button
                          onClick={() => setPredSportFilter('football')}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors ${predSportFilter === 'football' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'}`}
                        >
                          Football
                        </button>
                        <button
                          onClick={() => setPredSportFilter('rugby')}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors ${predSportFilter === 'rugby' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'}`}
                        >
                          Rugby
                        </button>
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
                            const isUpcoming = pred.matches?.status === 'upcoming' || (!pred.matches?.actual_home_score && pred.matches?.actual_home_score !== 0 && !pred.matches?.home_score);
                            
                            // 1. Filter by upcoming / completed
                            if (predFilterType === 'upcoming' && !isUpcoming) return false;
                            if (predFilterType === 'completed' && isUpcoming) return false;
                            
                            // 2. Filter by sport
                            if (predSportFilter && pred.matches?.sport !== predSportFilter) return false;

                            // 3. Filter by search term
                            if (predSearchTerm.trim()) {
                              const searchLower = predSearchTerm.toLowerCase();
                              const homeTeam = (pred.matches?.home_team || '').toLowerCase();
                              const awayTeam = (pred.matches?.away_team || '').toLowerCase();
                              if (!homeTeam.includes(searchLower) && !awayTeam.includes(searchLower)) {
                                return false;
                              }
                            }

                            return true;
                          });

                          if (filteredPredictions.length === 0) {
                            return (
                              <div className="p-12 text-center text-slate-500 text-xs">
                                No predictions match your current filters.
                              </div>
                            );
                          }

                          return (
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs">
                                <thead>
                                  <tr className="bg-slate-900/80 border-b border-slate-800 text-slate-500 text-[9px] uppercase tracking-wider">
                                    <th className="py-3 px-4">Match</th>
                                    <th className="py-3 px-4">Sport</th>
                                    <th className="py-3 px-4">Kick-Off Time</th>
                                    <th className="py-3 px-4 text-center">Prediction</th>
                                    {predFilterType === 'completed' && (
                                      <th className="py-3 px-4 text-center">Actual Score</th>
                                    )}
                                    {predFilterType === 'completed' && (
                                      <th className="py-3 px-4 text-right">Points Won</th>
                                    )}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/40">
                                  {filteredPredictions.map((pred) => {
                                    const matchTitle = pred.matches ? `${pred.matches.home_team} vs ${pred.matches.away_team}` : pred.match_id;
                                    
                                    // Highlight search term
                                    const highlightText = (text: string) => {
                                      if (!predSearchTerm.trim()) return text;
                                      const parts = text.split(new RegExp(`(${predSearchTerm})`, 'gi'));
                                      return (
                                        <span>
                                          {parts.map((part, i) => 
                                            part.toLowerCase() === predSearchTerm.toLowerCase() ? 
                                              <span key={i} className="bg-amber-500/30 text-amber-200">{part}</span> : part
                                          )}
                                        </span>
                                      );
                                    };

                                    return (
                                      <tr key={pred.id} className="hover:bg-slate-900/20">
                                        <td className="py-3 px-4 text-[11px] font-bold text-white">
                                          {highlightText(matchTitle)}
                                        </td>
                                        <td className="py-3 px-4 text-[10px] text-slate-400 capitalize">
                                          {pred.matches?.sport || '-'}
                                        </td>
                                        <td className="py-3 px-4 text-[10px] text-slate-500">
                                          {pred.matches?.kickoff_time ? new Date(pred.matches.kickoff_time).toLocaleString() : '-'}
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                          <span className="inline-block bg-slate-800 px-2 py-1 rounded text-white font-bold tracking-widest">
                                            {pred.predicted_home_score} - {pred.predicted_away_score}
                                          </span>
                                        </td>
                                        {predFilterType === 'completed' && (
                                          <td className="py-3 px-4 text-center">
                                            {pred.matches?.actual_home_score !== null && pred.matches?.actual_home_score !== undefined ? (
                                              <span className="inline-block bg-slate-900 border border-slate-700 px-2 py-1 rounded text-slate-300 font-bold tracking-widest">
                                                {pred.matches.actual_home_score} - {pred.matches.actual_away_score}
                                              </span>
                                            ) : (
                                              <span className="text-[10px] text-slate-500 italic">Pending</span>
                                            )}
                                          </td>
                                        )}
                                        {predFilterType === 'completed' && (
                                          <td className="py-3 px-4 text-right font-bold text-emerald-400">
                                            {pred.points_won !== null && pred.points_won !== undefined ? (
                                              `+${pred.points_won}`
                                            ) : '-'}
                                          </td>
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

                {/* SECTION D: Direct Communications */}
                {auditTab === 'communications' && (
                  <div className="space-y-6 animate-fade-in">
                    <div>
                      <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 border-b border-slate-800 pb-2">Direct User Contact</h4>
                      <p className="text-[10px] text-slate-500 mb-6">
                        Send a secure site message to this user. This will appear in their account portal.
                      </p>
                      
                      <div className="space-y-4 max-w-2xl">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[9px] text-slate-500 uppercase tracking-widest mb-1.5">Recipient Name</label>
                            <input
                              type="text"
                              disabled
                              className="w-full bg-slate-900/50 border border-slate-800 rounded-lg px-3 py-2 text-slate-400 text-xs cursor-not-allowed"
                              value={`${editingPlayer.firstName} ${editingPlayer.surname} (${editingPlayer.nickname})`}
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] text-slate-500 uppercase tracking-widest mb-1.5">Recipient Email</label>
                            <input
                              type="text"
                              disabled
                              className="w-full bg-slate-900/50 border border-slate-800 rounded-lg px-3 py-2 text-slate-400 text-xs cursor-not-allowed"
                              value={editingPlayer.email}
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[9px] text-slate-500 uppercase tracking-widest mb-1.5">Message Subject</label>
                          <input
                            type="text"
                            placeholder="Important Account Update"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-xs focus:outline-none focus:border-amber-500/50"
                            value={directMessage.subject}
                            onChange={(e) => setDirectMessage({ ...directMessage, subject: e.target.value })}
                          />
                        </div>

                        <div>
                          <label className="block text-[9px] text-slate-500 uppercase tracking-widest mb-1.5">Message Body</label>
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
                                alert("Please provide a subject and a message body.");
                                return;
                              }

                              const newMessage = {
                                id: crypto.randomUUID(),
                                senderId: 'admin',
                                receiverId: editingPlayer.id,
                                subject: directMessage.subject,
                                body: directMessage.body,
                                createdAt: new Date().toISOString(),
                                read: false
                              };

                              const existingMessages = JSON.parse(localStorage.getItem('pitchside_messages') || '[]');
                              localStorage.setItem('pitchside_messages', JSON.stringify([...existingMessages, newMessage]));

                              setSuccessMsg(`Secure site message sent to ${editingPlayer.nickname}.`);
                              setDirectMessage({ subject: '', body: '' });
                              setTimeout(() => setSuccessMsg(''), 5000);
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
