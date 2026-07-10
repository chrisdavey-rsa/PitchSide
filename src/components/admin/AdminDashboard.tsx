import React, { useState, useEffect } from 'react';
import {
  Users,
  Database,
  Calendar,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { supabase } from '../../supabase';

interface AdminDashboardProps {
  onNavigate: (tab: 'players' | 'fixtures' | 'predictions', filter?: 'upcoming' | 'completed' | 'all') => void;
}

export default function AdminDashboard({ onNavigate }: AdminDashboardProps) {
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
          { count: upcomingCount },
          { count: completedCount },
          { data: upcomingMatchIdRows }
        ] = await Promise.all([
          supabase.from('profiles').select('*', { count: 'exact', head: true }),
          supabase.from('matches').select('*', { count: 'exact', head: true }).eq('status', 'upcoming'),
          supabase.from('matches').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
          supabase.from('matches').select('id').eq('status', 'upcoming')
        ]);

        const upcomingIds = (upcomingMatchIdRows || []).map((m: any) => m.id);
        const { count: predictionsCount } = await supabase
          .from('predictions')
          .select('*', { count: 'exact', head: true })
          .in('match_id', upcomingIds.length > 0 ? upcomingIds : ['none'])
          .eq('submitted', true);

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
    return () => { isMounted = false; };
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
        className="bg-slate-900/50 hover:bg-slate-800/80 cursor-pointer border border-slate-800 p-5 rounded-xl space-y-2 relative overflow-hidden group text-left transition-colors"
      >
        <h4 className="text-[10px] font-bold font-mono text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <Users className="w-3.5 h-3.5 text-blue-400" /> Total Players
        </h4>
        <div className="text-3xl font-bold text-white font-mono">{stats.players}</div>
      </button>

      <button
        onClick={() => onNavigate('predictions')}
        className="bg-slate-900/50 hover:bg-slate-800/80 cursor-pointer border border-slate-800 p-5 rounded-xl space-y-2 relative overflow-hidden group text-left transition-colors"
      >
        <h4 className="text-[10px] font-bold font-mono text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <Database className="w-3.5 h-3.5 text-purple-400" /> Predictions Cast
        </h4>
        <div className="text-3xl font-bold text-white font-mono">{stats.predictions}</div>
        <p className="text-[9px] text-slate-500 font-mono">for upcoming matches · click to explore</p>
      </button>

      <button
        onClick={() => onNavigate('fixtures', 'upcoming')}
        className="bg-slate-900/50 hover:bg-slate-800/80 cursor-pointer border border-slate-800 p-5 rounded-xl space-y-2 relative overflow-hidden group text-left transition-colors"
      >
        <h4 className="text-[10px] font-bold font-mono text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-amber-400" /> Upcoming Matches
        </h4>
        <div className="text-3xl font-bold text-white font-mono">{stats.upcomingMatches}</div>
      </button>

      <button
        onClick={() => onNavigate('fixtures', 'completed')}
        className="bg-slate-900/50 hover:bg-slate-800/80 cursor-pointer border border-slate-800 p-5 rounded-xl space-y-2 relative overflow-hidden group text-left transition-colors"
      >
        <h4 className="text-[10px] font-bold font-mono text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Completed Matches
        </h4>
        <div className="text-3xl font-bold text-white font-mono">{stats.completedMatches}</div>
      </button>
    </div>
  );
}
