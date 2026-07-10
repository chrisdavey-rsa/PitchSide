/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { motion } from "motion/react";
import { UserProfile } from "../../types";

interface WelcomeHeaderProps {
  user: UserProfile;
  userPoints: number;
  totalPredicted: number;
  perfectPredictions?: number;
  seasonalAccuracy?: number;
  lifetimeAccuracy?: number;
  isUserInAnyLeague: boolean;
}

export default function WelcomeHeader({
  user,
  userPoints,
  totalPredicted,
  perfectPredictions = 0,
  seasonalAccuracy = 0,
  lifetimeAccuracy = 0,
  isUserInAnyLeague,
}: WelcomeHeaderProps) {
  const currentCalendarYear = new Date().getFullYear();

  return (
    <motion.div
      transition={{ duration: 0.5, ease: "easeInOut" }}
      className={`${
        isUserInAnyLeague ? "md:col-span-2" : ""
      } bg-slate-900/60 rounded-2xl border border-slate-800/70 p-6 flex flex-col justify-between relative overflow-hidden backdrop-blur-xs min-h-[180px]`}
    >
      <div className="absolute top-0 right-0 w-36 h-36 bg-blue-500/5 rounded-full blur-2xl" />
      <div className="absolute bottom-0 left-0 w-36 h-24 bg-green-500/5 rounded-full blur-2xl" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/60">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-slate-500 text-xs font-mono">
              Live Season 1
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-display text-white tracking-tight flex items-baseline">
            <span className="mr-2">Hello,</span>
            <span className="font-extrabold font-display text-2xl sm:text-3xl text-slate-300">
              {user.nickname}
            </span>
          </h1>
        </div>

        {/* Micro Accuracies side-board */}
        <div className="flex flex-col gap-1.5 text-left sm:text-right text-[11px] text-slate-400 font-mono">
          <div className="flex items-center justify-between sm:justify-end gap-3">
            <span className="text-slate-500 font-sans">
              Season's Accuracy ({currentCalendarYear}):
            </span>
            <span className="font-bold text-white font-mono bg-slate-950/60 px-1.5 py-0.5 rounded border border-slate-800/60">
              {seasonalAccuracy}%
            </span>
          </div>
          <div className="flex items-center justify-between sm:justify-end gap-3">
            <span className="text-slate-500 font-sans">Lifetime Accuracy:</span>
            <span className="font-bold text-emerald-400 font-mono bg-slate-950/60 px-1.5 py-0.5 rounded border border-slate-800/60">
              {lifetimeAccuracy}%
            </span>
          </div>
        </div>
      </div>

      {/* Connected Game Record metrics row */}
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
            Guesses Lock
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