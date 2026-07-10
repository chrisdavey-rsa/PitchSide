import React, { useState, useEffect } from 'react';
import { RefreshCw, Search, X } from 'lucide-react';
import { supabase } from '../../supabase';

export default function PredictionsViewer() {
  const [view, setView] = useState<'upcoming' | 'historical'>('upcoming');
  const [predictions, setPredictions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPrediction, setSelectedPrediction] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchPredictions = async (statusFilter: 'upcoming' | 'historical') => {
    setLoading(true);
    try {
      const matchStatus = statusFilter === 'upcoming' ? 'upcoming' : 'completed';
      const { data: matchRows } = await supabase
        .from('matches')
        .select('id')
        .eq('status', matchStatus);

      const ids = (matchRows || []).map((m: any) => m.id);
      if (ids.length === 0) {
        setPredictions([]);
        setLoading(false);
        return;
      }

      let query = supabase
        .from('predictions')
        .select(`
          id,
          match_id,
          user_id,
          predicted_home_score,
          predicted_away_score,
          points_won,
          created_at,
          submitted,
          matches:match_id (
            id, home_team, away_team, kickoff_time,
            actual_home_score, actual_away_score,
            status, sport
          ),
          profiles:user_id (
            id, username, first_name, surname
          )
        `)
        .in('match_id', ids)
        .order('created_at', { ascending: false });

      if (statusFilter === 'upcoming') {
        query = query.eq('submitted', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      setPredictions(data || []);
    } catch (err: any) {
      console.error('Failed to fetch site-wide predictions:', err);
      setPredictions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPredictions(view);
  }, [view]);

  const filtered = predictions.filter((p) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    const username = ((p.profiles as any)?.username || '').toLowerCase();
    const firstName = ((p.profiles as any)?.first_name || '').toLowerCase();
    const home = ((p.matches as any)?.home_team || '').toLowerCase();
    const away = ((p.matches as any)?.away_team || '').toLowerCase();
    return username.includes(q) || firstName.includes(q) || home.includes(q) || away.includes(q);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h4 className="text-xs font-bold text-slate-300 font-mono uppercase tracking-wider">
            Site-wide Predictions
          </h4>
          <p className="text-[10px] text-slate-500">
            {view === 'upcoming'
              ? 'All submitted predictions for upcoming fixtures.'
              : 'Historical predictions with results & points.'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setView('upcoming')}
            className={`text-xs font-mono px-3 py-1.5 rounded-lg border cursor-pointer transition-all ${
              view === 'upcoming'
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 font-bold'
                : 'border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Upcoming
          </button>
          <button
            onClick={() => setView('historical')}
            className={`text-xs font-mono px-3 py-1.5 rounded-lg border cursor-pointer transition-all ${
              view === 'historical'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-bold'
                : 'border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Historical
          </button>
          <button
            onClick={() => fetchPredictions(view)}
            className="p-1 px-2.5 bg-slate-950 hover:bg-slate-850 text-slate-400 hover:text-white rounded-md border border-slate-800 text-[10px] font-mono cursor-pointer transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
        <input
          type="text"
          placeholder="Search by player, home team or away team..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-slate-950/80 border border-slate-800 text-slate-100 text-xs pl-9 pr-4 py-2 rounded-xl focus:border-purple-500 focus:outline-none transition-colors"
        />
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-32 text-slate-400 text-xs font-mono">
          <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading predictions...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-xs text-slate-500 font-mono bg-slate-950 rounded-xl border border-slate-800">
          No {view} predictions found.
        </div>
      ) : (
        <div className="bg-slate-950 rounded-xl border border-slate-800/80 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="bg-slate-900/80 border-b border-slate-800 text-slate-500 text-[9px] uppercase tracking-wider">
                  <th className="py-3 px-4">Player</th>
                  <th className="py-3 px-4">Match</th>
                  <th className="py-3 px-4 text-center">Prediction</th>
                  <th className="py-3 px-4 text-center">Kickoff</th>
                  <th className="py-3 px-4 text-center">Submitted</th>
                  {view === 'historical' && (
                    <>
                      <th className="py-3 px-4 text-center">Result</th>
                      <th className="py-3 px-4 text-center">Pts</th>
                    </>
                  )}
                  <th className="py-3 px-4 text-right">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {filtered.map((pred) => {
                  const match = (pred.matches as any) || {};
                  const profile = (pred.profiles as any) || {};
                  const kickoff = match.kickoff_time ? new Date(match.kickoff_time) : null;
                  const createdAt = pred.created_at ? new Date(pred.created_at) : null;
                  return (
                    <tr
                      key={pred.id}
                      className="hover:bg-slate-900/30 cursor-pointer transition-colors"
                      onClick={() => setSelectedPrediction(pred)}
                    >
                      <td className="py-3 px-4">
                        <span className="font-bold text-white text-[11px]">
                          {profile.username || 'Unknown'}
                        </span>
                        {(profile.first_name || profile.surname) && (
                          <span className="text-slate-500 text-[10px] block">
                            {profile.first_name} {profile.surname}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-slate-200 text-[11px]">
                          {match.home_team} vs {match.away_team}
                        </span>
                        <span className="text-slate-500 text-[10px] block uppercase">
                          {match.sport}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-bold text-purple-300 text-sm">
                          {pred.predicted_home_score} – {pred.predicted_away_score}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center text-slate-400 text-[10px]">
                        {kickoff ? (
                          <>
                            <span className="block">{kickoff.toLocaleDateString('en-GB')}</span>
                            <span>{kickoff.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                          </>
                        ) : '—'}
                      </td>
                      <td className="py-3 px-4 text-center text-slate-400 text-[10px]">
                        {createdAt ? (
                          <>
                            <span className="block">{createdAt.toLocaleDateString('en-GB')}</span>
                            <span>{createdAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                          </>
                        ) : '—'}
                      </td>
                      {view === 'historical' && (
                        <>
                          <td className="py-3 px-4 text-center">
                            {match.actual_home_score !== null && match.actual_home_score !== undefined ? (
                              <span className="font-bold text-emerald-400">
                                {match.actual_home_score} – {match.actual_away_score}
                              </span>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`font-bold text-sm ${(pred.points_won || 0) > 0 ? 'text-yellow-400' : 'text-slate-500'}`}>
                              {pred.points_won ?? '—'}
                            </span>
                          </td>
                        </>
                      )}
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedPrediction(pred); }}
                          className="text-[10px] font-mono text-purple-400 hover:text-purple-300 border border-purple-500/20 hover:border-purple-500/40 px-2 py-0.5 rounded transition-colors cursor-pointer"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2.5 border-t border-slate-800 bg-slate-900/40 text-[10px] text-slate-500 font-mono">
            {filtered.length} prediction{filtered.length !== 1 ? 's' : ''}{searchTerm ? ' matched' : ' total'}
          </div>
        </div>
      )}

      {selectedPrediction && (
        <div
          className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedPrediction(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold font-mono text-white uppercase tracking-wider">
                Prediction Detail
              </h4>
              <button onClick={() => setSelectedPrediction(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {(() => {
              const p = selectedPrediction;
              const match = (p.matches as any) || {};
              const profile = (p.profiles as any) || {};
              const kickoff = match.kickoff_time ? new Date(match.kickoff_time) : null;
              const createdAt = p.created_at ? new Date(p.created_at) : null;
              return (
                <div className="space-y-3">
                  <div className="bg-slate-950 rounded-xl p-4 space-y-1">
                    <div className="text-[9px] text-slate-500 font-mono uppercase tracking-widest mb-1">Player</div>
                    <div className="font-bold text-white text-base">{profile.username || 'Unknown'}</div>
                    {(profile.first_name || profile.surname) && (
                      <div className="text-xs text-slate-400">{profile.first_name} {profile.surname}</div>
                    )}
                    <div className="text-[10px] text-slate-600 font-mono truncate">{p.user_id}</div>
                  </div>

                  <div className="bg-slate-950 rounded-xl p-4 space-y-1">
                    <div className="text-[9px] text-slate-500 font-mono uppercase tracking-widest mb-1">Match</div>
                    <div className="font-bold text-white">{match.home_team} vs {match.away_team}</div>
                    <div className="text-xs text-slate-400 uppercase">{match.sport}</div>
                    {kickoff && (
                      <div className="text-xs text-slate-400">
                        Kickoff: {kickoff.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                      </div>
                    )}
                  </div>

                  <div className="bg-slate-950 rounded-xl p-4 space-y-1">
                    <div className="text-[9px] text-slate-500 font-mono uppercase tracking-widest mb-1">Prediction</div>
                    <div className="text-2xl font-black font-mono text-purple-300 text-center py-1">
                      {p.predicted_home_score} – {p.predicted_away_score}
                    </div>
                    {createdAt && (
                      <div className="text-[10px] text-slate-500 text-center">
                        Submitted: {createdAt.toLocaleString('en-GB')}
                      </div>
                    )}
                  </div>

                  {match.status === 'completed' && (
                    <div className="bg-slate-950 rounded-xl p-4">
                      <div className="text-[9px] text-slate-500 font-mono uppercase tracking-widest mb-2">Outcome</div>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-[10px] text-slate-500 mb-0.5">Actual Result</div>
                          <div className="text-xl font-black font-mono text-emerald-400">
                            {match.actual_home_score !== null ? `${match.actual_home_score} – ${match.actual_away_score}` : '—'}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] text-slate-500 mb-0.5">Points Awarded</div>
                          <div className={`text-3xl font-black font-mono ${(p.points_won || 0) > 0 ? 'text-yellow-400' : 'text-slate-600'}`}>
                            {p.points_won ?? 0}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="text-[10px] text-slate-700 font-mono text-center">ID: {p.id}</div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
