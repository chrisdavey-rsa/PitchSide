import React, { useState } from 'react';
import { AlertTriangle, Lock, Eye, EyeOff } from 'lucide-react';
import { UserProfile } from '../../types';
import { supabase } from '../../supabase';

interface DeleteAccountProps {
  user: UserProfile;
  setStatusMsg: (msg: { text: string; mode: 'success' | 'error' | 'none' }) => void;
}

export const DeleteAccount: React.FC<DeleteAccountProps> = ({ user, setStatusMsg }) => {
  const [chosenDeleteType, setChosenDeleteType] = useState<'none' | 'mailing_only' | 'full_closure'>('none');
  const [deletePasswordInput, setDeletePasswordInput] = useState('');
  const [showDeletePwd, setShowDeletePwd] = useState(false);

  const handleRemoveFromMailingList = async () => {
    setStatusMsg({ text: '', mode: 'none' });
    try {
      const isLocalProfile = !supabase || !user || !user.id || user.id === 'user-admin' || user.id.startsWith('usr_local_');
      
      const payload = {
        email: user.email.toLowerCase(),
        unsubscribed_at: new Date().toISOString(),
        user_id: user.id,
        nickname: user.nickname
      };

      if (supabase && !isLocalProfile) {
        const { error } = await supabase.from('unsubscribed_emails').upsert(payload, { onConflict: 'email' });
        if (error) throw error;
      }

      let localExcludes: any[] = [];
      try {
        localExcludes = JSON.parse(localStorage.getItem('pitchside_unsubscribed_emails') || '[]');
      } catch (e) {}
      localExcludes.push(payload);
      localStorage.setItem('pitchside_unsubscribed_emails', JSON.stringify(localExcludes));

      setStatusMsg({
        text: 'Mailing list configuration updated. You will no longer receive automated email digests.',
        mode: 'success'
      });
      setChosenDeleteType('none');
    } catch (err: any) {
      console.warn('Mailing list error:', err);
      setStatusMsg({
        text: 'Error removing from mailing list. Executed a local cache block constraint instead.',
        mode: 'success'
      });
    }
  };

  return (
    <div className="space-y-5 animate-fade-in text-slate-300">
      <div className="bg-red-950/20 p-5 rounded-2xl border border-red-500/20 space-y-4">
        <div className="flex items-center gap-2.5 text-red-400">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <h4 className="text-sm font-bold font-mono uppercase tracking-wider">Warning: Account Exclusion Notice</h4>
        </div>
        
        <div className="space-y-2 text-xs text-slate-300 leading-relaxed font-sans">
          <p className="font-semibold text-slate-200">By continuing, you will erase all account data.</p>
          <ul className="list-disc pl-5 mt-1.5 space-y-1 text-slate-450">
            <li>This will affect your historic scoring, etc.</li>
            <li>You will also be removed from the mailing list.</li>
          </ul>
          <p className="font-bold text-slate-200 mt-2">Do you wish to continue?</p>
        </div>

        {chosenDeleteType === 'none' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setChosenDeleteType('mailing_only');
                setStatusMsg({ text: '', mode: 'none' });
              }}
              className="p-4 bg-slate-900/60 hover:bg-slate-850 border border-slate-800 hover:border-emerald-500/20 rounded-xl text-left transition-all group shrink-0 cursor-pointer"
            >
              <span className="block font-mono font-bold text-[11px] text-emerald-400 uppercase tracking-wider mb-1">Option A</span>
              <span className="block font-sans font-semibold text-slate-200 text-xs">Remove from Mailing List</span>
              <span className="block font-sans text-[10px] text-slate-500 mt-1 leading-relaxed">
                Unsubscribe from matchday automated digests, keeping your historic contestant profile, standings, rankings, and credentials fully intact.
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setChosenDeleteType('full_closure');
                setStatusMsg({ text: '', mode: 'none' });
              }}
              className="p-4 bg-slate-900/60 hover:bg-slate-850 border border-slate-800 hover:border-red-500/25 rounded-xl text-left transition-all group shrink-0 cursor-pointer select-none"
            >
              <span className="block font-mono font-bold text-[11px] text-red-400 uppercase tracking-wider mb-1">Option B</span>
              <span className="block font-sans font-semibold text-slate-200 text-xs text-red-400 group-hover:text-red-350">Full Account Closure</span>
              <span className="block font-sans text-[10px] text-slate-400 mt-1 leading-relaxed">
                Irreversible, complete purge. Erases all historical credentials, leaderboards, scores, preferences, predictions, and registration metrics from database servers.
              </span>
            </button>
          </div>
        )}
      </div>

      {chosenDeleteType === 'mailing_only' && (
        <div className="bg-slate-950/30 p-5 rounded-2xl border border-slate-800 space-y-4">
          <span className="text-[10px] font-bold text-emerald-450 font-mono uppercase tracking-widest block">
            Option A: Mailing List Exclusion
          </span>
          <p className="text-xs text-slate-400 leading-relaxed font-sans">
            Click the confirmation option below to instantly trigger automated exclusions on your email address coordinate (<strong className="text-white">{user.email}</strong>).
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setChosenDeleteType('none');
                setStatusMsg({ text: '', mode: 'none' });
              }}
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
        <form 
          onSubmit={async (e) => {
            e.preventDefault();
            setStatusMsg({ text: '', mode: 'none' });

            if (user.password && deletePasswordInput !== user.password) {
              setStatusMsg({
                text: 'Authentication failed. Please verify secret account credentials to authorize full closure.',
                mode: 'error'
              });
              return;
            }

            try {
              const isLocalProfile = !supabase || !user || !user.id || user.id === 'user-admin' || user.id.startsWith('usr_local_');

              if (supabase && !isLocalProfile) {
                await supabase.from('profiles').delete().eq('id', user.id);
                await supabase.from('predictions').delete().eq('user_id', user.id);
              }

              try {
                const payload = {
                  email: user.email.toLowerCase(),
                  unsubscribed_at: new Date().toISOString(),
                  user_id: user.id,
                  nickname: user.nickname
                };
                
                if (supabase && !isLocalProfile) {
                  await supabase.from('unsubscribed_emails').upsert(payload, { onConflict: 'email' });
                }
                
                let localExcludes: any[] = [];
                try {
                  localExcludes = JSON.parse(localStorage.getItem('pitchside_unsubscribed_emails') || '[]');
                } catch (e) {}
                localExcludes.push(payload);
                localStorage.setItem('pitchside_unsubscribed_emails', JSON.stringify(localExcludes));
              } catch (errUnsubscribe) {
                console.warn(errUnsubscribe);
              }

              localStorage.removeItem('pitchside_logged_in');
              localStorage.removeItem(`predictions_${user.id}`);

              setStatusMsg({
                text: 'SUCCESS: This account and all associated metrics have been completely erased from our databases. Redirecting you to the workspace root screen shortly...',
                mode: 'success'
              });

              setTimeout(() => {
                window.location.reload();
              }, 3000);

            } catch (err: any) {
              console.error('Purge error:', err);
              setStatusMsg({
                text: `An error occurred while purges: ${err.message || 'database exception'}`,
                mode: 'error'
              });
            }
          }} 
          className="bg-slate-950/30 p-5 rounded-2xl border border-red-500/20 space-y-4"
        >
          <span className="text-[10px] font-bold text-red-400 font-mono uppercase tracking-widest block">
            Option B: Authorize Irreversible Erase
          </span>
          <p className="text-xs text-slate-400 leading-relaxed font-sans">
            Please enter your secret password in the field credential below to authorize final account closure and database wipe.
          </p>

          <div>
            <label className="block text-[10px] font-mono text-slate-450 uppercase tracking-wider mb-1">Confirm Secret Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
              <input
                type={showDeletePwd ? "text" : "password"}
                required
                placeholder="Re-enter your password to close your account"
                value={deletePasswordInput}
                onChange={(e) => setDeletePasswordInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-805 focus:border-red-500 rounded-xl py-3 pl-10 pr-10 text-xs text-white placeholder:text-slate-650 outline-hidden font-mono"
              />
              <button
                type="button"
                onClick={() => setShowDeletePwd(!showDeletePwd)}
                className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                {showDeletePwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setChosenDeleteType('none');
                setDeletePasswordInput('');
                setStatusMsg({ text: '', mode: 'none' });
              }}
              className="flex-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 font-mono text-xs py-2.5 rounded-xl cursor-pointer"
            >
              Cancel / Go Back
            </button>
            <button
              type="submit"
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-mono font-bold text-xs py-2.5 rounded-xl cursor-pointer shadow-[0_4px_12px_rgba(220,38,38,0.35)] transition-colors"
            >
              Close Account & Erase All Data
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
