import React from 'react';
import { ShieldAlert } from 'lucide-react';

interface OAuthAccountAlertProps {
  title: string;
  message: string;
}

/** Branded notice when email/password settings are unavailable for OAuth accounts. */
export const OAuthAccountAlert: React.FC<OAuthAccountAlertProps> = ({
  title,
  message,
}) => {
  return (
    <div
      role="status"
      className="animate-fade-in rounded-2xl border border-emerald-500/20 bg-slate-950/40 p-5 shadow-[inset_0_1px_0_rgba(16,185,129,0.08)]"
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-2.5 text-emerald-400">
          <ShieldAlert className="h-5 w-5" />
        </div>
        <div className="min-w-0 space-y-2">
          <h4 className="text-sm font-bold font-mono uppercase tracking-wider text-emerald-300">
            {title}
          </h4>
          <p className="text-xs leading-relaxed text-slate-300 font-sans">{message}</p>
        </div>
      </div>
    </div>
  );
};
