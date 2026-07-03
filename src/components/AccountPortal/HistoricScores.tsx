import React, { useState, useEffect } from 'react';
import { UserProfile, League } from '../../types';

interface HistoricScoresProps {
  user: UserProfile;
  registeredUsers: UserProfile[];
  realLeagues: League[];
  selectedSeason: '2026' | '2025' | '2024';
  setSelectedSeason: (season: '2026' | '2025' | '2024') => void;
  selectedHistoricLeague: string;
  setSelectedHistoricLeague: (league: string) => void;
}

export const HistoricScores: React.FC<HistoricScoresProps> = ({
  user,
  registeredUsers,
  realLeagues,
  selectedSeason,
  setSelectedSeason,
  selectedHistoricLeague,
  setSelectedHistoricLeague
}) => {
  const [historicalData, setHistoricalData] = useState<any[]>([]);

  useEffect(() => {
    const fetchHistoricalScores = async (season: string) => {
      // Create structural links to the relevant data feeds that will populate this page
      // e.g. const { data } = await supabase.from('historic_scores').select('*').eq('season', season);
      // For now, no data exists
      setHistoricalData([]);
    };

    fetchHistoricalScores(selectedSeason);
  }, [selectedSeason]);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex gap-2.5">
        {(['2026', '2025', '2024'] as const).map((season) => (
          <button
            key={season}
            id={`acc-season-tab-${season}`}
            onClick={() => setSelectedSeason(season)}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold font-mono uppercase border transition-all cursor-pointer ${
              selectedSeason === season
                ? 'bg-blue-600 border-blue-500 text-white shadow-[0_2px_8px_rgba(59,130,246,0.3)]'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            Season {season}
          </button>
        ))}
      </div>

      {historicalData.length > 0 && (
        <div className="mt-8">
          {/* Real data visualizations and leaderboards would go here when feeds are available */}
        </div>
      )}
    </div>
  );
};
