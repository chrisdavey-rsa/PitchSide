import React, { useState } from 'react';
import { LifeBuoy, Loader2, Send } from 'lucide-react';
import { UserProfile } from '../../types';
import { supabase } from '../../supabase';

interface ContactSupportProps {
  user: UserProfile;
  setStatusMsg: (msg: { text: string; mode: 'success' | 'error' | 'none' }) => void;
}

export const ContactSupport: React.FC<ContactSupportProps> = ({ user, setStatusMsg }) => {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg({ text: '', mode: 'none' });

    const body = message.trim();
    if (!body) {
      setStatusMsg({ text: 'Please enter a support message.', mode: 'error' });
      return;
    }
    if (!supabase) {
      setStatusMsg({ text: 'Unable to reach support right now.', mode: 'error' });
      return;
    }

    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.access_token) {
        throw new Error('You must be signed in to contact support.');
      }

      const { data, error } = await supabase.functions.invoke('contact-support', {
        body: {
          message: body,
          subject: subject.trim() || 'PitchSide Support Request',
        },
      });

      if (error) throw new Error(error.message || 'Failed to send message');
      if (data?.error) throw new Error(String(data.error));

      setMessage('');
      setSubject('');
      setStatusMsg({
        text: `Thanks ${user.nickname || 'there'} — your message was sent to PitchSide support.`,
        mode: 'success',
      });
    } catch (err: unknown) {
      setStatusMsg({
        text: err instanceof Error ? err.message : 'Failed to send support message.',
        mode: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in text-slate-300">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
          <LifeBuoy className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-sm font-bold font-mono uppercase tracking-wider text-white">
            Contact Support
          </h4>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            Send a message to the PitchSide team. We include your account email and user ID so we can help faster.
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-slate-950/40 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4"
      >
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">
            Subject (optional)
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={120}
            placeholder="e.g. Prediction locked incorrectly"
            className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2.5 px-3 text-sm text-white outline-none"
          />
        </div>
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">
            Message
          </label>
          <textarea
            required
            rows={6}
            maxLength={5000}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Describe the issue or question…"
            className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-3 px-3 text-sm text-white outline-none resize-y min-h-[140px]"
          />
          <p className="mt-1 text-[10px] font-mono text-slate-600 text-right">
            {message.length}/5000
          </p>
        </div>

        <button
          type="submit"
          disabled={loading || !message.trim()}
          className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-mono font-bold text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl cursor-pointer"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Sending…
            </>
          ) : (
            <>
              <Send className="w-4 h-4" /> Send to Support
            </>
          )}
        </button>
      </form>
    </div>
  );
};
