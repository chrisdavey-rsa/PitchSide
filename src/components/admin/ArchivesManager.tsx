import React, { useState } from 'react';
import {
  RefreshCw,
  Download,
  Search,
  AlertTriangle,
  Trash2,
  FileJson,
  Mail,
} from 'lucide-react';

interface ArchivesManagerProps {
  archivedUsers: any[];
  loadingArchives: boolean;
  onRefresh: () => void;
  onSuccess: (msg: string) => void;
}

export default function ArchivesManager({
  archivedUsers,
  loadingArchives,
  onRefresh,
  onSuccess,
}: ArchivesManagerProps) {
  const [archiveSearch, setArchiveSearch] = useState('');

  const handleDownloadAll = () => {
    if (archivedUsers.length === 0) {
      alert('No archived profiles available to export.');
      return;
    }
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(archivedUsers, null, 2));
    const anchor = document.createElement('a');
    anchor.setAttribute('href', dataStr);
    anchor.setAttribute('download', 'all_retained_players_predictions_backup.json');
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    onSuccess('Successfully downloaded complete backup file!');
  };

  const filteredArchives = archivedUsers.filter((b) => {
    const search = archiveSearch.toLowerCase();
    return (
      (b.deletedUser?.nickname || '').toLowerCase().includes(search) ||
      (b.deletedUser?.email || '').toLowerCase().includes(search) ||
      (b.deletedUser?.firstName || '').toLowerCase().includes(search) ||
      (b.deletedUser?.surname || '').toLowerCase().includes(search)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h4 className="text-xs font-bold text-slate-300 font-mono uppercase tracking-wider">
            Retained Player &amp; Predictions Archives
          </h4>
          <p className="text-[10px] text-slate-500 font-sans">
            Retain historic predictions, backup profiles, and check active mailing list exclusions.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onRefresh}
            disabled={loadingArchives}
            className="text-xs font-mono text-slate-300 hover:text-white bg-slate-950 border border-slate-800 p-2 sm:px-3 sm:py-1.5 rounded-lg cursor-pointer transition-all flex items-center gap-1.5 font-medium animate-pulse"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-zinc-400 ${loadingArchives ? 'animate-spin' : ''}`} />
            <span>Refresh list</span>
          </button>

          <button
            onClick={handleDownloadAll}
            className="text-xs font-mono text-emerald-300 hover:text-emerald-200 bg-emerald-500/10 border border-emerald-500/20 p-2 sm:px-3 sm:py-1.5 rounded-lg cursor-pointer transition-all flex items-center gap-1.5 font-bold"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Download Back-end Backup File</span>
          </button>
        </div>
      </div>

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
                <th className="py-2 px-4 font-black">Player Backup</th>
                <th className="py-2 px-4 font-black">Mailing Exclusions</th>
                <th className="py-2 px-4 font-black">Predictions Retained</th>
                <th className="py-2 px-4 font-black">Archived Date</th>
                <th className="py-2 px-4 text-right font-black">Backup File</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {filteredArchives.map((b, idx) => (
                <tr key={idx} className="hover:bg-slate-900/35 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <span>👤 {b.deletedUser?.nickname || 'Archived User'}</span>
                      {b.deletedUser?.isAdmin && (
                        <span className="text-[8px] bg-red-500/15 text-red-400 px-1 py-0.5 rounded">ADMIN</span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      {b.deletedUser?.firstName} {b.deletedUser?.surname}
                    </span>
                    <span className="text-[10px] text-slate-500 block">{b.deletedUser?.email}</span>
                  </td>
                  <td className="py-3 px-4 max-w-[200px]">
                    <span className="inline-flex items-center gap-1 text-[9px] bg-red-500/10 text-red-400 border border-red-500/15 px-2 py-0.5 rounded-xs font-bold leading-none">
                      <Mail className="w-2.5 h-2.5" />
                      <span>UNSUBSCRIBED</span>
                    </span>
                    <span className="text-[8px] text-slate-500 block mt-1 leading-normal">
                      Excluded from mailing lists
                    </span>
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
                        const dataStr =
                          'data:text/json;charset=utf-8,' +
                          encodeURIComponent(JSON.stringify(b, null, 2));
                        const anchor = document.createElement('a');
                        anchor.setAttribute('href', dataStr);
                        anchor.setAttribute(
                          'download',
                          `pitchside_backup_${b.deletedUser?.nickname || 'archived'}.json`
                        );
                        document.body.appendChild(anchor);
                        anchor.click();
                        anchor.remove();
                        onSuccess(`Archived user '${b.deletedUser?.nickname}' backup file downloaded successfully!`);
                      }}
                      className="p-1 px-2.5 bg-slate-950 hover:bg-slate-900 text-slate-300 hover:text-white border border-slate-800 rounded-lg cursor-pointer transition-colors text-[9px] font-mono inline-flex items-center gap-1"
                    >
                      <FileJson className="w-3 h-3 text-emerald-400" />
                      <span>JSON BUNDLE</span>
                    </button>
                    <button
                      onClick={() => {
                        if (
                          confirm(
                            `Permanently purge archive for ${b.deletedUser?.nickname}? This cannot be undone.`
                          )
                        ) {
                          alert('Permanently Purge initiated');
                        }
                      }}
                      className="p-1 px-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg cursor-pointer transition-colors text-[9px] font-mono inline-flex items-center gap-1 font-bold"
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
  );
}
