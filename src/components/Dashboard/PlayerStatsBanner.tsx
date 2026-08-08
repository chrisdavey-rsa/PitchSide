import React from "react";
import { motion } from "motion/react";
import { Flame, Ticket } from "lucide-react";
import { UserProfile } from "../../types";

interface PlayerStatsBannerProps {
  user: UserProfile;
  userPoints: number;
  /** Base-points accuracy, e.g. "45%". */
  accuracyPercent: string;
  perfectPredictions: number;
  weeklyStreak: number;
  isUserInAnyLeague: boolean;
}

function weeklyStreakClasses(streak: number): string {
  if (streak >= 10) return "streak-tier-elite";
  if (streak >= 5) return "streak-tier-blue";
  if (streak >= 3) return "text-emerald-400";
  return "text-slate-300";
}

export default function PlayerStatsBanner({
  user,
  userPoints,
  accuracyPercent,
  perfectPredictions,
  weeklyStreak,
  isUserInAnyLeague,
}: PlayerStatsBannerProps) {
  const streakLabel = String(weeklyStreak);
  const goldenTickets = Math.max(0, Number(user.goldenTickets ?? 0));
  const hasGoldenTicket = goldenTickets > 0;
  const ticketLabel =
    goldenTickets === 1 ? "1 Ticket" : `${goldenTickets} Tickets`;

  return (
    <motion.div
      transition={{ duration: 0.5, ease: "easeInOut" }}
      className={`${
        isUserInAnyLeague ? "md:col-span-2" : ""
      } rounded-2xl p-6 flex flex-col justify-between relative z-0 overflow-hidden backdrop-blur-xs ${
        hasGoldenTicket
          ? "bg-gradient-to-r from-yellow-900/40 via-yellow-700/20 to-slate-900 border border-yellow-500/50 shadow-[0_0_28px_rgba(234,179,8,0.12)]"
          : "bg-slate-900/60 border border-slate-800/70"
      }`}
    >
      {hasGoldenTicket ? (
        <>
          <div className="pointer-events-none absolute top-0 right-0 w-40 h-40 bg-yellow-400/10 rounded-full blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-0 w-36 h-24 bg-amber-600/10 rounded-full blur-2xl" />
          <div
            className="absolute top-3 right-3 sm:top-4 sm:right-4 z-[1] flex items-center gap-1.5 rounded-full border border-yellow-500/45 bg-slate-950/55 px-2.5 py-1 shadow-[0_0_12px_rgba(234,179,8,0.2)]"
            title="Golden Tickets held — God Mode active"
          >
            <Ticket className="h-3.5 w-3.5 text-yellow-300 -rotate-12" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-yellow-300">
              {ticketLabel}
            </span>
          </div>
        </>
      ) : (
        <>
          <div className="absolute top-0 right-0 w-36 h-36 bg-blue-500/5 rounded-full blur-2xl" />
          <div className="absolute bottom-0 left-0 w-36 h-24 bg-green-500/5 rounded-full blur-2xl" />
        </>
      )}

      <div
        className={`pb-4 border-b ${
          hasGoldenTicket ? "border-yellow-500/25" : "border-slate-800/60"
        }`}
      >
        <div className="flex items-center gap-2 mb-2 sm:mb-1">
          <span
            className={`text-xs font-mono ${
              hasGoldenTicket ? "text-yellow-200/60" : "text-slate-500"
            }`}
          >
            Live Season 1
          </span>
          {hasGoldenTicket ? (
            <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-yellow-400/90">
              God Mode
            </span>
          ) : null}
        </div>

        {/* Mobile: greeting + streak on one row */}
        <div className="flex justify-between items-center gap-3 sm:hidden pr-24">
          <h1 className="text-sm font-extrabold font-display text-white tracking-tight min-w-0">
            <span>Hello, </span>
            <span className="text-slate-300 truncate">{user.nickname}</span>
          </h1>

          <div className="flex items-center gap-1.5 shrink-0">
            <Flame
              className={`w-3.5 h-3.5 ${
                weeklyStreak >= 3 ? "text-orange-400" : "text-slate-500"
              }`}
            />
            <div className="text-right">
              <p className="text-[8px] uppercase font-mono tracking-widest text-slate-500 leading-none">
                Weekly Streak
              </p>
              <p
                className={`text-xs font-black font-display leading-tight ${weeklyStreakClasses(weeklyStreak)}`}
              >
                {streakLabel}
              </p>
            </div>
          </div>
        </div>

        {/* Desktop: greeting left, streak right */}
        <div className="hidden sm:flex sm:flex-row sm:items-center justify-between gap-4 pr-28">
          <h1 className="text-2xl sm:text-3xl font-extrabold font-display text-white tracking-tight flex items-baseline min-w-0">
            <span className="mr-2">Hello,</span>
            <span className="font-extrabold font-display text-2xl sm:text-3xl text-slate-300 truncate">
              {user.nickname}
            </span>
          </h1>

          <div className="flex items-center gap-2.5 sm:text-right shrink-0">
            <div
              className={`p-2 rounded-xl border ${
                hasGoldenTicket
                  ? "bg-yellow-950/40 border-yellow-500/30"
                  : "bg-slate-950/50 border-slate-800/60"
              }`}
            >
              <Flame
                className={`w-4 h-4 ${
                  weeklyStreak >= 3 ? "text-orange-400" : "text-slate-500"
                }`}
              />
            </div>
            <div>
              <p className="text-[9px] uppercase font-mono tracking-widest text-slate-500">
                Weekly Streak
              </p>
              <p
                className={`text-lg font-black font-display leading-tight ${weeklyStreakClasses(weeklyStreak)}`}
              >
                {streakLabel}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 pt-4 text-center">
        <div
          className={`p-2.5 rounded-xl border flex flex-col justify-center ${
            hasGoldenTicket
              ? "bg-slate-950/50 border-yellow-500/25"
              : "bg-slate-950/40 border-slate-800/60"
          }`}
        >
          <span className="text-2xl font-black font-display text-emerald-400 text-transparent bg-clip-text bg-linear-to-r from-emerald-400 to-teal-400">
            {userPoints}
          </span>
          <p className="text-[9px] text-slate-500 uppercase font-mono tracking-widest mt-0.5">
            Total Points
          </p>
        </div>
        <div
          className={`p-2.5 rounded-xl border flex flex-col justify-center ${
            hasGoldenTicket
              ? "bg-slate-950/50 border-yellow-500/25"
              : "bg-slate-950/40 border-slate-800/60"
          }`}
        >
          <span className="text-2xl font-black font-display text-blue-400">
            {accuracyPercent}
          </span>
          <p className="text-[9px] text-slate-500 uppercase font-mono tracking-widest mt-0.5">
            Accuracy %
          </p>
        </div>
        <div
          className={`p-2.5 rounded-xl border flex flex-col justify-center ${
            hasGoldenTicket
              ? "bg-slate-950/50 border-yellow-500/25"
              : "bg-slate-950/40 border-slate-800/60"
          }`}
        >
          <span className="text-2xl font-black font-display text-yellow-400">
            {perfectPredictions}
          </span>
          <p className="text-[9px] text-slate-500 uppercase font-mono tracking-widest mt-0.5">
            Perfect Predictions
          </p>
        </div>
      </div>
    </motion.div>
  );
}
