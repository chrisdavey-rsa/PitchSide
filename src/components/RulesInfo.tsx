/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AnimatePresence } from 'motion/react';
import {
  Award,
  Info,
  Shield,
  HelpCircle,
  X,
  LifeBuoy,
  Ghost,
  Ticket,
  Sparkles,
  Users,
  Lock,
  ChevronRight,
} from 'lucide-react';
import { UserProfile } from '../types';
import { useCommunityShieldScheduled } from './events/CommunityShieldEvent';
import { POWER_UPS } from '../data/powerUps';
import PowerUpModal from './powerups/PowerUpModal';
import { btnClose } from '../ui';
import { retainOverlayHistoryDuringTransition } from '../hooks/useOverlayHistory';

interface RulesInfoProps {
  user?: UserProfile | null;
  onClose?: () => void;
}

export default function RulesInfo({ user, onClose }: RulesInfoProps) {
  const communityShieldScheduled = useCommunityShieldScheduled();
  const [activePowerUp, setActivePowerUp] = useState<string | null>(null);

  const handleReturnToDashboard = () => {
    if (!onClose) return;
    // Close back to Dashboard — never history.back() / window.close().
    retainOverlayHistoryDuringTransition();
    onClose();
  };

  return (
    <div
      className="bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 p-6 shadow-2xl text-slate-100 max-w-4xl mx-auto my-4 overflow-hidden relative"
    >
      {onClose && (
        <button
          id="close-rules-btn"
          type="button"
          onClick={handleReturnToDashboard}
          className={`absolute top-4 right-4 z-10 ${btnClose}`}
          title="Return to Dashboard"
        >
          <X className="w-5 h-5" />
        </button>
      )}

      <div className="flex items-center gap-3 mb-6 border-b border-slate-800 pb-4">
        <Award className="w-8 h-8 text-yellow-400" />
        <div>
          <h2 className="text-2xl font-bold font-display tracking-tight text-white">
            PitchSide Player Guide
          </h2>
          <p className="text-xs text-slate-400 font-mono">
            SCORING, LEAGUES & THE FORGIVENESS MECHANIC
          </p>
        </div>
      </div>

      {/* ================= HOW IT WORKS ================= */}
      <div className="mb-8 p-4 bg-slate-950/40 rounded-xl border border-slate-800 text-sm text-slate-300 leading-relaxed">
        <p>
          Welcome to PitchSide. Join or create a <span className="text-white font-semibold">League</span>,
          predict the scorelines of upcoming fixtures, and climb the leaderboard. Points are awarded
          automatically once a match is settled — the closer your prediction, the more you score.
        </p>
      </div>

      {/* ================= CORE SCORING ================= */}
      <h3 className="text-lg font-bold font-display text-white mb-3 flex items-center gap-2">
        <span className="w-1.5 h-5 bg-yellow-400 rounded-full" />
        Core Scoring Mechanics
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Football Rules Card */}
        <div className="p-5 bg-slate-950/40 rounded-xl border border-blue-900/30 hover:border-blue-800/40 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="p-2 bg-blue-500/10 rounded-lg text-blue-400 font-bold text-sm">FT</span>
              <h3 className="text-lg font-bold font-display text-blue-300">Football Predictions</h3>
            </div>
            <p className="text-sm text-slate-300 mb-4 font-sans leading-relaxed">
              Football rewards accuracy — from nailing the exact scoreline down to simply calling
              the right winner:
            </p>

            <div className="space-y-3.5 mb-6">
              <div className="flex items-start gap-3">
                <div className="w-10 h-6 shrink-0 bg-emerald-500/20 text-emerald-400 font-mono text-xs font-bold flex items-center justify-center rounded-sm">5 pts</div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Correct Exact Scoreline</h4>
                  <p className="text-xs text-slate-400">Guessing the exact final scoreline. E.g., predicted 2–0 when result is 2–0.</p>
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
                <div className="w-10 h-6 shrink-0 bg-slate-500/30 text-slate-300 font-mono text-xs font-bold flex items-center justify-center rounded-sm">1 pt</div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Correct Winner / Incorrect Margin</h4>
                  <p className="text-xs text-slate-400">Picking the correct outcome but with a different margin. E.g., predicted 2–0 when the match finished 1–0.</p>
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
              Rugby is all about the <span className="text-white font-semibold">margin</span>. Pick the
              winning side and how close you get to their winning margin decides your points:
            </p>

            <div className="space-y-3.5 mb-6">
              <div className="flex items-start gap-3">
                <div className="w-10 h-6 shrink-0 bg-emerald-500/20 text-emerald-400 font-mono text-xs font-bold flex items-center justify-center rounded-sm">5 pts</div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Correct Winner + Exact Margin</h4>
                  <p className="text-xs text-slate-400">Picking the correct winner and perfectly guessing the winning margin of points.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-6 shrink-0 bg-amber-500/20 text-amber-400 font-mono text-xs font-bold flex items-center justify-center rounded-sm">3 pts</div>
                <div>
                  <h4 className="text-sm font-semibold text-white font-sans">Correct Winner + Margin (±7 points)</h4>
                  <p className="text-xs text-slate-400">Correct winner with your estimated margin within 7 points (above/below) the actual margin.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-6 shrink-0 bg-slate-500/30 text-slate-300 font-mono text-xs font-bold flex items-center justify-center rounded-sm">1 pt</div>
                <div>
                  <h4 className="text-sm font-semibold text-white font-sans">Correct Winner + Margin (±10 points)</h4>
                  <p className="text-xs text-slate-400">Correct winner with your estimated margin within 10 points (above/below) the actual margin.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-6 shrink-0 bg-red-500/20 text-red-400 font-mono text-xs font-bold flex items-center justify-center rounded-sm">0 pts</div>
                <div>
                  <h4 className="text-sm font-semibold text-white font-sans">Incorrect Outcome or Margin &gt; 10 pts</h4>
                  <p className="text-xs text-slate-400">Predicting the wrong winner, or the correct winner but a margin off by more than 10 points.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-amber-950/20 p-3 rounded-lg border border-amber-500/15 text-xs text-amber-300 font-sans flex items-start gap-2">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <span>If the outcome doesn't match or the guessed margin error exceeds 10 points, 0 points are assigned. Note: Rugby has no drops — every game counts.</span>
          </div>
        </div>
      </div>

      {/* ================= FOOTBALL FORGIVENESS MECHANIC ================= */}
      <h3 className="text-lg font-bold font-display text-white mt-8 mb-3 flex items-center gap-2">
        <span className="w-1.5 h-5 bg-emerald-400 rounded-full" />
        The Football Forgiveness Mechanic
      </h3>
      <div className="p-5 bg-slate-950/40 rounded-xl border border-emerald-900/30">
        <div className="flex items-center gap-2 mb-3">
          <LifeBuoy className="w-5 h-5 text-emerald-400" />
          <h4 className="text-base font-bold font-display text-emerald-300">Your Best Results Count — Worst Weeks Are Dropped</h4>
        </div>
        <p className="text-sm text-slate-300 leading-relaxed mb-4">
          Nobody predicts a perfect football season. To keep the leaderboard fair, each football
          competition lets you
          <span className="text-white font-semibold"> drop a number of your worst results</span>. Once
          you've played more games than your drop allowance, your lowest-scoring weeks stop counting
          toward your total — so a couple of bad rounds won't sink your season.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div className="bg-slate-900/60 rounded-lg border border-slate-800 p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-6 h-6 rounded-md bg-emerald-500/15 text-emerald-400 text-xs font-bold flex items-center justify-center">✓</span>
              <span className="text-xs font-bold text-white uppercase font-mono">Best Results</span>
            </div>
            <p className="text-xs text-slate-400">Your kept results — this is your official leaderboard total.</p>
          </div>
          <div className="bg-slate-900/60 rounded-lg border border-slate-800 p-3">
            <div className="flex items-center gap-2 mb-1">
              <Ghost className="w-5 h-5 text-slate-400" />
              <span className="text-xs font-bold text-white uppercase font-mono">Ghost Points</span>
            </div>
            <p className="text-xs text-slate-400">What your score <em>would</em> be if no weeks were dropped. Shown in muted text on the leaderboard.</p>
          </div>
          <div className="bg-slate-900/60 rounded-lg border border-slate-800 p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase">Drops: 4</span>
            </div>
            <p className="text-xs text-slate-400">The badge by your name shows how many drops you still have remaining this sport.</p>
          </div>
        </div>

        <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-3.5">
          <p className="text-xs font-bold text-slate-300 uppercase font-mono mb-2">Football Drop Allowance By Competition</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="bg-slate-950/50 rounded-md p-2 border border-slate-800">
              <div className="text-white font-semibold">Premier League</div>
              <div className="text-emerald-400 font-mono">4 drops</div>
            </div>
            <div className="bg-slate-950/50 rounded-md p-2 border border-slate-800">
              <div className="text-white font-semibold">Championship</div>
              <div className="text-emerald-400 font-mono">6 drops</div>
            </div>
            <div className="bg-slate-950/50 rounded-md p-2 border border-slate-800">
              <div className="text-white font-semibold">Scottish Prem</div>
              <div className="text-emerald-400 font-mono">4 drops</div>
            </div>
            <div className="bg-slate-950/50 rounded-md p-2 border border-slate-800">
              <div className="text-white font-semibold">Other Football</div>
              <div className="text-slate-500 font-mono">0 drops</div>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-2.5 leading-relaxed">
            Long football league seasons grant more forgiveness. Drops only kick in once you've played
            more games than the allowance, so you always keep a full set of results. Rugby has no drops
            — every rugby prediction counts toward your total.
          </p>
        </div>
      </div>

      {/* ================= POWER-UP CHIPS ================= */}
      <h3 className="text-lg font-bold font-display text-white mt-8 mb-3 flex items-center gap-2">
        <span className="w-1.5 h-5 bg-amber-400 rounded-full" />
        Power-Up Chips
      </h3>
      <div className="p-5 bg-slate-950/40 rounded-xl border border-slate-800">
        <p className="text-sm text-slate-300 leading-relaxed mb-4">
          Power-Up Chips are strategic assets you deploy for a tactical edge. Tap any chip to see
          how to earn it, how to use it, and the impact it has on your points.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {POWER_UPS.map((powerUp) => {
            const Icon = powerUp.icon;
            return (
              <button
                key={powerUp.id}
                onClick={() => setActivePowerUp(powerUp.id)}
                className={`group flex items-center gap-3 text-left p-3.5 rounded-xl border ${powerUp.theme.border} ${powerUp.theme.bg} hover:brightness-125 transition-all cursor-pointer`}
              >
                <div className={`shrink-0 flex h-10 w-10 items-center justify-center rounded-lg border ${powerUp.theme.border} bg-slate-950/50`}>
                  <Icon className={`h-5 w-5 ${powerUp.theme.iconText}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className={`text-sm font-bold font-display ${powerUp.theme.accentText}`}>
                    {powerUp.name}
                  </h4>
                  <p className="text-xs text-slate-400 truncate">{powerUp.tagline}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>
            );
          })}
        </div>
      </div>

      {/* ================= GOLDEN TICKET (only when a Community Shield game is scheduled) ================= */}
      {communityShieldScheduled && (
        <>
          <h3 className="text-lg font-bold font-display text-white mt-8 mb-3 flex items-center gap-2">
            <span className="w-1.5 h-5 bg-amber-400 rounded-full" />
            The Golden Ticket
          </h3>
          <div className="p-5 rounded-xl border border-amber-400/30 bg-gradient-to-br from-amber-500/10 via-slate-950/40 to-slate-950/40">
            <div className="flex items-start gap-3">
              <div className="shrink-0 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-amber-300 to-yellow-600 shadow-lg shadow-amber-900/40">
                <Ticket className="h-6 w-6 text-slate-950" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <h4 className="text-base font-bold font-display text-amber-200">Community Shield Special</h4>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Football is back! Before the <span className="text-white font-semibold">Community Shield</span>{' '}
                  kicks off, a special pop-up invites you to predict the <span className="text-amber-200 font-semibold">exact
                  final score</span>. Nail it and you win a <span className="text-amber-200 font-semibold">Golden Ticket</span> —
                  a one-off season-opener reward. It's a single bonus fixture, separate from your league standings.
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ================= LEAGUES ================= */}
      <h3 className="text-lg font-bold font-display text-white mt-8 mb-3 flex items-center gap-2">
        <span className="w-1.5 h-5 bg-purple-400 rounded-full" />
        Leagues
      </h3>
      <div className="p-5 bg-slate-950/40 rounded-xl border border-slate-800">
        <div className="flex items-center gap-2 mb-2">
          <Users className="w-5 h-5 text-yellow-500" />
          <h4 className="text-base font-bold font-display text-white">Where You Compete</h4>
        </div>
        <p className="text-sm text-slate-300 leading-relaxed">
          Open <span className="text-white font-semibold">Leagues</span> from the top navigation. Use the
          submenu to <span className="text-white font-semibold">List</span> your leagues,{' '}
          <span className="text-white font-semibold">Join</span> one with a code and password,{' '}
          <span className="text-white font-semibold">View</span> all public leagues, or{' '}
          <span className="text-white font-semibold">Create</span> your own private competition. You must
          be in at least one league before the Match Predictor unlocks.
        </p>
      </div>

      {/* ================= ADMIN (admins only) ================= */}
      {user?.isAdmin && (
        <>
          <h3 className="text-lg font-bold font-display text-white mt-8 mb-3 flex items-center gap-2">
            <span className="w-1.5 h-5 bg-purple-500 rounded-full" />
            Administrator Tools
          </h3>
          <div className="p-5 rounded-xl border border-purple-500/30 bg-purple-950/20">
            <div className="flex items-center gap-2 mb-2">
              <Lock className="w-5 h-5 text-purple-400" />
              <h4 className="text-base font-bold font-display text-purple-300">Admin Area</h4>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              As an administrator you can open the <span className="text-white font-semibold">Admin Area</span> to
              manage fixtures, enter final scores (which triggers automatic scoring), review every player's
              predictions and points, and manage player accounts. Entering a match's final score settles it and
              updates the global leaderboard for all players.
            </p>
            <p className="text-[11px] text-purple-300/70 mt-2 font-mono uppercase tracking-wider">
              Visible to administrators only
            </p>
          </div>
        </>
      )}

      <div className="mt-8 pt-4 border-t border-slate-800 text-center text-xs text-slate-500 font-mono flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 justify-center">
          <Shield className="w-4 h-4 text-slate-400" />
          <span>Fair Play Guarantee: Scoring runs server-side on the leaderboard</span>
        </div>
        <div>Version 1.3.0</div>
      </div>

      <AnimatePresence>
        {activePowerUp && (
          <PowerUpModal
            powerUpId={activePowerUp}
            onClose={() => setActivePowerUp(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
