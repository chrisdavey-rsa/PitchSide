import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "motion/react";
import { Users, LogIn, UserPlus, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import type { UserProfile, League } from "../types";
import { dbFetchLeagueById, dbJoinLeague } from "../supabase";
import { isGlobalLeague } from "../lib/leaguesConfig";
import {
  storePendingInvite,
  clearPendingInvite,
} from "../lib/pendingInvite";
import PitchSideLogo from "../components/PitchSideLogo";

interface JoinLeagueProps {
  currentUser: UserProfile | null;
  onRequestAuth: (mode: "login" | "signup") => void;
  onJoined: (leagueId: string) => void;
}

export default function JoinLeague({
  currentUser,
  onRequestAuth,
  onJoined,
}: JoinLeagueProps) {
  const { leagueId = "" } = useParams<{ leagueId: string }>();
  const navigate = useNavigate();

  const [league, setLeague] = useState<League | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!leagueId) {
      setError("This invite link is missing a league id.");
      setLoading(false);
      return;
    }

    // Keep guests on-track through signup / login.
    if (!currentUser) {
      storePendingInvite(leagueId);
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    dbFetchLeagueById(leagueId)
      .then((row) => {
        if (cancelled) return;
        if (!row) {
          setError("This league invite is invalid or no longer exists.");
          setLeague(null);
        } else {
          setLeague(row);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Couldn't load this league. Check your connection and try again.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [leagueId, currentUser]);

  const alreadyMember =
    !!currentUser && !!league && league.members.includes(currentUser.id);

  const handleJoin = async () => {
    if (!currentUser || !league) return;

    if (alreadyMember) {
      clearPendingInvite();
      onJoined(league.id);
      navigate("/");
      return;
    }

    const memberCap = league.maxPlayers ?? league.maxParticipants;
    if (
      !isGlobalLeague(league.id) &&
      memberCap != null &&
      league.members.length >= memberCap
    ) {
      setError(`This league is full (max ${memberCap} players).`);
      return;
    }

    setJoining(true);
    setError(null);
    setStatus(null);

    try {
      await dbJoinLeague(league.id, currentUser.id);
      clearPendingInvite();
      setStatus(`You're in — welcome to ${league.name}!`);
      window.setTimeout(() => {
        onJoined(league.id);
        navigate("/");
      }, 700);
    } catch (err: unknown) {
      console.error("[JoinLeague] join failed", err);
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code?: string }).code)
          : "";
      const message = err instanceof Error ? err.message : String(err);
      // Idempotent: already a member (unique constraint) → treat as success.
      if (code === "23505" || /duplicate|unique|already/i.test(message)) {
        clearPendingInvite();
        onJoined(league.id);
        navigate("/");
        return;
      }
      setError("Couldn't join this league. Please try again.");
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md relative overflow-hidden"
      >
        <div className="absolute -top-16 -right-16 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-6">
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="cursor-pointer"
              aria-label="Back to PitchSide"
            >
              <PitchSideLogo size="md" autoplay={false} />
            </button>
          </div>

          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 mb-1">
              <Users className="w-5 h-5 text-emerald-400" />
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold font-display text-white tracking-tight">
              League Invite
            </h1>
            <p className="text-xs text-slate-400 font-sans">
              Someone wants you on their PitchSide squad.
            </p>
          </div>

          {loading ? (
            <div className="flex flex-col items-center gap-3 py-8 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
              <span className="text-xs font-mono uppercase tracking-widest">
                Loading invite…
              </span>
            </div>
          ) : error && !league ? (
            <div className="rounded-xl border border-red-500/25 bg-red-950/30 p-4 flex gap-3 text-sm text-red-300">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          ) : league ? (
            <div className="space-y-5">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5 text-center space-y-1.5">
                <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                  You have been invited to join
                </p>
                <h2 className="text-lg font-extrabold font-display text-white">
                  {league.name}
                </h2>
                <p className="text-[11px] text-slate-400 font-mono">
                  Created by {league.creatorName || "a PitchSide player"}
                  {league.members.length > 0
                    ? ` · ${league.members.length} member${league.members.length === 1 ? "" : "s"}`
                    : ""}
                </p>
              </div>

              {error && (
                <div className="rounded-xl border border-red-500/25 bg-red-950/30 p-3 text-xs text-red-300 flex gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              {status && (
                <div className="rounded-xl border border-emerald-500/25 bg-emerald-950/30 p-3 text-xs text-emerald-300 flex gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  {status}
                </div>
              )}

              {!currentUser ? (
                <div className="space-y-3">
                  <p className="text-xs text-slate-400 text-center">
                    Sign in or create an account to accept this invite. We&apos;ll
                    bring you straight back here.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      storePendingInvite(league.id);
                      onRequestAuth("login");
                    }}
                    className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold font-display text-sm py-3 rounded-xl cursor-pointer transition-colors"
                  >
                    <LogIn className="w-4 h-4" />
                    Log in to join
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      storePendingInvite(league.id);
                      onRequestAuth("signup");
                    }}
                    className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold font-display text-sm py-3 rounded-xl border border-slate-700 cursor-pointer transition-colors"
                  >
                    <UserPlus className="w-4 h-4" />
                    Create account
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleJoin}
                  disabled={joining}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold font-display text-sm py-3.5 rounded-xl cursor-pointer transition-colors"
                >
                  {joining ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Users className="w-4 h-4" />
                  )}
                  {alreadyMember ? "Open League" : "Join League"}
                </button>
              )}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => navigate("/")}
            className="w-full text-center text-[10px] font-mono uppercase tracking-widest text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
          >
            Back to PitchSide
          </button>
        </div>
      </motion.div>
    </div>
  );
}
