import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Calendar,
  Play,
  RefreshCw,
  X,
  Search,
  Eye,
  EyeOff,
} from 'lucide-react';
import { supabase, dbSaveMatch, dbSetMatchVisibility } from '../../supabase';
import { SportType, Match } from '../../types';
import { getCompetitions } from '../../competitions';
import { calculatePoints } from '../../utils';
import { getAvailableSeasons, getLatestSeason } from '../../seasons';

interface FixturesManagerProps {
  initialFixtures: Match[];
  fixtureFilter: 'all' | 'upcoming' | 'completed';
  setFixtureFilter: (f: 'all' | 'upcoming' | 'completed') => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
  onRefresh: () => void;
}

function competitionLabel(fixture: Match): string {
  if (fixture.competitionName?.trim()) return fixture.competitionName.trim();
  const fromCatalog = getCompetitions().find((c) => c.id === fixture.competitionId);
  return fromCatalog?.name ?? fixture.competitionId ?? '';
}

export default function FixturesManager({
  initialFixtures,
  fixtureFilter,
  setFixtureFilter,
  onSuccess,
  onError,
  onRefresh,
}: FixturesManagerProps) {
  const [fixtureSubTab, setFixtureSubTab] = useState<'add' | 'manage'>('manage');

  // Form Fields for Sports Fixtures
  const [sport, setSport] = useState<SportType>(SportType.FOOTBALL);
  const [compSelect, setCompSelect] = useState('f-epl');
  const [homeTeam, setHomeTeam] = useState('');
  const [awayTeam, setAwayTeam] = useState('');
  const [matchDateInput, setMatchDateInput] = useState('');
  const [matchSeason, setMatchSeason] = useState(getLatestSeason);
  const [matchHour, setMatchHour] = useState('15');
  const [matchMinute, setMatchMinute] = useState('00');

  // Score update inputs
  const [scoreInputs, setScoreInputs] = useState<Record<string, { home: string; away: string }>>({});
  const [loadingMatches, setLoadingMatches] = useState<Record<string, boolean>>({});
  const [visibilityBusy, setVisibilityBusy] = useState<Record<string, boolean>>({});

  // Advanced search / filter bar
  const [searchQuery, setSearchQuery] = useState('');
  const [sportFilter, setSportFilter] = useState<'all' | SportType>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Local fixture state (merges DB fixtures with any locally registered ones)
  const [localFixtures] = useState<any[]>(() => {
    const saved = localStorage.getItem('added_fixtures');
    return saved ? JSON.parse(saved) : [];
  });
  const [groupFixtures, setGroupFixtures] = useState<Match[]>(initialFixtures);

  // Sync when parent refreshes
  useEffect(() => {
    setGroupFixtures(initialFixtures);
  }, [initialFixtures]);

  // Auto-align competition dropdown when Sport changes
  useEffect(() => {
    if (sport === SportType.FOOTBALL) {
      setCompSelect('f-epl');
    } else {
      setCompSelect('r-sixnations');
    }
  }, [sport]);

  const allCurrentFixtures = useMemo(() => {
    const seen = new Set<string>();
    const combined: Match[] = [];
    groupFixtures.forEach((f) => {
      combined.push(f);
      seen.add(f.id);
    });
    localFixtures.forEach((f) => {
      if (!seen.has(f.id)) {
        combined.push(f as Match);
        seen.add(f.id);
      }
    });
    combined.sort(
      (a, b) => new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime(),
    );

    const q = searchQuery.trim().toLowerCase();
    const fromTs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const toTs = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null;

    return combined.filter((f) => {
      if (fixtureFilter === 'upcoming' && f.status !== 'upcoming') return false;
      if (fixtureFilter === 'completed' && f.status !== 'completed') return false;
      if (sportFilter !== 'all' && f.sport !== sportFilter) return false;

      const kickoff = new Date(f.matchDate).getTime();
      if (fromTs != null && !Number.isNaN(kickoff) && kickoff < fromTs) return false;
      if (toTs != null && !Number.isNaN(kickoff) && kickoff > toTs) return false;

      if (q) {
        const haystack = [
          f.homeTeam,
          f.awayTeam,
          competitionLabel(f),
          f.id,
          f.sport,
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [
    groupFixtures,
    localFixtures,
    fixtureFilter,
    searchQuery,
    sportFilter,
    dateFrom,
    dateTo,
  ]);

  const hasAdvancedFilters =
    searchQuery.trim() !== '' ||
    sportFilter !== 'all' ||
    dateFrom !== '' ||
    dateTo !== '';

  const clearAdvancedFilters = () => {
    setSearchQuery('');
    setSportFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  const handleToggleVisibility = async (fixture: Match) => {
    const nextVisible = fixture.isVisible === false;
    setVisibilityBusy((prev) => ({ ...prev, [fixture.id]: true }));
    try {
      await dbSetMatchVisibility(fixture.id, nextVisible);
      setGroupFixtures((prev) =>
        prev.map((f) => (f.id === fixture.id ? { ...f, isVisible: nextVisible } : f)),
      );
      onSuccess(
        nextVisible
          ? `${fixture.homeTeam} vs ${fixture.awayTeam} is now visible to players.`
          : `${fixture.homeTeam} vs ${fixture.awayTeam} hidden from player feeds.`,
      );
      onRefresh();
    } catch (err: any) {
      onError(`Failed to update visibility: ${err.message || 'Database error'}`);
    } finally {
      setVisibilityBusy((prev) => ({ ...prev, [fixture.id]: false }));
    }
  };

  const handleAddFixture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!homeTeam.trim() || !awayTeam.trim() || !matchDateInput) {
      onError('Please populate all fields to register this sports fixture.');
      return;
    }

    const randHex = Math.floor(1000 + Math.random() * 9000).toString();
    const prefix = sport === SportType.FOOTBALL ? 'EPL' : 'R6N';
    const fixtureId = `PS-${prefix}-${randHex}`;
    const combinedDateTime = new Date(`${matchDateInput}T${matchHour}:${matchMinute}:00Z`).toISOString();

    const fixtureObj: Match = {
      id: fixtureId,
      sport,
      competitionId: compSelect,
      competitionName: getCompetitions().find((c) => c.id === compSelect)?.name,
      homeTeam: homeTeam.trim(),
      awayTeam: awayTeam.trim(),
      matchDate: combinedDateTime,
      status: 'upcoming' as const,
      season: matchSeason,
      isVisible: true,
    };

    try {
      await dbSaveMatch(fixtureObj);
      setGroupFixtures((prev) => [fixtureObj, ...prev]);
      setHomeTeam('');
      setAwayTeam('');
      setMatchDateInput('');
      setMatchHour('15');
      setMatchMinute('00');
      onSuccess(`🚀 Successfully Registered! Fixture ID: ${fixtureId}`);
      setFixtureSubTab('manage');
    } catch (err: any) {
      console.error('Fixture creation failed:', err);
      onError(`Failed to register fixture: ${err.message || 'Database error'}`);
    }
  };

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

    setLoadingMatches((prev) => ({ ...prev, [fixture.id]: true }));

    try {
      const updatedFixture = { ...fixture, status: 'completed' as const, homeScore, awayScore };
      await dbSaveMatch(updatedFixture);
      setGroupFixtures((prev) => prev.map((f) => (f.id === fixture.id ? updatedFixture : f)));

      if (supabase) {
        const { data: predsData } = await supabase
          .from('predictions')
          .select('*')
          .eq('match_id', fixture.id);

        if (predsData) {
          for (const predRow of predsData) {
            const pointsWon = calculatePoints(
              fixture.sport,
              predRow.predicted_home_score,
              predRow.predicted_away_score,
              homeScore,
              awayScore
            );
            await supabase
              .from('predictions')
              .update({ submitted: true, points_won: pointsWon })
              .eq('id', predRow.id);
          }
        }
      }

      // Update localStorage predictions for sandbox support
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('predictions_')) {
          try {
            const preds = JSON.parse(localStorage.getItem(key) || '{}');
            if (preds[fixture.id]) {
              const pointsWon = calculatePoints(
                fixture.sport,
                preds[fixture.id].home,
                preds[fixture.id].away,
                homeScore,
                awayScore
              );
              const simKey = key.replace('predictions_', 'simulated_');
              const simulated = JSON.parse(localStorage.getItem(simKey) || '{}');
              simulated[fixture.id] = { home: homeScore, away: awayScore, played: true, pointsWon };
              localStorage.setItem(simKey, JSON.stringify(simulated));
              const userId = key.replace('predictions_', '');
              const prev = parseInt(localStorage.getItem(`points_${userId}`) || '0', 10);
              localStorage.setItem(`points_${userId}`, (prev + pointsWon).toString());
            }
          } catch (_) {}
        }
      });

      onSuccess(`🎯 Completed score registration for ${fixture.id}! Points distributed.`);
    } catch (err: any) {
      console.error('Fixture score outcomes write back discrepancy:', err);
      onError(`Failed to update score: ${err.message || 'Database error'}`);
    } finally {
      setLoadingMatches((prev) => ({ ...prev, [fixture.id]: false }));
    }
  };

  const handleSettleMatchweek = async () => {
    if (
      !confirm(
        'Are you sure you want to settle all completed matches? This will recalculate and distribute points for all completed fixtures.'
      )
    ) {
      return;
    }
    onSuccess('Matchweek settlement initiated...');
    try {
      const completedFixtures = groupFixtures.filter((f) => f.status === 'completed');
      let settledCount = 0;
      for (const fixture of completedFixtures) {
        if (fixture.homeScore !== undefined && fixture.awayScore !== undefined) {
          const { data: predsData } = await supabase
            .from('predictions')
            .select('*')
            .eq('match_id', fixture.id);
          if (predsData) {
            for (const predRow of predsData) {
              const pointsWon = calculatePoints(
                fixture.sport,
                predRow.predicted_home_score,
                predRow.predicted_away_score,
                fixture.homeScore,
                fixture.awayScore
              );
              await supabase
                .from('predictions')
                .update({ points_won: pointsWon })
                .eq('id', predRow.id);
            }
          }
          settledCount++;
        }
      }
      onSuccess(`Successfully settled matchweek: processed ${settledCount} fixtures.`);
    } catch (err: any) {
      onError(`Failed to settle matchweek: ${err.message}`);
    }
  };

  return (
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

      {/* SUB-TAB: REGISTER NEW FIXTURE */}
      {fixtureSubTab === 'add' && (
        <div className="bg-slate-950/60 p-5 rounded-xl border border-slate-800 space-y-4 max-w-2xl mx-auto animate-fade-in">
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-emerald-400" /> Catalog New Match Fixture
            </h4>
            <p className="text-[10px] text-slate-500 font-sans mt-0.5">
              Populate scheduled lineup elements, dates, and locations. A PitchSide internal reference ID is automatically
              formatted on submission.
            </p>
          </div>

          <form onSubmit={handleAddFixture} className="space-y-4 text-xs font-mono">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider text-[9px]">
                  Sport Discipline
                </label>
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
                <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider text-[9px]">
                  Competition / League
                </label>
                <select
                  value={compSelect}
                  onChange={(e) => setCompSelect(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-white focus:border-blue-500 focus:outline-hidden"
                >
                  {getCompetitions()
                    .filter((c) => c.sport === sport)
                    .map((comp) => (
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
                  {getAvailableSeasons().map((season) => (
                    <option key={season} value={season}>
                      {season}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-1">
                <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider text-[9px]">
                  Kick-off Date
                </label>
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
                <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider text-[9px]">
                  Hour (24H)
                </label>
                <select
                  value={matchHour}
                  onChange={(e) => setMatchHour(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-white focus:border-blue-500 focus:outline-hidden"
                >
                  {Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0')).map((h) => (
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
                  {Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0')).map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider text-[9px]">
                  Home Team Name
                </label>
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
                <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider text-[9px]">
                  Away Team Name
                </label>
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

      {/* SUB-TAB: MANAGE SCORES */}
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
            <div className="flex flex-wrap gap-2">
              {fixtureFilter !== 'all' && (
                <button
                  onClick={() => setFixtureFilter('all')}
                  className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <X className="w-3 h-3" /> Clear "{fixtureFilter}" Filter
                </button>
              )}
              {hasAdvancedFilters && (
                <button
                  onClick={clearAdvancedFilters}
                  className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <X className="w-3 h-3" /> Clear search filters
                </button>
              )}
            </div>
          </div>

          {/* Advanced search bar */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search teams or competition names…"
                className="w-full bg-slate-900 border border-slate-800 text-slate-100 text-xs pl-9 pr-3 py-2 rounded-lg focus:border-blue-500 focus:outline-hidden"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <select
                value={sportFilter}
                onChange={(e) => setSportFilter(e.target.value as 'all' | SportType)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-300 focus:outline-hidden focus:border-blue-500 font-mono"
              >
                <option value="all">All Sports</option>
                <option value={SportType.FOOTBALL}>Football</option>
                <option value={SportType.RUGBY}>Rugby</option>
              </select>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                aria-label="Kickoff from date"
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-300 focus:outline-hidden focus:border-blue-500 font-mono"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                aria-label="Kickoff to date"
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-300 focus:outline-hidden focus:border-blue-500 font-mono"
              />
            </div>
            <p className="text-[9px] text-slate-600 font-mono">
              Showing {allCurrentFixtures.length} fixture
              {allCurrentFixtures.length === 1 ? '' : 's'}
              {hasAdvancedFilters ? ' matching filters' : ''}
            </p>
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
              {fixtureFilter !== 'all' || hasAdvancedFilters
                ? 'No matches found for the current filters.'
                : 'No sports fixtures currently registered in database memory clusters. Click "Register Game Fixture" above to add some.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {allCurrentFixtures.map((fixture) => {
                const scores = scoreInputs[fixture.id] || { home: '', away: '' };
                const isLoading = !!loadingMatches[fixture.id];
                const isCompleted = fixture.status === 'completed';
                const isVisible = fixture.isVisible !== false;
                const toggling = !!visibilityBusy[fixture.id];

                return (
                  <div
                    key={fixture.id}
                    className={`p-4 rounded-xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all ${
                      !isVisible
                        ? 'bg-slate-950/30 border-slate-800/60 opacity-80'
                        : isCompleted
                          ? 'bg-slate-950/40 border-slate-800/80'
                          : 'bg-slate-950 border-blue-950/40 shadow-xs'
                    }`}
                  >
                    <div className="space-y-1.5 min-w-[280px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded-sm font-mono border border-blue-500/15">
                          {fixture.id}
                        </span>
                        <span className="text-[9px] uppercase font-mono text-slate-500">{fixture.sport}</span>
                        {isCompleted ? (
                          <span className="text-[8px] uppercase font-sans font-bold px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-md">
                            ● Completed
                          </span>
                        ) : (
                          <span className="text-[8px] uppercase font-sans font-bold px-1.5 py-0.5 bg-yellow-500/10 text-yellow-500 rounded-md animate-pulse">
                            ● Upcoming
                          </span>
                        )}
                        {!isVisible && (
                          <span className="text-[8px] uppercase font-sans font-bold px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded-md border border-slate-700">
                            Hidden from players
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
                          <span>
                            {new Date(fixture.matchDate).toLocaleDateString()}{' '}
                            {new Date(fixture.matchDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="text-slate-500">{competitionLabel(fixture)}</div>
                      </div>
                    </div>

                    <div className="w-full md:w-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 self-end md:self-auto border-t md:border-t-0 border-slate-800/60 pt-3 md:pt-0">
                      <label
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer select-none transition-colors ${
                          isVisible
                            ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
                            : 'bg-slate-900 border-slate-700 text-slate-400'
                        } ${toggling ? 'opacity-60 pointer-events-none' : ''}`}
                        title="Opt-out override: hide this fixture from player prediction feeds"
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={isVisible}
                          disabled={toggling}
                          onChange={() => handleToggleVisibility(fixture)}
                        />
                        {isVisible ? (
                          <Eye className="w-3.5 h-3.5 shrink-0" />
                        ) : (
                          <EyeOff className="w-3.5 h-3.5 shrink-0" />
                        )}
                        <span className="text-[9px] font-mono font-bold uppercase tracking-wide whitespace-nowrap">
                          Visible to Players
                        </span>
                        <span
                          className={`relative inline-flex h-4 w-7 shrink-0 rounded-full transition-colors ${
                            isVisible ? 'bg-emerald-500' : 'bg-slate-700'
                          }`}
                          aria-hidden
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white transition-transform ${
                              isVisible ? 'translate-x-3' : 'translate-x-0'
                            }`}
                          />
                        </span>
                      </label>

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
                            disabled={isLoading}
                            onClick={() => handleUpdateScore(fixture)}
                            className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-[10px] font-mono px-3.5 py-2 rounded-lg cursor-pointer transition-colors max-w-[150px] shadow-sm flex items-center justify-center gap-1 uppercase tracking-wide"
                          >
                            {isLoading ? (
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
  );
}
