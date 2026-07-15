/**
 * Dedicated login view — username/email + password with forgot-password link.
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { User, KeyRound, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { UserProfile } from '../../types';
import AuthCard, { AuthError, AuthSuccess } from './AuthCard';
import { performLogin } from './authSession';

export interface LoginViewProps {
  onAuthSuccess: (user: UserProfile) => void;
  onAddNewUser: (user: UserProfile) => void;
  onForgotPassword: () => void;
  onCreateAccount: () => void;
  /** Shown after password reset or other successful pre-login flows. */
  successMessage?: string;
  onLogoClick?: () => void;
}

export default function LoginView({
  onAuthSuccess,
  onAddNewUser,
  onForgotPassword,
  onCreateAccount,
  successMessage,
  onLogoClick,
}: LoginViewProps) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [masked, setMasked] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { profile, welcomeMessage } = await performLogin(identifier, password);
      onAddNewUser(profile);
      onAuthSuccess(profile);
      // welcomeMessage is consumed by App after auth success if needed
      void welcomeMessage;
    } catch (err: unknown) {
      setError(typeof err === 'string' ? err : (err as Error)?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard onLogoClick={onLogoClick}>
      <div className="flex border-b border-slate-800 mb-6 pb-1">
        <span className="flex-1 pb-3 text-sm font-semibold font-display tracking-wide uppercase text-white relative">
          Login
          <motion.div layoutId="authTabId" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
        </span>
        <button
          type="button"
          onClick={onCreateAccount}
          className="flex-1 pb-3 text-sm font-semibold font-display tracking-wide uppercase text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
        >
          Create Account
        </button>
      </div>

      {successMessage && <AuthSuccess message={successMessage} />}
      {error && <AuthError message={error} />}

      <motion.form
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 font-mono">
            Username or Email
          </label>
          <div className="relative">
            <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              id="login-identifier-input"
              type="text"
              required
              autoComplete="username"
              placeholder="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full bg-slate-950/60 border border-slate-800 focus:border-blue-500 rounded-lg py-2 pl-10 pr-4 text-sm text-white placeholder:text-slate-600 outline-none transition-colors"
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono">
              Password
            </label>
            <button
              type="button"
              onClick={onForgotPassword}
              className="text-[10px] text-blue-400 hover:text-blue-300 hover:underline cursor-pointer font-semibold font-mono uppercase tracking-wide"
            >
              Forgot Password?
            </button>
          </div>
          <div className="relative">
            <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              id="login-password-input"
              type={masked ? 'password' : 'text'}
              autoComplete="current-password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-950/60 border border-slate-800 focus:border-blue-500 rounded-lg py-2 pl-10 pr-10 text-sm text-white placeholder:text-slate-600 outline-none transition-colors"
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setMasked(!masked)}
              className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 cursor-pointer"
            >
              {masked ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4 text-white" />}
            </button>
          </div>
        </div>

        <button
          id="login-submit-btn"
          type="submit"
          disabled={loading}
          className="group relative w-full overflow-hidden bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed active:translate-y-px transition-all text-white font-semibold font-display tracking-wide rounded-lg py-2.5 text-xs uppercase flex items-center justify-center gap-1.5 cursor-pointer shadow-[0_4px_12px_rgba(59,130,246,0.3)]"
        >
          <span className="relative z-10 flex items-center gap-1.5">
            {loading ? 'Signing in…' : 'Enter'}
            {!loading && <ArrowRight className="w-3.5 h-3.5" />}
          </span>
          <div className="absolute inset-0 -translate-x-[150%] bg-linear-to-r from-transparent via-white/40 to-transparent group-hover:animate-[shimmer_0.75s_ease-in-out_1]" />
        </button>
      </motion.form>
    </AuthCard>
  );
}
