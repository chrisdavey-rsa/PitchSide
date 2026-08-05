import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Loader2, CheckCircle2 } from 'lucide-react';
import { UserProfile } from '../../types';
import { supabase } from '../../supabase';
import {
  isOAuthOnlyAccount,
  normalizeAuthProviders,
} from '../../lib/authProviders';
import { OAuthAccountAlert } from './OAuthAccountAlert';

const SUCCESS_MESSAGE =
  'A confirmation link has been sent to your new email address. You are being logged out. Please click the link in your email to verify and log back in.';

const OAUTH_EMAIL_MESSAGE =
  'Your account is linked via Google. To change your email address, please manage your settings directly within your Google account.';

interface ChangeEmailProps {
  user: UserProfile;
  onUpdateUser: (updatedUser: UserProfile) => void;
  setStatusMsg: (msg: { text: string; mode: 'success' | 'error' | 'none' }) => void;
}

export const ChangeEmail: React.FC<ChangeEmailProps> = ({
  user,
  onUpdateUser: _onUpdateUser,
  setStatusMsg,
}) => {
  const navigate = useNavigate();
  const [currentEmail, setCurrentEmail] = useState(user.email || '');
  const [curPasswordInput, setCurPasswordInput] = useState('');
  const [newEmailInput, setNewEmailInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [oauthOnly, setOauthOnly] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadAuthUser = async () => {
      if (!supabase) {
        if (!cancelled) {
          setCurrentEmail(user.email || '');
          setOauthOnly(false);
          setAuthReady(true);
        }
        return;
      }
      try {
        const { data, error } = await supabase.auth.getUser();
        if (cancelled) return;
        const authUser = data.user;
        if (!error && authUser) {
          if (authUser.email) setCurrentEmail(authUser.email);
          else setCurrentEmail(user.email || '');

          const providers = normalizeAuthProviders(
            authUser.app_metadata?.providers,
            authUser.identities,
          );
          setOauthOnly(isOAuthOnlyAccount(providers));
          setAuthReady(true);
          return;
        }
      } catch {
        /* fall through */
      }
      if (!cancelled) {
        setCurrentEmail(user.email || '');
        setOauthOnly(false);
        setAuthReady(true);
      }
    };

    void loadAuthUser();
    return () => {
      cancelled = true;
    };
  }, [user.email]);

  const finishLogout = async () => {
    try {
      await supabase?.auth.signOut();
    } catch (err) {
      console.warn('[ChangeEmail] signOut failed', err);
    }
    try {
      localStorage.removeItem('pitchside_logged_in');
    } catch {
      /* ignore */
    }
    navigate('/login', { replace: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg({ text: '', mode: 'none' });

    const emailOnRecord = currentEmail.trim().toLowerCase();
    const newEmail = newEmailInput.trim().toLowerCase();
    const password = curPasswordInput;

    if (!supabase) {
      setStatusMsg({ text: 'Authentication service is unavailable.', mode: 'error' });
      return;
    }
    if (!emailOnRecord) {
      setStatusMsg({ text: 'Could not resolve your current email address.', mode: 'error' });
      return;
    }
    if (!password) {
      setStatusMsg({ text: 'Please enter your current password.', mode: 'error' });
      return;
    }
    if (!newEmail) {
      setStatusMsg({ text: 'Please enter a valid new email address.', mode: 'error' });
      return;
    }
    if (newEmail === emailOnRecord) {
      setStatusMsg({
        text: 'Your new email address is identical to your current email.',
        mode: 'error',
      });
      return;
    }

    setLoading(true);
    try {
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: emailOnRecord,
        password,
      });
      if (reauthError) {
        setStatusMsg({
          text: reauthError.message || 'Authentication failed. Check your current password.',
          mode: 'error',
        });
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ email: newEmail });
      if (updateError) {
        setStatusMsg({
          text: updateError.message || 'Failed to start email change.',
          mode: 'error',
        });
        return;
      }

      setStatusMsg({ text: SUCCESS_MESSAGE, mode: 'success' });
      setShowSuccessModal(true);
      setCurPasswordInput('');
      setNewEmailInput('');

      window.setTimeout(() => {
        void finishLogout();
      }, 3000);
    } catch (err: unknown) {
      setStatusMsg({
        text: err instanceof Error ? err.message : 'Email change failed.',
        mode: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!authReady) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-xs font-mono text-slate-500 uppercase tracking-wider">
        <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
        Loading account…
      </div>
    );
  }

  if (oauthOnly) {
    return (
      <OAuthAccountAlert title="Linked via Google" message={OAUTH_EMAIL_MESSAGE} />
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <form
        onSubmit={handleSubmit}
        className="space-y-4 bg-slate-950/20 p-5 rounded-2xl border border-slate-800"
      >
        <div>
          <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">
            Current Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
            <input
              type="email"
              readOnly
              disabled
              value={currentEmail}
              aria-readonly="true"
              className="w-full bg-slate-900/80 border border-slate-800 rounded-xl py-3 pl-10 pr-3 text-xs text-slate-300 font-mono outline-none cursor-not-allowed opacity-90"
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">
            Current Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
            <input
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              value={curPasswordInput}
              onChange={(e) => setCurPasswordInput(e.target.value)}
              disabled={loading || showSuccessModal}
              className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl py-3 pl-10 pr-3 text-xs text-white placeholder:text-slate-600 outline-none disabled:opacity-60"
            />
          </div>
        </div>

        <div className="border-t border-slate-800 pt-3">
          <label className="block text-[10px] font-mono text-emerald-400/90 uppercase tracking-wider mb-1">
            New Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-emerald-500/60" />
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="Enter new email address"
              value={newEmailInput}
              onChange={(e) => setNewEmailInput(e.target.value)}
              disabled={loading || showSuccessModal}
              className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl py-3 pl-10 pr-3 text-xs text-white placeholder:text-slate-600 font-mono outline-none disabled:opacity-60"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || showSuccessModal}
          className="w-full inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold font-display uppercase tracking-wider py-3 rounded-xl text-xs cursor-pointer shadow-[0_4px_12px_rgba(16,185,129,0.3)] transition-colors"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Authenticating…
            </>
          ) : (
            'Authenticate & Send Validation Code'
          )}
        </button>
      </form>

      {showSuccessModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="change-email-success-title"
            className="w-full max-w-md rounded-2xl border border-emerald-500/30 bg-slate-900 p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h5
                  id="change-email-success-title"
                  className="text-sm font-bold text-emerald-300 uppercase tracking-wider font-mono"
                >
                  Confirmation sent
                </h5>
                <p className="mt-2 text-xs text-slate-300 leading-relaxed">{SUCCESS_MESSAGE}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                void finishLogout();
              }}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-xs uppercase tracking-wider py-2.5 rounded-xl cursor-pointer"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
