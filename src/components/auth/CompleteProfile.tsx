/**
 * Blocking profile completion for OAuth / incomplete profiles
 * (username, surname fallback, and mandatory compliance).
 */
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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

function needsSurname(profile: UserProfile | null | undefined): boolean {
  if (!profile) return false;
  return !profile.surname?.trim();
}

function needsCompliance(profile: UserProfile | null | undefined): boolean {
  if (!profile) return false;
  return !profile.agreedToTerms;
}

/** Username, surname, and/or terms still required before onboarding / dashboard. */
export function needsCompleteProfile(
  profile: UserProfile | null | undefined,
): boolean {
  if (!profile) return false;
  return (
    needsUsername(profile) ||
    needsSurname(profile) ||
    needsCompliance(profile)
  );
}

export default function CompleteProfile({ user, onComplete }: Props) {
  const requireUsername = needsUsername(user);
  const requireSurname = needsSurname(user);

  const [username, setUsername] = useState("");
  const [surname, setSurname] = useState(user.surname?.trim() ?? "");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [availableHint, setAvailableHint] = useState<
    "idle" | "checking" | "ok" | "taken"
  >("idle");

  useEffect(() => {
    if (!requireUsername) {
      setAvailableHint("idle");
      return;
    }
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
  }, [username, user.id, requireUsername]);

  const usernameReady = useMemo(() => {
    if (!requireUsername) return true;
    const u = normalizeUsername(username);
    if (!u || validateUsernameFormat(u)) return false;
    return availableHint === "ok";
  }, [requireUsername, username, availableHint]);

  const surnameReady = !requireSurname || Boolean(surname.trim());
  const canSubmit =
    !saving &&
    !signingOut &&
    usernameReady &&
    surnameReady &&
    acceptedTerms &&
    ageConfirmed &&
    availableHint !== "taken";

  const handleCancelAndSignOut = async () => {
    if (saving || signingOut) return;
    setSigningOut(true);
    setError("");
    setSaving(false);
    setUsername("");
    setSurname("");
    setAcceptedTerms(false);
    setAgeConfirmed(false);
    setAvailableHint("idle");
    try {
      localStorage.removeItem("pitchside_logged_in");
    } catch {
      /* ignore */
    }
    try {
      if (!supabase) {
        setError("Could not sign out. Please refresh the page.");
        setSigningOut(false);
        return;
      }
      await supabase.auth.signOut();
      // App's SIGNED_OUT handler clears session and returns to Login.
    } catch (err) {
      console.warn("[CompleteProfile] signOut failed:", err);
      setError("Could not sign out. Please try again.");
      setSigningOut(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!acceptedTerms || !ageConfirmed) {
      setError("Please accept the terms and confirm your age to continue.");
      return;
    }

    const surnameValue = surname.trim();
    if (requireSurname && !surnameValue) {
      setError("Please enter your last name / surname.");
      return;
    }

    let usernameValue = user.nickname?.trim() ?? "";
    if (requireUsername) {
      usernameValue = normalizeUsername(username);
      const formatErr = validateUsernameFormat(usernameValue);
      if (formatErr) {
        setError(formatErr);
        return;
      }
    }

    setSaving(true);
    try {
      if (requireUsername) {
        const taken = await isUsernameTaken(usernameValue, user.id);
        if (taken) {
          setError("That username is already taken.");
          setAvailableHint("taken");
          return;
        }
      }

      const nowIso = new Date().toISOString();
      const patch: Record<string, unknown> = {
        age_confirmed_13: true,
        terms_accepted_at: nowIso,
        privacy_accepted_at: nowIso,
      };
      if (requireUsername) patch.username = usernameValue;
      if (requireSurname) patch.surname = surnameValue;

      if (!supabase) {
        onComplete({
          ...user,
          nickname: usernameValue,
          surname: requireSurname ? surnameValue : user.surname,
          agreedToTerms: true,
        });
        return;
      }

      const { error: updateErr } = await supabase
        .from("profiles")
        .update(patch)
        .eq("id", user.id);

      if (updateErr) {
        if (/unique|duplicate/i.test(updateErr.message)) {
          setError("That username is already taken.");
          setAvailableHint("taken");
          return;
        }
        throw updateErr;
      }

      const updated: UserProfile = {
        ...user,
        nickname: usernameValue,
        surname: requireSurname ? surnameValue : user.surname,
        agreedToTerms: true,
      };
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
          : "Could not save your profile. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  const title = requireUsername
    ? "Complete your profile"
    : requireSurname
      ? "Almost there"
      : "Before you continue";

  return (
    <div className="flex-1 flex items-center justify-center py-6">
      <AuthCard>
        <div className="mb-5 text-center">
          <h1 className="text-lg font-display font-extrabold text-white tracking-tight">
            {title}
          </h1>
          <p className="mt-1.5 text-xs text-slate-400 font-sans leading-relaxed">
            {requireUsername
              ? "Choose how you appear on leaderboards, then confirm the essentials below."
              : "We just need a couple of details before you can play."}
          </p>
        </div>

        {error ? <AuthError message={error} /> : null}

        <motion.form
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          {requireUsername ? (
            <div>
              <label
                htmlFor="complete-username"
                className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 font-mono"
              >
                Choose a Username
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
          ) : null}

          {requireSurname ? (
            <div>
              <label
                htmlFor="complete-surname"
                className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 font-mono"
              >
                Last Name / Surname
              </label>
              <input
                id="complete-surname"
                type="text"
                autoComplete="family-name"
                autoFocus={!requireUsername}
                required
                placeholder="e.g. Smith"
                value={surname}
                onChange={(e) => setSurname(e.target.value)}
                className="w-full bg-slate-950/60 border border-slate-800 focus:border-emerald-500 rounded-lg py-2 px-3 text-sm text-white placeholder:text-slate-600 outline-none transition-colors"
              />
            </div>
          ) : null}

          <div className="space-y-3 pt-1">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                id="complete-terms-checkbox"
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 accent-emerald-500 rounded-xs bg-slate-950 border-slate-800"
              />
              <span className="text-xs text-slate-400 leading-normal">
                I accept the{" "}
                <Link
                  to="/terms"
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-400 underline hover:text-emerald-300"
                  onClick={(e) => e.stopPropagation()}
                >
                  Terms of Use
                </Link>{" "}
                and{" "}
                <Link
                  to="/privacy"
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-400 underline hover:text-emerald-300"
                  onClick={(e) => e.stopPropagation()}
                >
                  Privacy Policy
                </Link>
                .
              </span>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                id="complete-age-checkbox"
                type="checkbox"
                checked={ageConfirmed}
                onChange={(e) => setAgeConfirmed(e.target.checked)}
                className="mt-0.5 accent-emerald-500 rounded-xs bg-slate-950 border-slate-800"
              />
              <span className="text-xs text-slate-400 leading-normal">
                I confirm that I am 13 years of age or older.
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="group relative w-full overflow-hidden bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed active:translate-y-px transition-all text-slate-950 font-semibold font-display tracking-wide rounded-lg py-2.5 text-xs uppercase flex items-center justify-center gap-1.5 cursor-pointer shadow-[0_4px_12px_rgba(16,185,129,0.35)]"
          >
            {saving ? "Saving…" : "Continue"}
          </button>

          <button
            type="button"
            disabled={saving || signingOut}
            onClick={() => void handleCancelAndSignOut()}
            className="mt-1 w-full text-center text-xs font-sans text-slate-500 hover:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer py-1"
          >
            {signingOut ? "Signing out…" : "Cancel and return to login"}
          </button>
        </motion.form>
      </AuthCard>
    </div>
  );
}
