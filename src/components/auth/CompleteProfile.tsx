/**
 * Blocking username selection for OAuth / incomplete profiles.
 */
import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import { AtSign, Loader2, Check } from "lucide-react";
import type { UserProfile } from "../../types";
import { supabase } from "../../supabase";
import AuthCard, { AuthError } from "./AuthCard";
import {
  USERNAME_MAX,
  normalizeUsername,
  validateUsernameFormat,
} from "../../lib/oauthProfile";

type Props = {
  user: UserProfile;
  onComplete: (updated: UserProfile) => void;
};

async function isUsernameTaken(
  username: string,
  excludeUserId: string,
): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .ilike("username", username)
    .neq("id", excludeUserId)
    .limit(1);
  if (error) {
    console.error("[CompleteProfile] username check failed", error);
    throw new Error("Could not verify username availability. Try again.");
  }
  return (data?.length ?? 0) > 0;
}

/** True only when an authenticated profile has no real username yet. */
export function needsUsername(profile: UserProfile | null | undefined): boolean {
  if (!profile) return false;
  const u = profile.nickname?.trim();
  if (!u) return true;
  if (u.startsWith("freed_nick_")) return true;
  return false;
}

export default function CompleteProfile({ user, onComplete }: Props) {
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [availableHint, setAvailableHint] = useState<
    "idle" | "checking" | "ok" | "taken"
  >("idle");

  useEffect(() => {
    const u = normalizeUsername(username);
    if (!u || validateUsernameFormat(u)) {
      setAvailableHint("idle");
      return;
    }
    let cancelled = false;
    setAvailableHint("checking");
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const taken = await isUsernameTaken(u, user.id);
          if (cancelled) return;
          setAvailableHint(taken ? "taken" : "ok");
        } catch {
          if (!cancelled) setAvailableHint("idle");
        }
      })();
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [username, user.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const u = normalizeUsername(username);
    const formatErr = validateUsernameFormat(u);
    if (formatErr) {
      setError(formatErr);
      return;
    }

    setSaving(true);
    try {
      const taken = await isUsernameTaken(u, user.id);
      if (taken) {
        setError("That username is already taken.");
        setAvailableHint("taken");
        return;
      }

      if (!supabase) {
        onComplete({ ...user, nickname: u });
        return;
      }

      const { error: updateErr } = await supabase
        .from("profiles")
        .update({ username: u })
        .eq("id", user.id);

      if (updateErr) {
        if (/unique|duplicate/i.test(updateErr.message)) {
          setError("That username is already taken.");
          setAvailableHint("taken");
          return;
        }
        throw updateErr;
      }

      const updated: UserProfile = { ...user, nickname: u };
      try {
        localStorage.setItem("pitchside_logged_in", JSON.stringify(updated));
      } catch {
        /* ignore */
      }
      onComplete(updated);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not save username. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center py-6">
      <AuthCard>
        <div className="mb-5 text-center">
          <h1 className="text-lg font-display font-extrabold text-white tracking-tight">
            Choose a Username
          </h1>
          <p className="mt-1.5 text-xs text-slate-400 font-sans leading-relaxed">
            This is how you appear on leaderboards and in leagues. You can&apos;t
            change this later easily — pick carefully.
          </p>
        </div>

        {error ? <AuthError message={error} /> : null}

        <motion.form
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          <div>
            <label
              htmlFor="complete-username"
              className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 font-mono"
            >
              Username / Nickname
            </label>
            <div className="relative">
              <AtSign className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                id="complete-username"
                type="text"
                autoComplete="username"
                autoFocus
                maxLength={USERNAME_MAX}
                placeholder="e.g. SidelineSam"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-950/60 border border-slate-800 focus:border-emerald-500 rounded-lg py-2 pl-10 pr-10 text-sm text-white placeholder:text-slate-600 outline-none transition-colors"
              />
              {availableHint === "checking" ? (
                <Loader2 className="absolute right-3 top-2.5 h-4 w-4 text-slate-500 animate-spin" />
              ) : availableHint === "ok" ? (
                <Check className="absolute right-3 top-2.5 h-4 w-4 text-emerald-400" />
              ) : null}
            </div>
            <p className="mt-1.5 text-[10px] font-mono text-slate-500">
              3–20 characters · letters, numbers, underscores
            </p>
            {availableHint === "taken" ? (
              <p className="mt-1 text-[10px] font-mono text-rose-400">
                Username already taken
              </p>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={saving || availableHint === "taken"}
            className="group relative w-full overflow-hidden bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed active:translate-y-px transition-all text-slate-950 font-semibold font-display tracking-wide rounded-lg py-2.5 text-xs uppercase flex items-center justify-center gap-1.5 cursor-pointer shadow-[0_4px_12px_rgba(16,185,129,0.35)]"
          >
            {saving ? "Saving…" : "Continue"}
          </button>
        </motion.form>
      </AuthCard>
    </div>
  );
}
