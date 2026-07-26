import React, { useState } from "react";
import { supabase, isSupabaseConfigured } from "../../supabase";

function GoogleIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.6h5.1c-.2 1.2-.9 2.3-1.9 3l3.1 2.4c1.8-1.7 2.9-4.1 2.9-7 0-.7-.1-1.3-.2-1.9H12z"
      />
      <path
        fill="#34A853"
        d="M6.6 14.3l-.8.6-2.6 2C4.6 19.7 8 22 12 22c2.7 0 5-.9 6.7-2.4l-3.1-2.4c-.9.6-2 .9-3.6.9-2.8 0-5.1-1.9-6-4.4z"
      />
      <path
        fill="#4A90E2"
        d="M3.2 7.1C2.4 8.7 2 10.3 2 12s.4 3.3 1.2 4.9l3.4-2.6C6.2 13.4 6 12.7 6 12s.2-1.4.6-2.3L3.2 7.1z"
      />
      <path
        fill="#FBBC05"
        d="M12 6c1.5 0 2.8.5 3.8 1.5l2.8-2.8C16.9 3.1 14.7 2 12 2 8 2 4.6 4.3 3.2 7.1l3.4 2.6C7 8 9.2 6 12 6z"
      />
    </svg>
  );
}

const BTN =
  "w-full inline-flex items-center justify-center gap-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 py-2.5 text-xs font-semibold font-display tracking-wide cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

type Props = {
  onError?: (message: string) => void;
};

/** Google OAuth only — Apple sign-in is not offered. */
export default function OAuthButtons({ onError }: Props) {
  const [loading, setLoading] = useState(false);

  const startGoogle = async () => {
    onError?.("");
    if (!isSupabaseConfigured() || !supabase) {
      onError?.("Sign-in is not configured. Please try email login.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Google sign-in failed. Please try again.";
      onError?.(message);
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3 pt-1">
      <div className="relative flex items-center gap-3 py-1">
        <div className="h-px flex-1 bg-slate-800" />
        <span className="text-[10px] font-medium tracking-wide text-slate-500">
          Or continue with
        </span>
        <div className="h-px flex-1 bg-slate-800" />
      </div>

      <button
        type="button"
        disabled={loading}
        onClick={() => void startGoogle()}
        className={BTN}
      >
        <GoogleIcon />
        {loading ? "Redirecting…" : "Continue with Google"}
      </button>
    </div>
  );
}
