/**
 * Password reset view — State A (request link) and State B (set new password
 * after clicking the email link and receiving a PASSWORD_RECOVERY session).
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldCheck,
  KeyRound,
  Eye,
  EyeOff,
  ArrowRight,
  CheckCircle2,
  Mail,
  ArrowLeft,
} from 'lucide-react';
import AuthCard, { AuthError } from './AuthCard';
import { requestPasswordReset, updatePassword } from './authSession';
import { supabase } from '../../supabase';

export type ResetPasswordMode = 'request' | 'update';

export interface ResetPasswordViewProps {
  mode: ResetPasswordMode;
  onBackToLogin: () => void;
  /** Called after password successfully updated (State B). */
  onPasswordUpdated: () => void;
  onLogoClick?: () => void;
}

export default function ResetPasswordView({
  mode,
  onBackToLogin,
  onPasswordUpdated,
  onLogoClick,
}: ResetPasswordViewProps) {
  return (
    <AuthCard
      onLogoClick={onLogoClick}
      badge={
        <div className="text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-xs font-semibold text-blue-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Secure Password Reset</span>
          </div>
        </div>
      }
    >
      <AnimatePresence mode="wait">
        {mode === 'request' ? (
          <motion.div key="request" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <RequestForm onBackToLogin={onBackToLogin} />
          </motion.div>
        ) : (
          <motion.div key="update" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <UpdateForm onPasswordUpdated={onPasswordUpdated} onBackToLogin={onBackToLogin} />
          </motion.div>
        )}
      </AnimatePresence>
    </AuthCard>
  );
}

/* ── State A: request reset link ── */

function RequestForm({ onBackToLogin }: { onBackToLogin: () => void }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) {
      setError('Please enter your registered email address.');
      return;
    }
    setLoading(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err: unknown) {
      setError(
        typeof err === 'string'
          ? err
          : 'Failed to send a recovery link. Make sure this is a registered email.',
      );
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-4 py-2"
      >
        <Mail className="w-12 h-12 text-blue-400 mx-auto" />
        <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
          Check Your Email
        </h3>
        <p className="text-xs text-slate-400 leading-relaxed px-2">
          A password reset link has been sent to <span className="text-white font-semibold">{email}</span>.
          Click the link in the email to set a new password.
        </p>
        <button
          type="button"
          onClick={onBackToLogin}
          className="mt-2 w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg py-2.5 text-xs uppercase tracking-wide transition-colors cursor-pointer flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Login
        </button>
      </motion.div>
    );
  }

  return (
    <motion.form
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      onSubmit={handleSubmit}
      className="space-y-4"
    >
      <div className="text-center pb-1">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
          Reset Your Password
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          Enter the email address linked to your account and we'll send you a reset link.
        </p>
      </div>

      {error && <AuthError message={error} />}

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
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-slate-950/60 border border-slate-800 focus:border-blue-500 rounded-lg py-2 pl-10 pr-4 text-sm text-white placeholder:text-slate-600 outline-none transition-colors"
          />
        </div>
      </div>

      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={onBackToLogin}
          className="flex-1 bg-slate-950 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700 font-semibold rounded-lg py-2 text-xs uppercase cursor-pointer transition-all"
        >
          Back
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-semibold rounded-lg py-2 text-xs uppercase cursor-pointer transition-all shadow-[0_4px_12px_rgba(59,130,246,0.3)]"
        >
          {loading ? 'Sending…' : 'Send Link'}
        </button>
      </div>
    </motion.form>
  );
}

/* ── State B: set new password (recovery session active) ── */

function UpdateForm({
  onPasswordUpdated,
  onBackToLogin,
}: {
  onPasswordUpdated: () => void;
  onBackToLogin: () => void;
}) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please re-enter both fields.');
      return;
    }

    setLoading(true);
    try {
      await updatePassword(newPassword);
      setDone(true);
    } catch (err: unknown) {
      setError(
        typeof err === 'string'
          ? err
          : 'Failed to update your password. The reset link may have expired — request a new one.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    await supabase?.auth.signOut();
    onPasswordUpdated();
  };

  if (done) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center space-y-4 py-2"
      >
        <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
        <p className="text-sm font-semibold text-emerald-300">Password updated successfully!</p>
        <p className="text-xs text-slate-400">
          Your new password is active. Sign in to continue.
        </p>
        <button
          onClick={handleComplete}
          className="mt-2 w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg py-2.5 text-xs uppercase tracking-wide transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-[0_4px_12px_rgba(59,130,246,0.3)]"
        >
          Return to Login <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </motion.div>
    );
  }

  return (
    <motion.form
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      onSubmit={handleSubmit}
      className="space-y-4"
    >
      <div className="text-center pb-1">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
          Set a New Password
        </h3>
        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
          Choose a strong password for your PitchSide account.
        </p>
      </div>

      {error && <AuthError message={error} />}

      <PasswordField
        label="New Password"
        value={newPassword}
        onChange={setNewPassword}
        show={showNew}
        onToggle={() => setShowNew(!showNew)}
        autoFocus
      />

      <PasswordField
        label="Confirm New Password"
        value={confirmPassword}
        onChange={setConfirmPassword}
        show={showConfirm}
        onToggle={() => setShowConfirm(!showConfirm)}
      />

      {newPassword && confirmPassword && newPassword !== confirmPassword && (
        <p className="text-xs text-red-400 font-mono">Passwords don't match yet.</p>
      )}
      {newPassword && confirmPassword && newPassword === confirmPassword && (
        <p className="text-xs text-emerald-400 font-mono flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5" /> Passwords match
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-semibold rounded-lg py-2.5 text-xs uppercase tracking-wide transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-[0_4px_12px_rgba(59,130,246,0.3)]"
      >
        {loading ? 'Updating…' : <>Set New Password <ArrowRight className="w-3.5 h-3.5" /></>}
      </button>

      <button
        type="button"
        onClick={onBackToLogin}
        className="w-full text-center text-[10px] font-mono uppercase tracking-widest text-slate-600 hover:text-slate-400 transition-colors cursor-pointer"
      >
        Back to Login
      </button>
    </motion.form>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  show,
  onToggle,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
  autoFocus?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 font-mono">
        {label}
      </label>
      <div className="relative">
        <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Minimum 6 characters"
          required
          autoFocus={autoFocus}
          autoComplete="new-password"
          className="w-full bg-slate-950/60 border border-slate-800 focus:border-blue-500 rounded-lg py-2 pl-10 pr-10 text-sm text-white placeholder:text-slate-600 outline-none transition-colors"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={onToggle}
          className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 cursor-pointer"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
