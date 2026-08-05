import React, { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { UserProfile } from '../../types';
import { supabase } from '../../supabase';

interface DeleteAccountProps {
  user: UserProfile;
  setStatusMsg: (msg: { text: string; mode: 'success' | 'error' | 'none' }) => void;
  /** Optional — called after successful wipe (parent can clear local state). */
  onDeleted?: () => void;
}

export const DeleteAccount: React.FC<DeleteAccountProps> = ({
  user,
  setStatusMsg,
  onDeleted,
}) => {
  const [chosenDeleteType, setChosenDeleteType] = useState<'none' | 'mailing_only' | 'full_closure'>('none');
  const [confirmText, setConfirmText] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRemoveFromMailingList = async () => {
    setStatusMsg({ text: '', mode: 'none' });
    try {
      const isLocalProfile =
        !supabase || !user?.id || user.id === 'user-admin' || user.id.startsWith('usr_local_');

      if (supabase && !isLocalProfile) {
        const { error } = await supabase
          .from('profiles')
          .update({ email_enabled: false, weekly_email_opt_in: false })
          .eq('id', user.id);
        if (error) throw error;

        const payload = {
          email: user.email.toLowerCase(),
          unsubscribed_at: new Date().toISOString(),
          user_id: user.id,
          nickname: user.nickname,
        };
        await supabase.from('unsubscribed_emails').upsert(payload, { onConflict: 'email' });
      }

      setStatusMsg({
        text: 'Mailing list updated. You will no longer receive automated email digests.',
        mode: 'success',
      });
      setChosenDeleteType('none');
    } catch (err: unknown) {
      setStatusMsg({
        text: err instanceof Error ? err.message : 'Could not update mailing preferences.',
        mode: 'error',
      });
    }
  };

  const runFullDelete = async () => {
    setStatusMsg({ text: '', mode: 'none' });
    if (confirmText.trim() !== 'DELETE') {
      setStatusMsg({ text: 'Type DELETE exactly to confirm.', mode: 'error' });
      return;
    }
    if (!supabase) {
      setStatusMsg({ text: 'Database not connected.', mode: 'error' });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.rpc('delete_user_account');
      if (error) throw error;

      try {
        localStorage.removeItem('pitchside_logged_in');
        localStorage.removeItem(`predictions_${user.id}`);
      } catch {
        /* ignore */
      }

      await supabase.auth.signOut();
      onDeleted?.();

      setStatusMsg({
        text: 'Your account has been deleted. Redirecting…',
        mode: 'success',
      });

      window.setTimeout(() => {
        window.location.assign('/');
      }, 1200);
    } catch (err: unknown) {
      setStatusMsg({
        text: err instanceof Error ? err.message : 'Account deletion failed.',
        mode: 'error',
      });
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in text-slate-300">
      <div className="bg-red-950/20 p-5 rounded-2xl border border-red-500/20 space-y-4">
        <div className="flex items-center gap-2.5 text-red-400">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <h4 className="text-sm font-bold font-mono uppercase tracking-wider">
            Warning: Account Exclusion Notice
          </h4>
        </div>

        <div className="space-y-2 text-xs text-slate-300 leading-relaxed font-sans">
          <p className="font-semibold text-slate-200">By continuing, you can erase account data.</p>
          <ul className="list-disc pl-5 mt-1.5 space-y-1">
            <li>Full closure deletes predictions, push subscriptions, profile, and login credentials.</li>
            <li>This cannot be undone.</li>
          </ul>
        </div>

        {chosenDeleteType === 'none' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setChosenDeleteType('mailing_only');
                setStatusMsg({ text: '', mode: 'none' });
              }}
              className="p-4 bg-slate-900/60 hover:bg-slate-850 border border-slate-800 hover:border-emerald-500/20 rounded-xl text-left transition-all cursor-pointer"
            >
              <span className="block font-mono font-bold text-[11px] text-emerald-400 uppercase tracking-wider mb-1">
                Option A
              </span>
              <span className="block font-sans font-semibold text-slate-200 text-xs">
                Remove from Mailing List
              </span>
              <span className="block font-sans text-[10px] text-slate-500 mt-1 leading-relaxed">
                Keep your account; stop weekly email digests.
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setChosenDeleteType('full_closure');
                setStatusMsg({ text: '', mode: 'none' });
              }}
              className="p-4 bg-slate-900/60 hover:bg-slate-850 border border-slate-800 hover:border-red-500/25 rounded-xl text-left transition-all cursor-pointer"
            >
              <span className="block font-mono font-bold text-[11px] text-red-400 uppercase tracking-wider mb-1">
                Option B
              </span>
              <span className="block font-sans font-semibold text-xs text-red-400">
                Delete Account
              </span>
              <span className="block font-sans text-[10px] text-slate-400 mt-1 leading-relaxed">
                Irreversible purge of your PitchSide account.
              </span>
            </button>
          </div>
        )}
      </div>

      {chosenDeleteType === 'mailing_only' && (
        <div className="bg-slate-950/30 p-5 rounded-2xl border border-slate-800 space-y-4">
          <p className="text-xs text-slate-400 leading-relaxed">
            Confirm to disable weekly emails for <strong className="text-white">{user.email}</strong>.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setChosenDeleteType('none')}
              className="flex-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 font-mono text-xs py-2.5 rounded-xl cursor-pointer"
            >
              Go Back
            </button>
            <button
              type="button"
              onClick={handleRemoveFromMailingList}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-xs py-2.5 rounded-xl cursor-pointer"
            >
              Confirm Mailing List Exclusion
            </button>
          </div>
        </div>
      )}

      {chosenDeleteType === 'full_closure' && (
        <div className="bg-slate-950/30 p-5 rounded-2xl border border-red-500/20 space-y-4">
          <p className="text-xs text-slate-400 leading-relaxed">
            This permanently deletes your account via <code className="text-red-300">delete_user_account()</code>.
            You will be signed out and returned to the landing page.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setChosenDeleteType('none');
                setConfirmText('');
                setShowModal(false);
              }}
              className="flex-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 font-mono text-xs py-2.5 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-mono font-bold text-xs py-2.5 rounded-xl cursor-pointer"
            >
              Delete Account
            </button>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
            className="w-full max-w-md rounded-2xl border border-red-500/30 bg-slate-900 p-5 shadow-2xl space-y-4"
          >
            <h5 id="delete-account-title" className="text-sm font-bold text-red-300 uppercase tracking-wider font-mono">
              Confirm permanent deletion
            </h5>
            <p className="text-xs text-slate-400 leading-relaxed">
              Type <span className="text-white font-bold">DELETE</span> to permanently erase your account.
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              autoFocus
              className="w-full bg-slate-950 border border-slate-700 focus:border-red-500 rounded-xl py-2.5 px-3 text-sm text-white outline-none font-mono tracking-widest"
            />
            <div className="flex gap-3">
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  setShowModal(false);
                  setConfirmText('');
                }}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs py-2.5 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loading || confirmText.trim() !== 'DELETE'}
                onClick={runFullDelete}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-mono font-bold text-xs py-2.5 rounded-xl cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Deleting…
                  </>
                ) : (
                  'Confirm Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
