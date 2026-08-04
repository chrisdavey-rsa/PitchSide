import React, { useState } from "react";
import { Lock, Shield } from "lucide-react";
import { supabase } from "../../supabase";

type AdminOverrideGateProps = {
  children: React.ReactNode;
  title?: string;
};

/**
 * Extra UI gate before rendering score-override controls.
 * Confirms the signed-in admin's account password via Supabase Auth.
 * Does not replace is_pitchside_admin() — server RPCs still enforce admin.
 */
export default function AdminOverrideGate({
  children,
  title = "Post-match score override",
}: AdminOverrideGateProps) {
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);

  const verifyPassword = async () => {
    if (!password.trim()) {
      setError("Enter your admin password to confirm.");
      return;
    }
    if (!supabase) {
      setError("Database not connected.");
      return;
    }

    setVerifying(true);
    setError("");
    try {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user) {
        throw new Error("Not signed in. Sign in again as an admin.");
      }

      const email = userData.user.email;
      if (!email) {
        throw new Error(
          "This admin account has no email/password login. Use an email account to override scores.",
        );
      }

      const { error: authErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authErr) {
        throw new Error("Incorrect password. Try again.");
      }

      setPassword("");
      setUnlocked(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Password verification failed.");
    } finally {
      setVerifying(false);
    }
  };

  if (unlocked) return <>{children}</>;

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
      <div className="flex items-center gap-2 text-amber-300">
        <Shield className="w-4 h-4" />
        <h4 className="text-xs font-mono font-bold uppercase tracking-wider">
          {title}
        </h4>
      </div>
      <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
        Re-enter your admin account password to edit FT scores and force
        resettlement of Completed Picks.
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Lock className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-500" />
          <input
            type="password"
            value={password}
            autoComplete="current-password"
            disabled={verifying}
            onChange={(e) => {
              setPassword(e.target.value);
              setError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void verifyPassword();
              }
            }}
            placeholder="Admin password"
            className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 pl-8 pr-3 text-xs text-white placeholder:text-slate-600 outline-none focus:border-amber-500/50 disabled:opacity-60"
          />
        </div>
        <button
          type="button"
          disabled={verifying}
          onClick={() => void verifyPassword()}
          className="px-3 py-2 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-200 text-[10px] font-mono font-bold uppercase tracking-wider hover:bg-amber-500/30 cursor-pointer disabled:opacity-60 disabled:cursor-wait"
        >
          {verifying ? "Checking…" : "Confirm"}
        </button>
      </div>
      {error ? (
        <p className="text-[10px] font-mono text-rose-400">{error}</p>
      ) : null}
    </div>
  );
}
