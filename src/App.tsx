/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import { Award, Lock, Star } from 'lucide-react';
import { dbFetchPlayers, dbDeletePlayerAccount, dbSaveArchivedPlayer, dbSaveUnsubscribedEmail, dbUpdatePlayerAdmin, dbFetchPredictions, supabase, testSupabaseConnection } from './supabase';
import { UserProfile } from './types';
import AuthFlow from './components/AuthFlow';
import LoginView from './components/auth/LoginView';
import ResetPasswordView from './components/auth/ResetPasswordView';
import { readAuthHash, clearAuthHash, profileFromSession } from './components/auth/authSession';
import Dashboard from './components/Dashboard';
import RulesInfo from './components/RulesInfo';
import AdminPanel from './components/AdminPanel';
import AccountPortal from './components/AccountPortal';
import InstallPWA from './components/InstallPWA';
import SplashScreen from './components/SplashScreen';
import JoinLeague from './pages/JoinLeague';
import { RadialOrigin } from './radial';
import { useBodyScrollLock } from './hooks/useBodyScrollLock';
import { useSupabaseRealtime } from './hooks/useSupabaseRealtime';
import { useOverlayHistory, retainOverlayHistoryDuringTransition, transferOverlay } from './hooks/useOverlayHistory';
import { pendingInviteToPath, readPendingInvite } from './lib/pendingInvite';
import { initializePlatform } from './lib/initializePlatform';

/** Brand animation floor — splash never exits sooner than this, even if data is ready. */
const MIN_SPLASH_MS = 2200;

/** Which guest auth screen is currently shown. */
type GuestAuthView = 'login' | 'signup' | 'reset-request' | 'reset-update';

/**
 * Router-aware application shell. Must render as a descendant of <BrowserRouter>
 * (mounted in main.tsx) because it calls useNavigate().
 */
export default function App() {
  return <AppShell />;
}

function AppShell() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  /** Gatekeeper: only the splash renders until platform init + min brand time complete. */
  const [isAppReady, setIsAppReady] = useState(false);
  const skipMinSplash = useRef(false);
  const [guestAuthView, setGuestAuthView] = useState<GuestAuthView>('login');
  const [loginSuccessMessage, setLoginSuccessMessage] = useState<string | undefined>();
  const [dashboardWelcome, setDashboardWelcome] = useState<string | null>(null);
  const emailVerifyPending = useRef(false);

  const [showRules, setShowRules] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showAccount, setShowAccount] = useState(false);

  const openRules = (_origin?: RadialOrigin) => {
    setShowRules(true);
  };
  const openAccount = (_origin?: RadialOrigin) => {
    setShowAccount(true);
  };
  const closeRules = useCallback(() => {
    // Avoid history.back() on X — keep the user on the Dashboard SPA route.
    retainOverlayHistoryDuringTransition();
    setShowRules(false);
  }, []);
  const closeAdmin = useCallback(() => {
    retainOverlayHistoryDuringTransition();
    setShowAdmin(false);
  }, []);
  const closeAccount = useCallback(() => {
    retainOverlayHistoryDuringTransition();
    setShowAccount(false);
  }, []);

  const [externalLeagueSelection, setExternalLeagueSelection] = useState<string | null>(null);

  // Lock background scroll + intercept mobile edge-swipe back for App-level overlays
  useBodyScrollLock(showRules || showAdmin || showAccount);
  useOverlayHistory(showRules, closeRules, 'rules');
  useOverlayHistory(showAdmin, closeAdmin, 'admin');
  // Account portal owns its own overlay-history entry (and nested scroll lock)

  const [registeredUsers, setRegisteredUsers] = useState<UserProfile[]>([]);

  const loadRegisteredUsers = useCallback(async () => {
    try {
      const players = await dbFetchPlayers();
      const standardSeedNicks = [
        'scrummaster',
        'striker99',
        'goalgetter',
        'lineoutking',
        'sidelineslicker',
        'flankerfan',
      ];
      const filtered = players.filter(
        (p) => !standardSeedNicks.includes(p.nickname.toLowerCase()),
      );
      const seen = new Set<string>();
      const deduplicated = filtered.filter((u) => {
        if (!u?.id || seen.has(u.id)) return false;
        seen.add(u.id);
        return true;
      });
      setRegisteredUsers(deduplicated);
    } catch (err) {
      console.warn('Could not load players from Supabase driver:', err);
    }
  }, []);

  // One realtime channel per logged-in user (replaces App profiles + Dashboard channels).
  useSupabaseRealtime(currentUser?.id, {
    onProfilesChange: loadRegisteredUsers,
  });

  const skipSplashForAuthRedirect = useCallback(() => {
    skipMinSplash.current = true;
    setIsAppReady(true);
  }, []);

  const replaySplash = useCallback(() => {
    setIsAppReady(false);
    setTimeout(() => setIsAppReady(true), MIN_SPLASH_MS);
  }, []);

  // Concurrent platform boot: auth + fixtures + user data, then lift the splash gate.
  useEffect(() => {
    let cancelled = false;

    async function boot() {
      const startedAt = Date.now();
      try {
        const init = await initializePlatform(queryClient);
        if (cancelled) return;

        if (init.profile) {
          setCurrentUser(init.profile);
          localStorage.setItem('pitchside_logged_in', JSON.stringify(init.profile));
        } else if (!emailVerifyPending.current) {
          setCurrentUser(null);
          localStorage.removeItem('pitchside_logged_in');
        }
      } catch (err) {
        console.error('Platform initialization failed:', err);
      } finally {
        if (cancelled) return;

        if (!skipMinSplash.current) {
          const remaining = Math.max(0, MIN_SPLASH_MS - (Date.now() - startedAt));
          if (remaining > 0) {
            await new Promise((resolve) => setTimeout(resolve, remaining));
          }
        }
        if (!cancelled) setIsAppReady(true);
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, [queryClient]);

  // Verify Supabase connection on load
  useEffect(() => {
    void testSupabaseConnection().then((result) => {
      if (!result.ok) {
        console.error('Supabase connection failed:', result.error);
      }
    });
  }, []);

  // Listen for Supabase auth events: password recovery links & email verification redirects
  useEffect(() => {
    if (!supabase) return;

    // Detect email-verification redirect from URL hash before the listener fires
    const initialHash = readAuthHash();
    if (
      initialHash.hasTokens &&
      (initialHash.type === 'signup' || initialHash.type === 'email' || initialHash.type === 'invite')
    ) {
      emailVerifyPending.current = true;
      skipSplashForAuthRedirect();
    }
    if (initialHash.hasTokens && initialHash.type === 'recovery') {
      skipSplashForAuthRedirect();
      setGuestAuthView('reset-update');
      setCurrentUser(null);
      localStorage.removeItem('pitchside_logged_in');
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        skipSplashForAuthRedirect();
        setGuestAuthView('reset-update');
        setCurrentUser(null);
        localStorage.removeItem('pitchside_logged_in');
        clearAuthHash();
        return;
      }

      if (event === 'SIGNED_IN' && session?.user && emailVerifyPending.current) {
        emailVerifyPending.current = false;
        clearAuthHash();
        skipSplashForAuthRedirect();

        try {
          const profile = await profileFromSession(session.user);
          setCurrentUser(profile);
          localStorage.setItem('pitchside_logged_in', JSON.stringify(profile));
          setDashboardWelcome(`Welcome to PitchSide, ${profile.nickname}!`);
          setRegisteredUsers((prev) =>
            prev.some((u) => u.id === profile.id) ? prev : [...prev, profile],
          );
        } catch (err) {
          console.error('Email verification profile load failed:', err);
          setGuestAuthView('login');
          setLoginSuccessMessage('Email verified! Please log in.');
        }
        return;
      }
    });

    // Fallback: hash indicated email verify but session never established
    let verifyFallbackTimer: ReturnType<typeof setTimeout> | undefined;
    if (emailVerifyPending.current) {
      verifyFallbackTimer = setTimeout(async () => {
        if (!emailVerifyPending.current) return;
        const { data: { session } } = await supabase!.auth.getSession();
        if (session?.user) {
          emailVerifyPending.current = false;
          clearAuthHash();
          try {
            const profile = await profileFromSession(session.user);
            setCurrentUser(profile);
            localStorage.setItem('pitchside_logged_in', JSON.stringify(profile));
            setDashboardWelcome(`Welcome to PitchSide, ${profile.nickname}!`);
            setRegisteredUsers((prev) =>
              prev.some((u) => u.id === profile.id) ? prev : [...prev, profile],
            );
          } catch {
            setGuestAuthView('login');
            setLoginSuccessMessage('Email verified! Please log in.');
          }
        } else {
          emailVerifyPending.current = false;
          clearAuthHash();
          skipSplashForAuthRedirect();
          setGuestAuthView('login');
          setLoginSuccessMessage('Email verified! Please log in.');
        }
      }, 2500);
    }

    return () => {
      subscription.unsubscribe();
      if (verifyFallbackTimer) clearTimeout(verifyFallbackTimer);
    };
  }, [skipSplashForAuthRedirect]);
  // Initial players hydrate — subsequent updates come via the single realtime channel.
  useEffect(() => {
    if (!currentUser) return;
    void loadRegisteredUsers();
  }, [currentUser, loadRegisteredUsers]);

  const handleAuthSuccess = (user: UserProfile) => {
    setCurrentUser(user);
    localStorage.setItem('pitchside_logged_in', JSON.stringify(user));
    const pendingInvite = readPendingInvite();
    if (pendingInvite) {
      navigate(pendingInviteToPath(pendingInvite));
    }
  };

  const handleLogout = async () => {
    try {
      await supabase?.auth.signOut();
    } catch (err) {
      console.warn('Supabase signOut failed during logout:', err);
    }
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
    <div className="relative min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950 overflow-x-clip">
      {/* Decorative backdrop lives outside motion.main so transforms never trap
          fixed layers, and pointer-events:none lets every touch reach the page. */}
      {isAppReady && (
        <div
          aria-hidden="true"
          className="app-ambient-backdrop fixed inset-0 overflow-hidden pointer-events-none z-0"
        >
          {/* Soft orbs without CSS filter — filter + large layers can steal touch on WebKit */}
          <div className="absolute -top-24 -right-24 w-[420px] h-[420px] rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.12)_0%,transparent_70%)]" />
          <div className="absolute -bottom-24 -left-24 w-[420px] h-[420px] rounded-full bg-[radial-gradient(circle,rgba(239,68,68,0.1)_0%,transparent_70%)]" />
          <div className="magical-diagonal-ribbon" />
        </div>
      )}
      {isAppReady && <InstallPWA />}
      <AnimatePresence mode="wait">
        {!isAppReady ? (
          <SplashScreen />
        ) : (
          /* Main Application Frame Router —
             w-full + no overflow-x-hidden (that forces overflow-y:auto nested scroll).
             Content grows with the document so the viewport scrolls natively. */
          <motion.main
            key="main"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="relative z-10 flex-1 flex flex-col w-full max-w-none p-4 sm:p-6 lg:p-8"
          >
            <Routes>
              <Route
                path="/join/:leagueId"
                element={
                  <JoinLeague
                    currentUser={currentUser}
                    onRequestAuth={(mode) => {
                      setGuestAuthView(mode === "signup" ? "signup" : "login");
                      navigate("/");
                    }}
                    onJoined={(id) => {
                      setExternalLeagueSelection(id);
                      setDashboardWelcome("Welcome to the league — you're in!");
                    }}
                  />
                }
              />
              {/* Query-style invites: /join?id=LG_XXX&code=password */}
              <Route
                path="/join"
                element={
                  <JoinLeague
                    currentUser={currentUser}
                    onRequestAuth={(mode) => {
                      setGuestAuthView(mode === "signup" ? "signup" : "login");
                      navigate("/");
                    }}
                    onJoined={(id) => {
                      setExternalLeagueSelection(id);
                      setDashboardWelcome("Welcome to the league — you're in!");
                    }}
                  />
                }
              />
              <Route
                path="*"
                element={
                  <>
            {currentUser ? (
              /* Authenticated Platform Dashboard */
              <Dashboard
                user={currentUser}
                onLogout={handleLogout}
                onOpenRules={openRules}
                registeredUsers={registeredUsers}
                onOpenAdmin={() => setShowAdmin(true)}
                onOpenAccount={openAccount}
                externalSelectedLeagueId={externalLeagueSelection}
                onClearExternalLeagueSelection={() => setExternalLeagueSelection(null)}
                initialToast={dashboardWelcome}
                onUserUpdate={(updated) => {
                  setCurrentUser(updated);
                  try {
                    localStorage.setItem(
                      "pitchside_logged_in",
                      JSON.stringify(updated),
                    );
                  } catch {
                    /* ignore */
                  }
                }}
              />
            ) : guestAuthView === 'reset-request' || guestAuthView === 'reset-update' ? (
              <div className="flex-1 flex items-center justify-center py-6">
                <ResetPasswordView
                  mode={guestAuthView === 'reset-update' ? 'update' : 'request'}
                  onBackToLogin={() => {
                    setGuestAuthView('login');
                    setLoginSuccessMessage(undefined);
                  }}
                  onPasswordUpdated={() => {
                    setGuestAuthView('login');
                    setLoginSuccessMessage('Password updated successfully! Please sign in with your new password.');
                  }}
                  onLogoClick={replaySplash}
                />
              </div>
            ) : (
              /* Unauthorized Guest Landing */
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
                        <span className="text-slate-500">Profiles isolated safely with double verification.</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Auth form side */}
                <div className="flex-1 w-full flex items-center justify-center">
                  {guestAuthView === 'signup' ? (
                    <AuthFlow
                      onAuthSuccess={handleAuthSuccess}
                      onOpenRules={() => openRules()}
                      registeredUsers={registeredUsers}
                      onAddNewUser={handleAddNewUser}
                      onSwitchToLogin={() => {
                        setGuestAuthView('login');
                        setLoginSuccessMessage(undefined);
                      }}
                      onLogoClick={replaySplash}
                    />
                  ) : (
                    <LoginView
                      onAuthSuccess={handleAuthSuccess}
                      onAddNewUser={handleAddNewUser}
                      onForgotPassword={() => setGuestAuthView('reset-request')}
                      onCreateAccount={() => {
                        setGuestAuthView('signup');
                        setLoginSuccessMessage(undefined);
                      }}
                      successMessage={loginSuccessMessage}
                      onLogoClick={replaySplash}
                    />
                  )}
                </div>
              </div>
            )}
                  </>
                }
              />
            </Routes>
            {/* Footer hugs the content so short pages don't leave a dead gap */}
            <footer className="pt-6 pb-4 mt-6 text-center text-[10px] text-slate-600 font-mono tracking-widest uppercase border-t border-slate-900/40 w-full max-w-6xl mx-auto flex-shrink-0">
              © {new Date().getFullYear()} PitchSide Predictor • All Rights Reserved
            </footer>
          </motion.main>
        )}
      </AnimatePresence>

      {/* Desktop Settings → Rules (instant overlay, no radial animation) */}
      {showRules && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs overflow-y-auto">
          <div
            className="flex min-h-full items-start justify-center p-4 sm:py-16"
            onClick={(e) => {
              if (e.target !== e.currentTarget) return;
              closeRules();
            }}
          >
            <div
              className="w-full max-w-4xl"
              onClick={(e) => e.stopPropagation()}
            >
              <RulesInfo user={currentUser} onClose={closeRules} />
            </div>
          </div>
        </div>
      )}

      {showAdmin && currentUser?.isAdmin && (
        <AdminPanel
          onClose={closeAdmin}
          registeredUsers={registeredUsers}
          onToggleAdmin={handleToggleAdmin}
          onDeleteUser={handleDeleteUser}
          isAdmin={currentUser.isAdmin}
        />
      )}

      {/* Desktop Settings → Account */}
      {showAccount && currentUser && (
        <AccountPortal
          variant="overlay"
          user={currentUser}
          registeredUsers={registeredUsers}
          onClose={closeAccount}
          onLogout={handleLogout}
          onOpenRules={() => {
            retainOverlayHistoryDuringTransition();
            closeAccount();
            requestAnimationFrame(() => openRules());
          }}
          onSelectLeague={(leagueId) => {
            transferOverlay("account", "league-hub", () => {
              /* league-hub close is owned by Dashboard once mounted */
            });
            setExternalLeagueSelection(leagueId);
            closeAccount();
          }}
          onUpdateUser={(updatedUser) => {
            setCurrentUser(updatedUser);
            localStorage.setItem('pitchside_logged_in', JSON.stringify(updatedUser));
            const updated = registeredUsers.map((u) => (u.id === updatedUser.id ? updatedUser : u));
            setRegisteredUsers(updated);
          }}
        />
      )}
    </div>
  );
}
