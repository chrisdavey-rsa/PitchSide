import React, { useMemo, useState } from 'react';
import { ChevronRight, Lock, Trophy, ChevronUp, ChevronDown } from 'lucide-react';
import { League, Competition } from '../../types';
import { getAvailableSeasons } from '../../seasons';
import { sortLeagues, type LeagueSortKey, type LeagueSortDir } from '../../leagues';

interface MyLeaguesProps {
  userLeagues: League[];
  selectedSeason: string;
  setSelectedSeason: (season: string) => void;
  getCompetitions: () => Competition[];
  onSelectLeague?: (leagueId: string) => void;
}

function leagueSeasonOf(
  league: League,
  getCompetitions: () => Competition[],
): string {
  const comp = getCompetitions().find((c) => c.id === league.competitionId);
  return comp?.season || league.season || league.createdAt.substring(0, 4);
}

export const MyLeagues: React.FC<MyLeaguesProps> = ({
  userLeagues,
  selectedSeason,
  setSelectedSeason,
  getCompetitions,
  onSelectLeague,
}) => {
  const seasons = getAvailableSeasons();
  const multiSeason = seasons.length > 1;
  const [sortKey, setSortKey] = useState<LeagueSortKey>('name');
  const [sortDir, setSortDir] = useState<LeagueSortDir>('asc');

  const toggleSort = (key: LeagueSortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'members' ? 'desc' : 'asc');
    }
  };

  const SortHint = ({ active }: { active: boolean }) =>
    active ? (
      sortDir === 'asc' ? (
        <ChevronUp className="w-3 h-3 inline-block" />
      ) : (
        <ChevronDown className="w-3 h-3 inline-block" />
      )
    ) : null;

  const sortedBySport = useMemo(() => {
    return (['FOOTBALL', 'RUGBY'] as const).map((sport) => {
      const filtered = userLeagues.filter((l) => {
        const comp = getCompetitions().find((c) => c.id === l.competitionId);
        const lSeason = leagueSeasonOf(l, getCompetitions);
        if (lSeason !== selectedSeason) return false;
        return comp?.sport?.toUpperCase() === sport.toUpperCase();
      });
      return {
        sport,
        leagues: sortLeagues(filtered, sortKey, sortDir),
      };
    });
  }, [userLeagues, selectedSeason, getCompetitions, sortKey, sortDir]);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800 flex flex-col gap-2.5">
        <span className="text-[10px] font-bold text-slate-400 font-mono uppercase tracking-widest text-center block">
          {multiSeason ? 'Seasons' : 'Season'}
        </span>
        <div
          role="tablist"
          aria-label="League seasons"
          className={`flex flex-row gap-2 ${multiSeason ? 'flex-wrap sm:flex-nowrap' : ''}`}
        >
          {seasons.map((season) => {
            const isActive = selectedSeason === season;
            return (
              <button
                key={`league-season-${season}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setSelectedSeason(season)}
                className={`flex-1 min-w-[4.5rem] py-2.5 px-3 rounded-xl text-xs font-bold font-mono uppercase border transition-all cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 border-blue-500 text-white shadow-[0_2px_8px_rgba(59,130,246,0.3)]'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {season}
              </button>
            );
          })}
        </div>
        {multiSeason && (
          <p className="text-[10px] text-slate-500 font-sans text-center leading-relaxed">
            Switch seasons side-by-side to review historic league memberships.
          </p>
        )}
      </div>

      {/* Sort controls */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500 mr-1">
          Sort by
        </span>
        {(
          [
            { key: 'name' as const, label: 'Name' },
            { key: 'members' as const, label: 'Members' },
            { key: 'privacy' as const, label: 'Privacy' },
          ] as const
        ).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => toggleSort(key)}
            className={`text-[10px] font-mono px-2.5 py-1.5 rounded-lg border cursor-pointer transition-colors inline-flex items-center gap-0.5 ${
              sortKey === key
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-bold'
                : 'border-slate-800 text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            {label}
            <SortHint active={sortKey === key} />
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {sortedBySport.map(({ sport, leagues: filteredLeagues }) => {
          if (filteredLeagues.length === 0) return null;

          return (
            <div
              key={`sport-leagues-${sport}`}
              className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden"
            >
              <div className="bg-slate-950 px-4 py-2 border-b border-slate-800 flex items-center gap-2">
                <span className="text-sm">{sport === 'FOOTBALL' ? '⚽' : '🏉'}</span>
                <span className="text-[10px] font-bold font-mono tracking-widest text-emerald-400 uppercase">
                  {sport} Leagues
                </span>
              </div>
              <div className="divide-y divide-slate-800/60">
                {filteredLeagues.map((l) => {
                  const comp = getCompetitions().find((c) => c.id === l.competitionId);
                  return (
                    <button
                      key={l.id}
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onSelectLeague?.(l.id);
                      }}
                      className="w-full text-left p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-800/60 cursor-pointer transition-colors group"
                    >
                      <div>
                        <h5 className="font-bold text-sm text-white group-hover:text-emerald-400 transition-colors inline-flex items-center gap-1.5">
                          {(l.isPrivate || l.isPublic === false) && (
                            <Lock
                              className="w-3.5 h-3.5 text-slate-400 shrink-0"
                              strokeWidth={1.75}
                              aria-label="Private league"
                            />
                          )}
                          <span>{l.name}</span>
                        </h5>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-slate-400 font-mono group-hover:text-slate-300">
                            {comp ? comp.name : 'Multi-Tournament'}
                          </span>
                          {l.isPrivate || l.isPublic === false ? (
                            <span className="text-[8px] font-mono bg-slate-800 text-slate-400 border border-slate-700 px-1.5 py-0.5 rounded uppercase inline-flex items-center gap-1">
                              Private
                            </span>
                          ) : (
                            <span className="text-[8px] font-mono bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded uppercase">
                              Public
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-left sm:text-right flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
                        <div>
                          <span className="text-[10px] text-slate-500 font-mono uppercase block">
                            Code: <span className="text-emerald-400">{l.id}</span>
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono uppercase block mt-0.5">
                            Members: {l.members?.length ?? 0}
                          </span>
                        </div>
                        <div className="text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity">
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {!userLeagues.some((l) => leagueSeasonOf(l, getCompetitions) === selectedSeason) && (
          <div className="text-center py-8 bg-slate-900/30 rounded-xl border border-slate-800 border-dashed">
            <Trophy className="w-8 h-8 text-slate-600 mx-auto mb-3 opacity-50" />
            <p className="text-xs text-slate-500 font-mono">
              No registered leagues for {selectedSeason}.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
