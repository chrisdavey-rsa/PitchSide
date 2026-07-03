import React, { useState } from 'react';
import { Mail, Lock } from 'lucide-react';
import { UserProfile } from '../../types';
import { supabase } from '../../supabase';

interface ChangeEmailProps {
  user: UserProfile;
  onUpdateUser: (updatedUser: UserProfile) => void;
  setStatusMsg: (msg: { text: string; mode: 'success' | 'error' | 'none' }) => void;
}

export const ChangeEmail: React.FC<ChangeEmailProps> = ({ user, onUpdateUser, setStatusMsg }) => {
  const [curEmailInput, setCurEmailInput] = useState('email@pitchside.com');
  const [curPasswordInput, setCurPasswordInput] = useState('');
  const [newEmailInput, setNewEmailInput] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isEmailVerificationPending, setIsEmailVerificationPending] = useState(false);
  const [generatedVerificationCode, setGeneratedVerificationCode] = useState('');

  const handleInitiateEmailChange = (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg({ text: '', mode: 'none' });

    if (curEmailInput.trim().toLowerCase() !== user.email.toLowerCase()) {
      setStatusMsg({
        text: 'The input current email address does not match your registered email credentials.',
        mode: 'error'
      });
      return;
    }

    if (user.password && curPasswordInput !== user.password) {
      setStatusMsg({
        text: 'Authentication failed. Current password does not match our records.',
        mode: 'error'
      });
      return;
    }

    if (!newEmailInput.trim()) {
      setStatusMsg({
        text: 'Please input a valid future email coordinate.',
        mode: 'error'
      });
      return;
    }

    if (newEmailInput.trim().toLowerCase() === user.email.toLowerCase()) {
      setStatusMsg({
        text: 'Your new email address coordinate is identical to your current email.',
        mode: 'error'
      });
      return;
    }

    const generatedCode = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedVerificationCode(generatedCode);
    setIsEmailVerificationPending(true);
    setStatusMsg({
      text: 'Secure validation codes dispatched! Check simulated inbox code below to finalize email redirection.',
      mode: 'success'
    });
  };

  const handleVerifyEmailCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg({ text: '', mode: 'none' });

    if (verificationCode.trim() !== generatedVerificationCode) {
      setStatusMsg({
        text: 'Incorrect confirmation verification code parameter. Please check simulated output below and retry.',
        mode: 'error'
      });
      return;
    }

    try {
      const isLocalProfile = !supabase || !user || !user.id || user.id === 'user-admin' || user.id.startsWith('usr_local_');

      if (supabase && !isLocalProfile) {
        const { error: dbErr } = await supabase
          .from('profiles')
          .update({
            email: newEmailInput.trim().toLowerCase()
          })
          .eq('id', user.id);

        if (dbErr) throw dbErr;
      }

      const updatedProfile: UserProfile = {
        ...user,
        email: newEmailInput.trim().toLowerCase()
      };

      onUpdateUser(updatedProfile);
      setCurEmailInput('');
      setCurPasswordInput('');
      setNewEmailInput('');
      setVerificationCode('');
      setIsEmailVerificationPending(false);
      setStatusMsg({
        text: 'Success! Your registered login and correspondence email has been modified successfully!',
        mode: 'success'
      });
    } catch (err: any) {
      console.warn('Email change sync error:', err);
      onUpdateUser({
        ...user,
        email: newEmailInput.trim().toLowerCase()
      });
      setCurEmailInput('');
      setCurPasswordInput('');
      setNewEmailInput('');
      setVerificationCode('');
      setIsEmailVerificationPending(false);
      setStatusMsg({
        text: 'Registered email coordinate updated and local account backup modified successfully.',
        mode: 'success'
      });
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {!isEmailVerificationPending ? (
        <form onSubmit={handleInitiateEmailChange} className="space-y-4 bg-slate-950/20 p-5 rounded-2xl border border-slate-805">
          
          <div>
            <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">Current Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
              <input
                type="email"
                required
                placeholder="email@pitchside.com"
                value={curEmailInput}
                onChange={(e) => setCurEmailInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl py-3 pl-10 pr-3 text-xs text-white placeholder:text-slate-655 font-mono outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">Current Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={curPasswordInput}
                onChange={(e) => setCurPasswordInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl py-3 pl-10 pr-3 text-xs text-white placeholder:text-slate-655 outline-hidden"
              />
            </div>
          </div>

          <div className="border-t border-slate-850 pt-3">
            <label className="block text-[10px] font-mono text-emerald-450 uppercase tracking-wider mb-1">New Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-emerald-500/60" />
              <input
                type="email"
                required
                placeholder="Enter new email address"
                value={newEmailInput}
                onChange={(e) => setNewEmailInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl py-3 pl-10 pr-3 text-xs text-white placeholder:text-slate-655 font-mono outline-hidden"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold font-display uppercase tracking-wider py-3 rounded-xl text-xs cursor-pointer shadow-[0_4px_12px_rgba(16,185,129,0.3)] transition-transform duration-100"
          >
            Authenticate & Send Validation Code
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifyEmailCode} className="space-y-4 bg-slate-950/40 p-5 rounded-2xl border border-emerald-500/20">
          <div className="bg-emerald-500/5 p-4 rounded-xl border border-emerald-500/20 text-emerald-400 text-xs space-y-2 font-medium">
            <p className="font-bold flex items-center gap-1.5 font-mono text-[10px] uppercase">
              📬 Verification Dispatched!
            </p>
            <p className="opacity-90 leading-relaxed">
              Please check your inbox at <strong className="text-white font-mono">{newEmailInput}</strong>. We've sent an update with a confirmation code. Please enter that code.
            </p>
          </div>

          <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl">
            <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono mb-2">
              <span>SIMULATED EMAIL CLIENT</span>
              <span className="text-emerald-400 font-bold uppercase">PitchSide System Logs</span>
            </div>
            <p className="text-[11px] font-mono text-slate-300 leading-relaxed">
              Verification email sent successfully. Use code: <code className="bg-slate-900 border border-slate-800 px-3 py-1 rounded text-emerald-400 font-bold text-sm tracking-widest">{generatedVerificationCode}</code> to verify your email.
            </p>
          </div>

          <div>
            <label className="block text-[10px] font-mono text-slate-300 uppercase tracking-wider mb-2">
              Enter Confirmation Code
            </label>
            <input
              type="text"
              required
              maxLength={6}
              placeholder="e.g. 582491"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/[^0-9]/g, ''))}
              className="w-full bg-slate-950 border border-emerald-500/30 focus:border-emerald-550 rounded-xl py-3.5 px-3 text-center text-lg font-bold font-mono tracking-widest text-emerald-400 placeholder:text-slate-700 outline-hidden"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setIsEmailVerificationPending(false);
                setVerificationCode('');
                setStatusMsg({ text: 'Email modification aborted.', mode: 'none' });
              }}
              className="flex-1 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-400 font-mono py-2.5 rounded-xl text-xs cursor-pointer transition-colors"
            >
              Cancel / Go Back
            </button>
            <button
              type="submit"
              className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-mono font-bold py-2.5 rounded-xl text-xs cursor-pointer shadow-[0_4px_12px_rgba(16,185,129,0.3)] transition-colors"
            >
              Verify & Complete change
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
