import React, { useEffect, useState } from 'react';
import { Lock, Eye, EyeOff, Sparkles, Loader2 } from 'lucide-react';
import { UserProfile } from '../../types';
import { supabase } from '../../supabase';
import {
  isOAuthOnlyAccount,
  normalizeAuthProviders,
} from '../../lib/authProviders';
import { OAuthAccountAlert } from './OAuthAccountAlert';

const OAUTH_PASSWORD_MESSAGE =
  'Your account is linked via Google. You do not have a separate PitchSide password. Please manage your security settings directly within your Google account.';

interface ChangePasswordProps {
  user: UserProfile;
  onUpdateUser: (updatedUser: UserProfile) => void;
  setStatusMsg: (msg: { text: string; mode: 'success' | 'error' | 'none' }) => void;
}

export const ChangePassword: React.FC<ChangePasswordProps> = ({
  user,
  onUpdateUser,
  setStatusMsg,
}) => {
  const [oldPwdInput, setOldPwdInput] = useState('');
  const [newPwdInput, setNewPwdInput] = useState('');
  const [confirmNewPwdInput, setConfirmNewPwdInput] = useState('');

  const [showOldPwd, setShowOldPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);

  const [authReady, setAuthReady] = useState(false);
  const [oauthOnly, setOauthOnly] = useState(false);
  const [accountEmail, setAccountEmail] = useState(user.email || '');

  useEffect(() => {
    let cancelled = false;

    const loadAuthUser = async () => {
      if (!supabase) {
        if (!cancelled) {
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
          if (authUser.email) setAccountEmail(authUser.email);
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
        setOauthOnly(false);
        setAuthReady(true);
      }
    };

    void loadAuthUser();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSuggestPassword = () => {
    const uppers = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowers = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const specials = '!@#$%^&*()_+';
    const allChars = uppers + lowers + numbers + specials;

    const getRandomChar = (charset: string) => {
      const array = new Uint32Array(1);
      window.crypto.getRandomValues(array);
      return charset[array[0] % charset.length];
    };

    let generatedPass = '';
    generatedPass += getRandomChar(uppers);
    generatedPass += getRandomChar(lowers);
    generatedPass += getRandomChar(numbers);
    generatedPass += getRandomChar(specials);

    for (let i = 0; i < 8; i++) {
      generatedPass += getRandomChar(allChars);
    }

    const array = new Uint32Array(generatedPass.length);
    window.crypto.getRandomValues(array);
    const shuffled = generatedPass
      .split('')
      .map((char, i) => ({ char, sort: array[i] }))
      .sort((a, b) => a.sort - b.sort)
      .map((a) => a.char)
      .join('');

    setNewPwdInput(shuffled);
    setConfirmNewPwdInput(shuffled);
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg({ text: '', mode: 'none' });

    if (newPwdInput.length < 6) {
      setStatusMsg({
        text: 'New security passwords must be at least 6 characters.',
        mode: 'error',
      });
      return;
    }

    if (newPwdInput !== confirmNewPwdInput) {
      setStatusMsg({
        text: 'The input new password and confirmation password do not match. Verification failed.',
        mode: 'error',
      });
      return;
    }

    if (!supabase) {
      setStatusMsg({ text: 'Authentication service is unavailable.', mode: 'error' });
      return;
    }

    const email = (accountEmail || user.email || '').trim().toLowerCase();
    if (!email) {
      setStatusMsg({ text: 'Could not resolve your account email.', mode: 'error' });
      return;
    }
    if (!oldPwdInput) {
      setStatusMsg({ text: 'Please enter your current password.', mode: 'error' });
      return;
    }

    try {
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email,
        password: oldPwdInput,
      });
      if (reauthError) {
        setStatusMsg({
          text: reauthError.message || 'Validation failed. Your old password does not match.',
          mode: 'error',
        });
        return;
      }

      const { error: pwdErr } = await supabase.auth.updateUser({ password: newPwdInput });
      if (pwdErr) throw pwdErr;

      onUpdateUser({
        ...user,
        password: newPwdInput,
      });
      setOldPwdInput('');
      setNewPwdInput('');
      setConfirmNewPwdInput('');
      setStatusMsg({
        text: 'Success! Your security password has been modified. Keep record of secret details.',
        mode: 'success',
      });
    } catch (err: unknown) {
      console.warn('Password change error:', err);
      setStatusMsg({
        text: err instanceof Error ? err.message : 'Password change failed.',
        mode: 'error',
      });
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
      <OAuthAccountAlert title="Linked via Google" message={OAUTH_PASSWORD_MESSAGE} />
    );
  }

  return (
    <form
      onSubmit={handleUpdatePassword}
      className="space-y-4 bg-slate-950/20 p-5 rounded-2xl border border-slate-800 animate-fade-in"
    >
      <div>
        <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">
          Old Password
        </label>
        <div className="relative">
          <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
          <input
            type={showOldPwd ? 'text' : 'password'}
            required
            autoComplete="current-password"
            placeholder="••••••••"
            value={oldPwdInput}
            onChange={(e) => setOldPwdInput(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl py-3 pl-10 pr-10 text-xs text-white placeholder:text-slate-600 outline-none font-mono"
          />
          <button
            type="button"
            onClick={() => setShowOldPwd(!showOldPwd)}
            className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-200 cursor-pointer"
            title={showOldPwd ? 'Hide Password' : 'Show Password'}
          >
            {showOldPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="border-t border-slate-800/60 pt-3 space-y-4">
        <div className="flex justify-between items-center">
          <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider">
            New Password
          </label>
          <button
            type="button"
            onClick={handleSuggestPassword}
            className="text-[10px] font-mono text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1.5 underline cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" /> Suggest Strong Password
          </button>
        </div>

        <div className="relative">
          <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
          <input
            type={showNewPwd ? 'text' : 'password'}
            required
            autoComplete="new-password"
            placeholder="Enter strong password (minimum 6 characters)"
            value={newPwdInput}
            onChange={(e) => setNewPwdInput(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl py-3 pl-10 pr-10 text-xs text-white placeholder:text-slate-600 outline-none font-mono"
          />
          <button
            type="button"
            onClick={() => setShowNewPwd(!showNewPwd)}
            className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-200 cursor-pointer"
            title={showNewPwd ? 'Hide Password' : 'Show Password'}
          >
            {showNewPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        <div>
          <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">
            Confirm New Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
            <input
              type={showConfirmPwd ? 'text' : 'password'}
              required
              autoComplete="new-password"
              placeholder="Confirm password"
              value={confirmNewPwdInput}
              onChange={(e) => setConfirmNewPwdInput(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl py-3 pl-10 pr-10 text-xs text-white placeholder:text-slate-600 outline-none font-mono"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPwd(!showConfirmPwd)}
              className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-200 cursor-pointer"
              title={showConfirmPwd ? 'Hide Password' : 'Show Password'}
            >
              {showConfirmPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      <button
        type="submit"
        className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold font-display uppercase tracking-wider py-3 rounded-xl text-xs cursor-pointer shadow-[0_4px_12px_rgba(16,185,129,0.3)] transition-colors mt-2"
      >
        Verify & Change Password
      </button>
    </form>
  );
};
