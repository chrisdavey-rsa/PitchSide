import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { SportType } from '../../types';

interface CompetitionsManagerProps {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

export default function CompetitionsManager({ onSuccess, onError }: CompetitionsManagerProps) {
  const [newCompName, setNewCompName] = useState('');
  const [newCompSport, setNewCompSport] = useState<SportType>(SportType.FOOTBALL);
  const [newCompNationality, setNewCompNationality] = useState('Global');
  const [newCompSeason, setNewCompSeason] = useState('2026');

  const handleAddCompetition = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompName.trim()) {
      onError('Please specify a competition name.');
      return;
    }
    const prefix = newCompSport === SportType.FOOTBALL ? 'f-' : 'r-';
    const randHex = Math.random().toString(36).substring(2, 6);
    const compId = `${prefix}${newCompName.toLowerCase().replace(/\s+/g, '')}-${randHex}`;

    import('../../competitions').then(({ addCompetition }) => {
      addCompetition({
        id: compId,
        name: newCompName.trim(),
        sport: newCompSport,
        nationality: newCompNationality,
        season: newCompSeason,
      });
      onSuccess(`🚀 Successfully added Competition: ${newCompName}`);
      setNewCompName('');
    });
  };

  return (
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
              <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider text-[9px]">
                Competition Name
              </label>
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
              <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider text-[9px]">
                Sport Discipline
              </label>
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
              <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider text-[9px]">
                Nationality / Region
              </label>
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
              <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider text-[9px]">
                Season
              </label>
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
  );
}
