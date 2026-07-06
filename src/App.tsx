/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { createClient } from '@supabase/supabase-js';
import { ShieldCheck, Flame, Medal, Award, Settings, Layers, Lock, Cpu, Star } from 'lucide-react';
import { dbFetchPlayers, dbDeletePlayerAccount, dbSaveArchivedPlayer, dbSaveUnsubscribedEmail, dbUpdatePlayerAdmin, dbFetchPredictions, supabase } from './supabase';
import { UserProfile } from './types';
import PitchSideLogo from './components/PitchSideLogo';
import AuthFlow from './components/AuthFlow';
import Dashboard from './components/Dashboard';
import RulesInfo from './components/RulesInfo';
import AdminPanel from './components/AdminPanel';
import AccountPortal from './components/AccountPortal';
import ResetPassword from './components/ResetPassword';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isSplash, setIsSplash] = useState(true);
  const [showRules, setShowRules] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [externalLeagueSelection, setExternalLeagueSelection] = useState<string | null>(null);
  const [passwordRecoveryMode, setPasswordRecoveryMode] = useState(false);

  const [registeredUsers, setRegisteredUsers] = useState<UserProfile[]>([]);

  // Load auth state from storage on start
  useEffect(() => {
    const savedUser = localStorage.getItem('pitchside_logged_in');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        if (parsed && parsed.id && parsed.email) {
          setCurrentUser(parsed);
        } else {
          localStorage.removeItem('pitchside_logged_in');
          setCurrentUser(null);
        }
      } catch (e) {
        localStorage.removeItem('pitchside_logged_in');
        setCurrentUser(null);
      }
    }

    // Defer splash for exactly 2200ms to allow full ball swipe animation
    const splashTimer = setTimeout(() => {
      setIsSplash(false);
    }, 2200);

    return () => clearTimeout(splashTimer);
  }, []);

  // Verify Supabase connection on load
  useEffect(() => {
    const testSupabaseConnection = async () => {
      if (!supabase) return;
      try {
        // The table containing players/users is called profiles
        const { data, error } = await supabase.from('profiles').select('*').limit(1);
        if (error) {
          console.error("Supabase connection failed:", error);
        } else {
          console.log("Supabase connected successfully:", data);
        }
      } catch (err) {
        console.error("Supabase connection error:", err);
      }
    };
    testSupabaseConnection();
  }, []);

  // Listen for PASSWORD_RECOVERY event from Supabase reset email links
  useEffect(() => {
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecoveryMode(true);
        setCurrentUser(null);
        localStorage.removeItem('pitchside_logged_in');
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Fetch registered players from Supabase relational DB
  useEffect(() => {
    if (!currentUser) return;

    let active = true;
    const loadPlayers = async () => {
      try {
        const players = await dbFetchPlayers();
        if (active) {
          // Filter out mock names to avoid display pollution, then seed remaining
          const standardSeedNicks = ['scrummaster', 'striker99', 'goalgetter', 'lineoutking', 'sidelineslicker', 'flankerfan'];
          const filtered = players.filter(p => !standardSeedNicks.includes(p.nickname.toLowerCase()));
          
          const seen = new Set();
          const deduplicated = filtered.filter((u) => {
            if (!u || !u.id || seen.has(u.id)) return false;
            seen.add(u.id);
            return true;
          });

          setRegisteredUsers(deduplicated);
        }
      } catch (err) {
        console.warn('Could not load players from Supabase driver:', err);
      }
    };

    loadPlayers();
    
    let subscription: ReturnType<typeof supabase.channel> | null = null;
    if (supabase) {
      subscription = supabase
        .channel('public:profiles')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
          loadPlayers();
        })
        .subscribe();
    }

    return () => {
      active = false;
      if (subscription && supabase) {
        supabase.removeChannel(subscription);
      }
    };
  }, [currentUser]);

  const handleAuthSuccess = (user: UserProfile) => {
    setCurrentUser(user);
    localStorage.setItem('pitchside_logged_in', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('pitchside_logged_in');
  };

  const handleAddNewUser = (newUser: UserProfile) => {
    setRegisteredUsers((prev) => {
      if (prev.some((u) => u.id === newUser.id)) {
        return prev;
      }
      return [...prev, newUser];
    });
  };

  const handleToggleAdmin = async (userId: string) => {
    let nextState = false;
    const updated = registeredUsers.map((u) => {
      if (u.id === userId) {
        nextState = !u.isAdmin;
        if (currentUser && currentUser.id === userId) {
          const nextUser = { ...currentUser, isAdmin: nextState };
          setCurrentUser(nextUser);
          localStorage.setItem('pitchside_logged_in', JSON.stringify(nextUser));
        }
        return { ...u, isAdmin: nextState };
      }
      return u;
    });
    setRegisteredUsers(updated);

    // Persist admin change to DB
    await dbUpdatePlayerAdmin(userId, nextState);
  };

  const handleDeleteUser = async (userId: string) => {
    const targetPlayer = registeredUsers.find((u) => u.id === userId);
    if (!targetPlayer) return;

    try {
      // 1. Fetch historic predictions for this specific user
      const userPredictionsMap = await dbFetchPredictions(userId);
      const userPredictions = Object.entries(userPredictionsMap).map(([matchId, val]) => ({
        matchId,
        predictedHomeScore: val.home,
        predictedAwayScore: val.away,
        submitted: val.submitted
      }));

      // 2. Prepare Backup Object payload
      const backupPayload = {
        deletedUser: {
          id: targetPlayer.id,
          firstName: targetPlayer.firstName,
          surname: targetPlayer.surname,
          email: targetPlayer.email,
          dob: targetPlayer.dob,
          nickname: targetPlayer.nickname,
          nationality: targetPlayer.nationality || 'United Kingdom',
          supportedTeam: targetPlayer.supportedTeam || 'None',
          createdAt: targetPlayer.createdAt,
          emailVerified: targetPlayer.emailVerified,
          isAdmin: targetPlayer.isAdmin,
          deletedAt: new Date().toISOString()
        },
        predictions: userPredictions,
        unsubscribedAt: new Date().toISOString()
      };

      // 3. Retain information in our admin-retained database backup collection and unsubscribe list
      const backupDocId = `archived_${userId}_${Date.now()}`;
      await dbSaveArchivedPlayer(backupDocId, backupPayload);

      // Mark email as unsubscribed from mailing lists
      await dbSaveUnsubscribedEmail(targetPlayer.email, {
        userId,
        nickname: targetPlayer.nickname,
        unsubscribedAt: new Date().toISOString()
      });

      // 4. Soft-delete profile document in DB/localStorage (update unique credentials)
      await dbDeletePlayerAccount(userId, targetPlayer.email);

      // Local storage cleanup (predictions/points are kept in DB, but we can clean up direct session pointers if desired, or keep them)
      localStorage.removeItem(`predictions_${userId}`);
      localStorage.removeItem(`points_${userId}`);

    } catch (err) {
      console.error('Fatal user soft-deletion & archiving sequence mismatch:', err);
    }

    // 5. Update state & client-side lists
    // Remove from active registered users list in state
    const updated = registeredUsers.filter((u) => u.id !== userId);
    setRegisteredUsers(updated);

    // 6. Automatically log out if the deleted user is the current logged in user
    if (currentUser && currentUser.id === userId) {
      handleLogout();
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      <AnimatePresence mode="wait">
        {isSplash ? (
          /* Splash Screen Overlay Intro with Ball swipe */
          <motion.div
            key="splash"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.6, ease: 'easeInOut' }}
            className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center z-50 p-6 text-center"
          >
            <div className="space-y-4">
              <PitchSideLogo size="xl" autoplay={true} />
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1] }}
                transition={{ delay: 1.2, duration: 0.5 }}
                className="text-[10px] text-slate-500 font-mono tracking-widest uppercase"
              >
                Connecting Secure Sandbox Node...
              </motion.div>
            </div>
          </motion.div>
        ) : (
          /* Main Application Frame Router */
          <motion.main
            key="main"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 relative"
          >
            {/* Background elements */}
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-3xl pointer-events-none -z-10" />
            <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-red-500/5 rounded-full blur-3xl pointer-events-none -z-10" />
            <div className="magical-diagonal-ribbon pointer-events-none -z-20" />
            
            {/* Twinkling star sparkles along the diagonal */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none -z-15">
              <div className="sparkling-light-particle top-[15%] left-[25%] text-sm" style={{ animationDelay: '0s' }}>✨</div>
              <div className="sparkling-light-particle top-[40%] left-[45%] text-sm text-emerald-400" style={{ animationDelay: '1.5s' }}>✦</div>
              <div className="sparkling-light-particle top-[65%] left-[65%] text-sm text-blue-400" style={{ animationDelay: '0.8s' }}>✨</div>
              <div className="sparkling-light-particle top-[25%] left-[75%] text-sm" style={{ animationDelay: '2.2s' }}>✦</div>
              <div className="sparkling-light-particle top-[80%] left-[35%] text-sm text-purple-400" style={{ animationDelay: '3.1s' }}>✨</div>
            </div>

            {passwordRecoveryMode ? (
              /* Password Reset Flow (triggered via Supabase email link) */
              <ResetPassword onComplete={() => setPasswordRecoveryMode(false)} />
            ) : currentUser ? (
              /* Authenticated Platform Dashboard */
              <Dashboard
                user={currentUser}
                onLogout={handleLogout}
                onOpenRules={() => setShowRules(true)}
                registeredUsers={registeredUsers}
                onOpenAdmin={() => setShowAdmin(true)}
                onOpenAccount={() => setShowAccount(true)}
                externalSelectedLeagueId={externalLeagueSelection}
                onClearExternalLeagueSelection={() => setExternalLeagueSelection(null)}
              />
            ) : (
              /* Unauthorized Guest Landing / Sign Up */
              <div className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-12 max-w-5xl mx-auto w-full py-6">
                
                {/* Visual side branding */}
                <div className="flex-1 space-y-6 text-left max-w-md hidden lg:block">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-xs font-semibold text-blue-400">
                    <Award className="w-3.5 h-3.5" />
                    <span>Ultimate Sports Score Predictor</span>
                  </div>

                  <h1 className="text-4xl font-extrabold font-display tracking-tight text-white leading-none">
                    Take Your <span className="text-transparent bg-clip-text bg-linear-to-r from-blue-400 to-green-400">PitchSide</span> Seat
                  </h1>

                  <p className="text-slate-400 text-sm leading-relaxed">
                    Compete in score predictions across premier Football and Rugby leagues. Prove your tactical prowess with our tailored points systems and climb to the top of the leaderboard.
                  </p>

                  <div className="space-y-3 pt-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center">
                        <Star className="w-4.5 h-4.5 text-yellow-500" />
                      </div>
                      <div className="text-xs">
                        <span className="font-bold text-white block">Accurate Point Calculators</span>
                        <span className="text-slate-500">Rugby margin thresholds & Football exact lines formulas.</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center">
                        <Lock className="w-4.5 h-4.5 text-purple-400" />
                      </div>
                      <div className="text-xs">
                        <span className="font-bold text-white block">Secure Account Directory</span>
                        <span className="text-slate-500">Profiles isolated safely with simulated double verification.</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Form flow side */}
                <div className="flex-1 w-full flex items-center justify-center">
                  <AuthFlow
                    onAuthSuccess={handleAuthSuccess}
                    onOpenRules={() => setShowRules(true)}
                    registeredUsers={registeredUsers}
                    onAddNewUser={handleAddNewUser}
                  />
                </div>
              </div>
            )}

            {/* Elegant footer to anchor the layout boundary and resolve empty space */}
            <footer className="mt-auto pt-10 pb-4 text-center text-[10px] text-slate-600 font-mono tracking-widest uppercase border-t border-slate-900/40 w-full max-w-6xl mx-auto flex-shrink-0">
              © {new Date().getFullYear()} PitchSide Predictor • All Rights Reserved
            </footer>
          </motion.main>
        )}
      </AnimatePresence>

      {/* MODAL LAYER: Interactive scoring rules guidelines guide panel */}
      <AnimatePresence>
        {showRules && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs overflow-y-auto"
          >
            <div className="flex min-h-full items-start justify-center p-4 sm:py-16">
              <motion.div className="w-full max-w-4xl">
                <RulesInfo onClose={() => setShowRules(false)} />
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL LAYER: Administrative panel container portal */}
      <AnimatePresence>
        {showAdmin && (
          <AdminPanel
            onClose={() => setShowAdmin(false)}
            registeredUsers={registeredUsers}
            onToggleAdmin={handleToggleAdmin}
            onDeleteUser={handleDeleteUser}
          />
        )}
      </AnimatePresence>

      {/* MODAL LAYER: Personal User Account Portal */}
      <AnimatePresence>
        {showAccount && currentUser && (
          <AccountPortal
            user={currentUser}
            registeredUsers={registeredUsers}
            onClose={() => setShowAccount(false)}
            onSelectLeague={(leagueId) => {
              setExternalLeagueSelection(leagueId);
              setShowAccount(false);
            }}
            onUpdateUser={(updatedUser) => {
              setCurrentUser(updatedUser);
              localStorage.setItem('pitchside_logged_in', JSON.stringify(updatedUser));
              const updated = registeredUsers.map((u) => (u.id === updatedUser.id ? updatedUser : u));
              setRegisteredUsers(updated);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
