import React, { useState, useEffect } from 'react';
import { UserProfile, League } from '../../types';
import { getAvailableSeasons } from '../../seasons';

interface HistoricScoresProps {
  user: UserProfile;
  registeredUsers: UserProfile[];
  realLeagues: League[];
  selectedSeason: string;
  setSelectedSeason: (season: string) => void;
  selectedHistoricLeague: string;
  setSelectedHistoricLeague: (league: string) => void;
}

export const HistoricScores: React.FC<HistoricScoresProps> = ({
  selectedSeason,
  setSelectedSeason,
}) => {
  const [historicalData, setHistoricalData] = useState<any[]>([]);
  const seasons = getAvailableSeasons();
  const multiSeason = seasons.length > 1;

  useEffect(() => {
    const fetchHistoricalScores = async (_season: string) => {
      // Structural hook for historic feeds — no archived rows yet.
      setHistoricalData([]);
    };

    void fetchHistoricalScores(selectedSeason);
  }, [selectedSeason]);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800 flex flex-col gap-2.5">
        <span className="text-[10px] font-bold text-slate-400 font-mono uppercase tracking-widest text-center block">
          {multiSeason ? 'Seasons' : 'Season'}
        </span>
        <div
          role="tablist"
          aria-label="Historic score seasons"
          className={`flex flex-row gap-2 ${multiSeason ? 'flex-wrap sm:flex-nowrap' : ''}`}
        >
          {seasons.map((season) => {
            const isActive = selectedSeason === season;
            return (
              <button
                key={season}
                id={`acc-season-tab-${season}`}
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
      </div>

      {historicalData.length > 0 && (
        <div className="mt-8">
          {/* Real data visualizations and leaderboards would go here when feeds are available */}
        </div>
      )}
    </div>
  );
};
