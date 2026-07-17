import React from "react";
import { motion } from "motion/react";
import { Flame } from "lucide-react";
import { UserProfile } from "../../types";

interface WelcomeHeaderProps {
  user: UserProfile;
  userPoints: number;
  totalPredicted: number;
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

export default function WelcomeHeader({
  user,
  userPoints,
  totalPredicted,
  perfectPredictions,
  weeklyStreak,
  isUserInAnyLeague,
}: WelcomeHeaderProps) {
  const streakLabel = String(weeklyStreak);

  return (
    <motion.div
      transition={{ duration: 0.5, ease: "easeInOut" }}
      className={`${
        isUserInAnyLeague ? "md:col-span-2" : ""
      } bg-slate-900/60 rounded-2xl border border-slate-800/70 p-6 flex flex-col justify-between relative z-0 overflow-hidden backdrop-blur-xs`}
    >
      <div className="absolute top-0 right-0 w-36 h-36 bg-blue-500/5 rounded-full blur-2xl" />
      <div className="absolute bottom-0 left-0 w-36 h-24 bg-green-500/5 rounded-full blur-2xl" />

      <div className="pb-4 border-b border-slate-800/60">
        <div className="flex items-center gap-2 mb-2 sm:mb-1">
          <span className="text-slate-500 text-xs font-mono">Live Season 1</span>
        </div>

        {/* Mobile: greeting + streak on one row */}
        <div className="flex justify-between items-center gap-3 sm:hidden">
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
        <div className="hidden sm:flex sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-2xl sm:text-3xl font-extrabold font-display text-white tracking-tight flex items-baseline min-w-0">
            <span className="mr-2">Hello,</span>
            <span className="font-extrabold font-display text-2xl sm:text-3xl text-slate-300 truncate">
              {user.nickname}
            </span>
          </h1>

          <div className="flex items-center gap-2.5 sm:text-right shrink-0">
            <div className="p-2 rounded-xl bg-slate-950/50 border border-slate-800/60">
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
        <div className="p-2.5 bg-slate-950/40 rounded-xl border border-slate-800/60 flex flex-col justify-center">
          <span className="text-2xl font-black font-display text-emerald-400 text-transparent bg-clip-text bg-linear-to-r from-emerald-400 to-teal-400">
            {userPoints}
          </span>
          <p className="text-[9px] text-slate-500 uppercase font-mono tracking-widest mt-0.5">
            Total Points
          </p>
        </div>
        <div className="p-2.5 bg-slate-950/40 rounded-xl border border-slate-800/60 flex flex-col justify-center">
          <span className="text-2xl font-black font-display text-blue-400">
            {totalPredicted}
          </span>
          <p className="text-[9px] text-slate-500 uppercase font-mono tracking-widest mt-0.5">
            Guesses Locked
          </p>
        </div>
        <div className="p-2.5 bg-slate-950/40 rounded-xl border border-slate-800/60 flex flex-col justify-center">
          <span className="text-2xl font-black font-display text-yellow-400">
            {perfectPredictions}
          </span>
          <p className="text-[9px] text-slate-500 uppercase font-mono tracking-widest mt-0.5">
            Perfect Hits
          </p>
        </div>
      </div>
    </motion.div>
  );
}
