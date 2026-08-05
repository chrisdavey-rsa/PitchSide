/**
 * Dedicated login view — username/email + password with Forgot Password reveal.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, KeyRound, Eye, EyeOff, ArrowRight, Mail, ArrowLeft } from 'lucide-react';
import { UserProfile } from '../../types';
import AuthCard, { AuthError, AuthSuccess } from './AuthCard';
import OAuthButtons from './OAuthButtons';
import { performLogin, requestPasswordReset } from './authSession';

export interface LoginViewProps {
  onAuthSuccess: (user: UserProfile) => void;
  onAddNewUser: (user: UserProfile) => void;
  onForgotPassword: () => void;
  onCreateAccount: () => void;
  /** Shown after password reset or other successful pre-login flows. */
  successMessage?: string;
  onLogoClick?: () => void;
  onTakeTour?: () => void;
  /**
   * When true, "Forgot Password?" expands an email form inline instead of
   * only calling onForgotPassword (used by /login page).
   */
  inlineForgotPassword?: boolean;
}

export default function LoginView({
  onAuthSuccess,
  onAddNewUser,
  onForgotPassword,
  onCreateAccount,
  successMessage,
  onLogoClick,
  onTakeTour,
  inlineForgotPassword = false,
}: LoginViewProps) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [masked, setMasked] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotError, setForgotError] = useState('');

  const handleForgotClick = () => {
    if (inlineForgotPassword) {
      setShowForgot(true);
      setError('');
      return;
    }
    onForgotPassword();
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    if (!forgotEmail.trim()) {
      setForgotError('Please enter your registered email address.');
      return;
    }
    setForgotLoading(true);
    try {
      await requestPasswordReset(forgotEmail);
      setForgotSent(true);
    } catch (err: unknown) {
      setForgotError(
        typeof err === 'string'
          ? err
          : (err as Error)?.message || 'Failed to send recovery link.',
      );
    } finally {
      setForgotLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { profile, welcomeMessage } = await performLogin(identifier, password);
      onAddNewUser(profile);
      onAuthSuccess(profile);
      void welcomeMessage;
    } catch (err: unknown) {
      setError(typeof err === 'string' ? err : (err as Error)?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard onLogoClick={onLogoClick}>
      {onTakeTour && (
        <button
          type="button"
          onClick={onTakeTour}
          className="mb-4 w-full text-center text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
        >
          Take a Tour
        </button>
      )}
      <div className="flex border-b border-slate-800 mb-2 pb-1">
        <div className="flex-1 flex justify-center">
          <span className="relative inline-block pb-3 text-sm font-semibold font-display tracking-wide uppercase text-white text-center">
            Login
            <motion.div
              layoutId="authTabId"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"
            />
          </span>
        </div>
        <button
          type="button"
          onClick={onCreateAccount}
          className="flex-1 flex justify-center pb-3 text-sm font-semibold font-display tracking-wide uppercase text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
        >
          <span className="relative inline-block text-center">Create Account</span>
        </button>
      </div>
      <p className="mb-5 text-[11px] text-slate-500 font-sans text-center">
        New to PitchSide?{" "}
        <button
          type="button"
          onClick={onCreateAccount}
          className="text-blue-400 hover:text-blue-300 font-semibold cursor-pointer"
        >
          Create an account
        </button>
      </p>

      {successMessage && <AuthSuccess message={successMessage} />}
      {error && <AuthError message={error} />}

      <AnimatePresence mode="wait">
        {showForgot ? (
          <motion.div
            key="forgot"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-4"
          >
            {forgotSent ? (
              <div className="text-center space-y-3 py-2">
                <Mail className="w-10 h-10 text-blue-400 mx-auto" />
                <p className="text-xs text-slate-300 leading-relaxed">
                  If an account exists for <span className="text-white font-semibold">{forgotEmail}</span>, a reset link is on its way. It opens the Update Password page.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowForgot(false);
                    setForgotSent(false);
                    setForgotEmail('');
                  }}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-lg py-2.5 text-xs uppercase cursor-pointer"
                >
                  Back to Login
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} className="space-y-4">
                <div className="text-center">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                    Forgot Password?
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Enter your email and we&apos;ll send a secure reset link.
                  </p>
                </div>
                {forgotError && <AuthError message={forgotError} />}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 font-mono">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className="w-full bg-slate-950/60 border border-slate-800 focus:border-blue-500 rounded-lg py-2 pl-10 pr-4 text-sm text-white placeholder:text-slate-600 outline-none transition-colors"
                    />
                  </div>
                </div>
                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgot(false);
                      setForgotError('');
                    }}
                    className="flex-1 bg-slate-950 text-slate-400 hover:text-white border border-slate-800 font-semibold rounded-lg py-2 text-xs uppercase cursor-pointer flex items-center justify-center gap-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-semibold rounded-lg py-2 text-xs uppercase cursor-pointer"
                  >
                    {forgotLoading ? 'Sending…' : 'Send Link'}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        ) : (
          <motion.form
            key="login"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
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

            <div className="relative">
              <label
                htmlFor="login-password-input"
                className="block text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono mb-1.5 pr-28"
              >
                Password
              </label>
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
              <button
                type="button"
                onClick={handleForgotClick}
                className="absolute right-0 top-0 text-[10px] text-blue-400 hover:text-blue-300 hover:underline cursor-pointer font-semibold font-mono uppercase tracking-wide"
              >
                Forgot Password?
              </button>
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
        )}
      </AnimatePresence>

      {!showForgot && <OAuthButtons onError={setError} />}
    </AuthCard>
  );
}
