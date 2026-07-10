import React, { useState } from 'react';
import { Mail, Play } from 'lucide-react';

interface CommunicationsProps {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

export default function Communications({ onSuccess, onError }: CommunicationsProps) {
  const [broadcastTarget, setBroadcastTarget] = useState('All Players');
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');

  const handleDispatchBroadcast = () => {
    if (!broadcastTitle || !broadcastBody) {
      onError('Please complete all message fields.');
      return;
    }
    onSuccess(`Broadcast message "${broadcastTitle}" dispatched to ${broadcastTarget}.`);
    setBroadcastTitle('');
    setBroadcastBody('');
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="bg-slate-950/60 p-5 rounded-xl border border-slate-800 space-y-4 max-w-3xl mx-auto">
        <div>
          <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
            <Mail className="w-4 h-4 text-blue-400" /> Dispatch Broadcast
          </h4>
          <p className="text-[10px] text-slate-500 font-sans mt-0.5">
            Send announcements, updates, or alerts to user segments.
          </p>
        </div>

        <div className="space-y-4 text-xs font-mono">
          <div>
            <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider text-[9px]">
              Target Audience
            </label>
            <select
              value={broadcastTarget}
              onChange={(e) => setBroadcastTarget(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-white focus:border-blue-500 focus:outline-hidden"
            >
              <option value="All Players">All Players</option>
              <option value="Verified Only">Verified Only</option>
              <option value="Admins Only">Admins Only</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider text-[9px]">
              Message Title
            </label>
            <input
              type="text"
              required
              value={broadcastTitle}
              onChange={(e) => setBroadcastTitle(e.target.value)}
              placeholder="e.g. New Matchweek Added!"
              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-white focus:border-blue-500 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider text-[9px]">
              Message Body
            </label>
            <textarea
              required
              value={broadcastBody}
              onChange={(e) => setBroadcastBody(e.target.value)}
              rows={5}
              placeholder="Write your announcement here..."
              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-white focus:border-blue-500 focus:outline-hidden resize-none"
            />
          </div>

          <div className="pt-2 flex justify-end">
            <button
              onClick={handleDispatchBroadcast}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold font-mono uppercase text-xs px-6 py-2.5 rounded-lg cursor-pointer transition-colors shadow-md flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5" /> Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
