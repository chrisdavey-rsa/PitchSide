import React from 'react';
import { ChevronRight, Trophy } from 'lucide-react';
import { League, Competition } from '../../types';

interface MyLeaguesProps {
  userLeagues: League[];
  selectedSeason: '2026' | '2025' | '2024';
  setSelectedSeason: (season: '2026' | '2025' | '2024') => void;
  getCompetitions: () => Competition[];
  onSelectLeague?: (leagueId: string) => void;
}

export const MyLeagues: React.FC<MyLeaguesProps> = ({ userLeagues, selectedSeason, setSelectedSeason, getCompetitions, onSelectLeague }) => {
  return (
    <div className="space-y-5 animate-fade-in">
      <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800 flex flex-col gap-2">
        <span className="text-[10px] font-bold text-slate-400 font-mono uppercase tracking-widest text-center block">Season</span>
        <div className="flex gap-2.5">
          {(['2026', '2025', '2024'] as const).map((season) => (
            <button
              key={`league-season-${season}`}
              onClick={() => setSelectedSeason(season)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold font-mono uppercase border transition-all cursor-pointer ${
                selectedSeason === season
                  ? 'bg-blue-600 border-blue-500 text-white shadow-[0_2px_8px_rgba(59,130,246,0.3)]'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              {season}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {(['FOOTBALL', 'RUGBY'] as const).map(sport => {
          const filteredLeagues = userLeagues.filter(l => {
             const comp = getCompetitions().find(c => c.id === l.competitionId);
             const lSeason = comp?.season || l.season || l.createdAt.substring(0, 4);
             if (lSeason !== selectedSeason) return false;
             return comp?.sport?.toUpperCase() === sport.toUpperCase();
          });

          if (filteredLeagues.length === 0) return null;

          return (
            <div key={`sport-leagues-${sport}`} className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
              <div className="bg-slate-950 px-4 py-2 border-b border-slate-800 flex items-center gap-2">
                <span className="text-sm">{sport === 'FOOTBALL' ? '⚽' : '🏉'}</span>
                <span className="text-[10px] font-bold font-mono tracking-widest text-emerald-400 uppercase">
                  {sport} Leagues
                </span>
              </div>
              <div className="divide-y divide-slate-800/60">
                {filteredLeagues.map(l => {
                  const comp = getCompetitions().find(c => c.id === l.competitionId);
                  return (
                    <button 
                      key={l.id} 
                      onClick={() => {
                        if (onSelectLeague) onSelectLeague(l.id);
                      }}
                      className="w-full text-left p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-800/60 cursor-pointer transition-colors group"
                    >
                      <div>
                        <h5 className="font-bold text-sm text-white group-hover:text-emerald-400 transition-colors">{l.name}</h5>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-slate-400 font-mono group-hover:text-slate-300">
                            {comp ? comp.name : 'Multi-Tournament'}
                          </span>
                          {l.isPublic ? (
                            <span className="text-[8px] font-mono bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded uppercase">Public</span>
                          ) : (
                            <span className="text-[8px] font-mono bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded uppercase">Private</span>
                          )}
                        </div>
                      </div>
                      <div className="text-left sm:text-right flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
                        <div>
                          <span className="text-[10px] text-slate-500 font-mono uppercase block">
                            Code: <span className="text-emerald-400">{l.id}</span>
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono uppercase block mt-0.5">
                            Members: {l.members?.length || 1}
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

        {!userLeagues.some(l => {
           const comp = getCompetitions().find(c => c.id === l.competitionId);
           const season = comp?.season || l.season || l.createdAt.substring(0, 4);
           return season === selectedSeason;
        }) && (
          <div className="text-center py-8 bg-slate-900/30 rounded-xl border border-slate-800 border-dashed">
            <Trophy className="w-8 h-8 text-slate-600 mx-auto mb-3 opacity-50" />
            <p className="text-xs text-slate-500 font-mono">No registered leagues for {selectedSeason}.</p>
          </div>
        )}
      </div>
    </div>
  );
};
