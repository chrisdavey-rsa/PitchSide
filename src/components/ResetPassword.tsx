import React, { useState } from 'react';
import { KeyRound, Eye, EyeOff, CheckCircle2, ArrowRight, ShieldCheck } from 'lucide-react';
import { supabase } from '../supabase';
import PitchSideLogo from './PitchSideLogo';

interface ResetPasswordProps {
  onComplete: () => void;
}

export default function ResetPassword({ onComplete }: ResetPasswordProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

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
      const { error: updateError } = await supabase!.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to update your password. Please try again or request a new reset link.');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    await supabase?.auth.signOut();
    onComplete();
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh]">
      <div className="w-full max-w-sm bg-slate-900/80 border border-slate-800 rounded-2xl p-7 space-y-5 shadow-2xl backdrop-blur-sm">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-3">
            <PitchSideLogo size="sm" autoplay={false} />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-xs font-semibold text-blue-400 mx-auto">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Secure Password Reset</span>
          </div>
          <h2 className="text-base font-bold font-display uppercase tracking-wider text-white pt-1">
            Set a New Password
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Choose a strong password for your PitchSide account. You'll use this to log in from now on.
          </p>
        </div>

        {success ? (
          <div className="text-center space-y-4 py-2">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            <p className="text-sm font-semibold text-emerald-300">Password updated successfully!</p>
            <p className="text-xs text-slate-400">
              Your new password is active. Click below to return to the login screen.
            </p>
            <button
              onClick={handleComplete}
              className="mt-2 w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg py-2.5 text-xs uppercase tracking-wide transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              Return to Login <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-lg text-xs text-red-300 leading-relaxed">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 font-mono">
                New Password
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  required
                  autoFocus
                  className="w-full bg-slate-950/60 border border-slate-800 focus:border-blue-500 rounded-lg py-2 pl-10 pr-10 text-sm text-white placeholder:text-slate-600 outline-none transition-colors"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 cursor-pointer"
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 font-mono">
                Confirm New Password
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your new password"
                  required
                  className="w-full bg-slate-950/60 border border-slate-800 focus:border-blue-500 rounded-lg py-2 pl-10 pr-10 text-sm text-white placeholder:text-slate-600 outline-none transition-colors"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 cursor-pointer"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

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
              className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg py-2.5 text-xs uppercase tracking-wide transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-[0_4px_12px_rgba(59,130,246,0.3)]"
            >
              {loading ? (
                <span className="animate-pulse">Updating Password...</span>
              ) : (
                <>Set New Password <ArrowRight className="w-3.5 h-3.5" /></>
              )}
            </button>
          </form>
        )}

        <div className="text-center text-[10px] text-slate-600 font-mono">
          PitchSide © {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}
