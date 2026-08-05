/**
 * Admin Broadcast — ad-hoc push + email to opted-in players.
 * Only render when the signed-in profile has is_admin / isAdmin === true.
 */
import React, { useState } from 'react';
import { Megaphone, Loader2, Send } from 'lucide-react';
import { supabase } from '../supabase';

export interface AdminDashboardPageProps {
  /** Must be true — parent should gate rendering. */
  isAdmin: boolean;
}

export default function AdminDashboardPage({ isAdmin }: AdminDashboardPageProps) {
  const [message, setMessage] = useState('');
  const [subject, setSubject] = useState('PitchSide Update');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isAdmin) {
    return (
      <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-6 text-rose-300 text-sm">
        Admin access required.
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    const body = message.trim();
    if (!body) {
      setError('Enter a message to broadcast.');
      return;
    }
    if (!supabase) {
      setError('Supabase is not configured.');
      return;
    }

    setLoading(true);
    try {
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr || !sessionData.session?.access_token) {
        throw new Error('You must be signed in as an admin.');
      }

      const { data, error: fnErr } = await supabase.functions.invoke('admin-broadcast', {
        body: { message: body, subject: subject.trim() || 'PitchSide Update' },
      });

      if (fnErr) throw new Error(fnErr.message || 'Broadcast failed');
      if (data?.error) throw new Error(String(data.error));

      const push = data?.push;
      const email = data?.email;
      setResult(
        `Broadcast sent. Push: ${push?.sent ?? 0} ok / ${push?.failed ?? 0} failed. Email: ${email?.sent ?? 0} ok / ${email?.failed ?? 0} failed.`,
      );
      setMessage('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-300">
          <Megaphone className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm font-bold font-display text-white uppercase tracking-wider">
            Admin Broadcast
          </h3>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            Send an ad-hoc message to players with push and/or weekly email enabled.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">
            Subject
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={120}
            className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl py-2.5 px-3 text-sm text-white outline-none"
          />
        </div>
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">
            Message body
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            rows={6}
            maxLength={4000}
            placeholder="Write the announcement players will receive…"
            className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl py-3 px-3 text-sm text-white outline-none resize-y min-h-[140px]"
          />
          <p className="mt-1 text-[10px] font-mono text-slate-600 text-right">
            {message.length}/4000
          </p>
        </div>

        {error && (
          <p className="text-xs text-rose-400 bg-rose-950/30 border border-rose-500/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        {result && (
          <p className="text-xs text-emerald-400 bg-emerald-950/30 border border-emerald-500/20 rounded-lg px-3 py-2">
            {result}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !message.trim()}
          className="inline-flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-mono font-bold text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl cursor-pointer"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Sending…
            </>
          ) : (
            <>
              <Send className="w-4 h-4" /> Send Broadcast
            </>
          )}
        </button>
      </form>
    </div>
  );
}
