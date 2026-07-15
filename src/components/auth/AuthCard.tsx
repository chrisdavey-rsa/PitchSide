/**
 * Shared visual shell for all isolated auth views (login, reset, signup).
 */

import React from 'react';
import PitchSideLogo from '../PitchSideLogo';

interface AuthCardProps {
  children: React.ReactNode;
  /** Optional badge above the title (e.g. "Secure Password Reset"). */
  badge?: React.ReactNode;
  onLogoClick?: () => void;
}

export default function AuthCard({ children, badge, onLogoClick }: AuthCardProps) {
  return (
    <div className="w-full max-w-md mx-auto relative z-10">
      <div className="text-center mb-8">
        <div
          onClick={onLogoClick}
          className={onLogoClick ? 'cursor-pointer inline-block' : 'inline-block'}
          title={onLogoClick ? 'Return to home' : undefined}
        >
          <PitchSideLogo size="lg" autoplay={false} />
        </div>
        <p className="text-xs text-slate-400 font-mono mt-2 uppercase tracking-widest">
          Play. Predict. Prevail.
        </p>
      </div>

      <div className="bg-slate-900/85 backdrop-blur-md rounded-2xl border border-slate-800 p-6 shadow-2xl relative">
        <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-blue-500 via-green-500 to-red-500 rounded-t-2xl" />

        {badge && <div className="mb-5">{badge}</div>}

        {children}
      </div>

      <div className="mt-6 text-center text-xs text-slate-500">
        <span>PitchSide © {new Date().getFullYear()}</span>
      </div>
    </div>
  );
}

/** Reusable alert banners inside auth cards. */
export function AuthError({ message }: { message: string }) {
  return (
    <div className="mb-4 p-3 bg-red-950/40 border border-red-500/30 rounded-lg text-xs text-red-300 leading-relaxed">
      {message}
    </div>
  );
}

export function AuthSuccess({ message }: { message: string }) {
  return (
    <div className="mb-4 p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-lg text-xs text-emerald-300 leading-relaxed">
      {message}
    </div>
  );
}
