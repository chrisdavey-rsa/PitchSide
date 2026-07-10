import React, { useState } from 'react';
import { Users, RefreshCw, X } from 'lucide-react';
import { UserProfile, League } from '../../types';

interface AdminLeagueManagerProps {
  leagues: League[];
  loadingLeagues: boolean;
  registeredUsers: UserProfile[];
  onSuccess: (msg: string) => void;
}

export default function AdminLeagueManager({
  leagues,
  loadingLeagues,
  registeredUsers,
  onSuccess,
}: AdminLeagueManagerProps) {
  const [viewingLeague, setViewingLeague] = useState<League | null>(null);

  const handleTransferLeague = (leagueId: string, leagueName: string) => {
    if (window.confirm(`Transfer ownership of league "${leagueName}"?`)) {
      onSuccess(`Transfer ownership initiated for ${leagueName}.`);
    }
  };

  const handleDeleteLeague = (leagueId: string, leagueName: string) => {
    if (window.confirm(`Permanently delete league "${leagueName}"?`)) {
      onSuccess(`Delete initiated for ${leagueName}.`);
    }
  };

  return (
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
        ) : leagues.length === 0 ? (
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
              {leagues.map((league) => (
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
                    <label className="block text-[9px] text-slate-500 uppercase tracking-widest mb-1.5">
                      League Name
                    </label>
                    <div className="text-white font-bold bg-slate-950/50 px-3 py-2 border border-slate-800 rounded-lg">
                      {viewingLeague.name}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[9px] text-slate-500 uppercase tracking-widest mb-1.5">
                      Join Code
                    </label>
                    <div className="text-white font-bold bg-slate-950/50 px-3 py-2 border border-slate-800 rounded-lg tracking-widest">
                      {viewingLeague.id}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[9px] text-slate-500 uppercase tracking-widest mb-1.5">
                      Creator
                    </label>
                    <div className="text-slate-300 bg-slate-950/50 px-3 py-2 border border-slate-800 rounded-lg">
                      {viewingLeague.creatorName || 'Unknown'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[9px] text-slate-500 uppercase tracking-widest mb-1.5">
                      Created At
                    </label>
                    <div className="text-slate-300 bg-slate-950/50 px-3 py-2 border border-slate-800 rounded-lg text-xs">
                      {new Date(viewingLeague.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] text-slate-500 uppercase tracking-widest mb-1.5">
                    Members ({viewingLeague.members?.length || 0})
                  </label>
                  <div className="bg-slate-950/50 border border-slate-800 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                    {viewingLeague.members && viewingLeague.members.length > 0 ? (
                      <ul className="divide-y divide-slate-800/50 text-xs">
                        {viewingLeague.members.map((member, i) => {
                          const user = registeredUsers.find((u) => u.id === member);
                          return (
                            <li key={i} className="px-3 py-2 text-slate-300">
                              {user ? user.nickname : 'Unknown User'}
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <div className="px-3 py-4 text-center text-slate-500 text-xs">
                        No members found.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
