/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { Award, CheckCircle, Info, Shield, HelpCircle, XCircle } from 'lucide-react';

interface RulesInfoProps {
  onClose?: () => void;
}

export default function RulesInfo({ onClose }: RulesInfoProps) {
  return (
    <motion.div 
      layoutId="nav-rules-btn"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 p-6 shadow-2xl text-slate-100 max-w-4xl mx-auto my-4 overflow-hidden relative"
    >
      {onClose && (
        <button
          id="close-rules-btn"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800 p-2 rounded-full cursor-pointer transition-colors"
        >
          <XCircle className="w-6 h-6" />
        </button>
      )}

      <div className="flex items-center gap-3 mb-6 border-b border-slate-800 pb-4">
        <Award className="w-8 h-8 text-yellow-400 animate-pulse" />
        <div>
          <h2 className="text-2xl font-bold font-display tracking-tight text-white">Scoring Rules & Guidelines</h2>
          <p className="text-xs text-slate-400 font-mono">PITCH SIDE PREDICTOR SYSTEM</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Football Rules Card */}
        <div className="p-5 bg-slate-950/40 rounded-xl border border-blue-900/30 hover:border-blue-800/40 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="p-2 bg-blue-500/10 rounded-lg text-blue-400 font-bold text-sm">FT</span>
              <h3 className="text-lg font-bold font-display text-blue-300">Football Predictions</h3>
            </div>
            <p className="text-sm text-slate-300 mb-4 font-sans leading-relaxed">
              Football scores are based heavily on accuracy. Points are distributed across exact matching, goal difference margins, and simple outcomes:
            </p>

            <div className="space-y-3.5 mb-6">
              <div className="flex items-start gap-3">
                <div className="w-10 h-6 shrink-0 bg-emerald-500/20 text-emerald-400 font-mono text-xs font-bold flex items-center justify-center rounded-sm">5 pts</div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Correct Exact Scoreline</h4>
                  <p className="text-xs text-slate-400">Guessing the exact final scoreline. E.g., predicted 2–0 when results are 2–0.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-6 shrink-0 bg-blue-500/20 text-blue-400 font-mono text-xs font-bold flex items-center justify-center rounded-sm">3 pts</div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Correct Outcome + Goal Margin</h4>
                  <p className="text-xs text-slate-400 font-sans">Correct result (win/draw/loss) AND goal margin but different scores. E.g., predicted 3–1 when actual is 2–0.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-6 shrink-0 bg-slate-500/30 text-slate-300 font-mono text-xs font-bold flex items-center justify-center rounded-sm">2 pts</div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Correct Winner / Incorrect Margin</h4>
                  <p className="text-xs text-slate-400">Picking the correct outcome but with a different margin. E.g., predicted 1–0 when actual result is 3–0.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-6 shrink-0 bg-red-500/20 text-red-400 font-mono text-xs font-bold flex items-center justify-center rounded-sm">0 pts</div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Incorrect Match Outcome</h4>
                  <p className="text-xs text-slate-400">Predicting the wrong winner or incorrectly predicting a draw.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-blue-950/20 p-3 rounded-lg border border-blue-500/10 text-xs text-blue-300 font-sans flex items-start gap-2">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <span>Draws with matching margins (e.g., predicting 1-1 and result is 2-2) qualify for the 3 points bracket.</span>
          </div>
        </div>

        {/* Rugby Rules Card */}
        <div className="p-5 bg-slate-950/40 rounded-xl border border-amber-950/30 hover:border-amber-800/40 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="p-2 bg-amber-500/10 rounded-lg text-amber-400 font-bold text-sm">RU</span>
              <h3 className="text-lg font-bold font-display text-amber-300">Rugby Predictions</h3>
            </div>
            <p className="text-sm text-slate-300 mb-4 font-sans leading-relaxed">
              Rugby requires forecasting the winning side and their specific margin of victory, rewarding predictions closest to the actual match dynamics:
            </p>

            <div className="space-y-3.5 mb-6">
              <div className="flex items-start gap-3">
                <div className="w-10 h-6 shrink-0 bg-emerald-500/20 text-emerald-400 font-mono text-xs font-bold flex items-center justify-center rounded-sm">5 pts</div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Correct Winner + Exact Margin</h4>
                  <p className="text-xs text-slate-400">Picking correct winner and perfectly guessing the winning margin of points.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-6 shrink-0 bg-amber-500/20 text-amber-400 font-mono text-xs font-bold flex items-center justify-center rounded-sm">3 pts</div>
                <div>
                  <h4 className="text-sm font-semibold text-white font-sans">Correct Winner + Margin (±3 points)</h4>
                  <p className="text-xs text-slate-400">Correct winner with your estimated margin being within 3 points (above/below) the actual margin.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-6 shrink-0 bg-slate-500/30 text-slate-300 font-mono text-xs font-bold flex items-center justify-center rounded-sm">1 pt</div>
                <div>
                  <h4 className="text-sm font-semibold text-white font-sans">Correct Winner + Margin (±5 points)</h4>
                  <p className="text-xs text-slate-400">Correct winner with your estimated margin being within 5 points (above/below) the actual margin.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-6 shrink-0 bg-red-500/20 text-red-400 font-mono text-xs font-bold flex items-center justify-center rounded-sm">0 pts</div>
                <div>
                  <h4 className="text-sm font-semibold text-white font-sans">Incorrect Outcome or Margin  &gt; 5 pts</h4>
                  <p className="text-xs text-slate-400">Predicting the wrong match winner, or guessing the correct winner but margin is off by more than 5 points.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-amber-950/20 p-3 rounded-lg border border-amber-500/15 text-xs text-amber-300 font-sans flex items-start gap-2">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <span>If the outcome doesn't match or the guessed margin error exceeds 5 points, 0 points are assigned.</span>
          </div>
        </div>
      </div>

      {/* Accuracy & Calendar Year Tracking Section */}
      <div className="mt-6 p-5 bg-slate-950/40 rounded-xl border border-slate-800 text-sm">
        <h3 className="text-base font-bold font-display text-white mb-2.5 flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-indigo-400" />
          Accuracy & Calendar Year Tracking Guidelines
        </h3>
        <div className="text-xs text-slate-300 space-y-2.5 bg-slate-900/50 p-3.5 rounded-lg border border-slate-800">
          <p className="leading-relaxed">🛡️ <strong>This Season's Accuracy:</strong> Calculates the percent of correct predictions ONLY for games played during the current calendar year.</p>
          <p className="leading-relaxed">⏱️ <strong>Cross-Year Kickoffs Rule:</strong> In the event that a single tournament or specific match spans or crosses into two calendar years, the game is officially counted under the calendar year in which it initially kicked off.</p>
          <p className="leading-relaxed">👑 <strong>Lifetime Accuracy:</strong> Displays the comprehensive historical correctness rate across all prediction entries submitted and played over your entire profile duration.</p>
        </div>
      </div>

      <div className="mt-8 pt-4 border-t border-slate-800 text-center text-xs text-slate-500 font-mono flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 justify-center">
          <Shield className="w-4 h-4 text-slate-400" />
          <span>Fair Play Guarantee: Scoring code runs server-side on submission</span>
        </div>
        <div>Version 1.2.0 (Stable Simulation)</div>
      </div>
    </motion.div>
  );
}
