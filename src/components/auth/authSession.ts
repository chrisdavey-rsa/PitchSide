/**
 * Shared helpers for Supabase auth flows: profile building, email resolution,
 * and URL hash inspection for email-link redirects.
 */

import { User as SupabaseUser } from '@supabase/supabase-js';
import { UserProfile, SportType } from '../../types';
import { dbFetchPlayers, isSupabaseConfigured, supabase } from '../../supabase';
import { parseSeenFeatures } from '../../lib/seenFeatures';
import { namesFromAuthUser } from '../../lib/oauthProfile';

/** Auth redirect types Supabase puts in the URL hash after email-link clicks. */
export type AuthHashType = 'signup' | 'recovery' | 'invite' | 'magiclink' | 'email' | null;

export interface AuthHashInfo {
  type: AuthHashType;
  hasTokens: boolean;
}

/** Read and strip Supabase tokens from the URL hash (one-time processing). */
export function readAuthHash(): AuthHashInfo {
  const hash = window.location.hash.replace(/^#/, '');
  if (!hash) return { type: null, hasTokens: false };

  const params = new URLSearchParams(hash);
  const type = (params.get('type') as AuthHashType) ?? null;
  const hasTokens = !!(params.get('access_token') || params.get('refresh_token'));

  return { type, hasTokens };
}

/** Remove auth tokens from the address bar so refreshes don't re-process them. */
export function clearAuthHash() {
  if (window.location.hash) {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }
}

/** Build a UserProfile from a Supabase auth user + optional profiles row. */
export async function profileFromSession(
  authUser: SupabaseUser,
  loginEmail?: string,
): Promise<UserProfile> {
  if (!supabase) {
    return minimalProfile(authUser, loginEmail);
  }

  const { data: row } = await supabase
    .from('profiles')
    .select(
      'id, first_name, surname, email, username, dob, phone, nationality, supported_team, preferred_sport, is_admin, is_profile_public, created_at, seen_features, selected_sports, favorite_f1_team, favorite_golfer, role, golf_mulligans_available, age_confirmed_13, terms_accepted_at, privacy_accepted_at, subscribed_leagues, golf_coverage_tier, preferred_nation, favorite_teams, weekly_email_opt_in, push_enabled, email_enabled',
    )
    .eq('id', authUser.id)
    .single();

  if (row) {
    const selectedSports = Array.isArray(row.selected_sports)
      ? (row.selected_sports as UserProfile["selectedSports"])
      : [];

    const fromMeta = namesFromAuthUser(authUser);
    let firstName = (row.first_name || '').trim();
    let surname = (row.surname || '').trim();

    // Repair Google OAuth profiles that only stored the given name.
    if ((!surname || !firstName) && (fromMeta.firstName || fromMeta.surname)) {
      if (!firstName && fromMeta.firstName) firstName = fromMeta.firstName;
      if (!surname && fromMeta.surname) surname = fromMeta.surname;
      if (supabase && (fromMeta.firstName || fromMeta.surname)) {
        void supabase
          .from('profiles')
          .update({
            first_name: firstName || row.first_name,
            surname: surname || row.surname || '',
          })
          .eq('id', authUser.id)
          .then(({ error }) => {
            if (error) {
              console.warn('[profileFromSession] name backfill failed', error.message);
            }
          });
      }
    }

    return {
      id: row.id,
      firstName: firstName || fromMeta.firstName || '',
      surname: surname || fromMeta.surname || '',
      email: row.email || authUser.email || loginEmail || '',
      phone: row.phone || '',
      dob: row.dob || '1990-01-01',
      // Empty nickname → CompleteProfile gate (do not invent from email).
      nickname: (row.username || '').trim(),
      createdAt: row.created_at || new Date().toISOString(),
      emailVerified: !!authUser.email_confirmed_at,
      emailConfirmedAt: authUser.email_confirmed_at || null,
      isAdmin: row.is_admin || false,
      agreedToTerms: Boolean(row.terms_accepted_at),
      // Preserve null/empty so needsOnboarding() can gate OAuth users.
      nationality: row.nationality || undefined,
      supportedTeam: row.supported_team || undefined,
      preferredSport: (row.preferred_sport as SportType) || undefined,
      selectedSports,
      favoriteTeams: Array.isArray(row.favorite_teams)
        ? row.favorite_teams.map(String)
        : row.supported_team
          ? [String(row.supported_team)]
          : [],
      pushEnabled: row.push_enabled === true,
      emailEnabled:
        row.email_enabled === true ||
        (row.email_enabled == null && row.weekly_email_opt_in === true),
      weeklyEmailOptIn:
        row.email_enabled === true ||
        (row.email_enabled == null && row.weekly_email_opt_in !== false),
      favoriteF1Team: row.favorite_f1_team ?? null,
      favoriteGolfer: row.favorite_golfer ?? null,
      role: row.role ?? null,
      golfMulligansAvailable: row.golf_mulligans_available ?? null,
      subscribedLeagues: Array.isArray(row.subscribed_leagues)
        ? row.subscribed_leagues.map(String)
        : [],
      golfCoverageTier:
        (row.golf_coverage_tier as UserProfile["golfCoverageTier"]) ||
        "MAJORS_ONLY",
      preferredNation: row.preferred_nation ?? null,
      isProfilePublic: row.is_profile_public ?? undefined,
      seenFeatures: parseSeenFeatures(row.seen_features),
    };
  }

  return minimalProfile(authUser, loginEmail);
}

function minimalProfile(authUser: SupabaseUser, loginEmail?: string): UserProfile {
  const fromMeta = namesFromAuthUser(authUser);
  return {
    id: authUser.id,
    firstName: fromMeta.firstName || 'Player',
    surname: fromMeta.surname || '',
    email: authUser.email || loginEmail || '',
    phone: '',
    dob: '1990-01-01',
    nickname: '',
    nationality: undefined,
    supportedTeam: undefined,
    createdAt: new Date().toISOString(),
    emailVerified: !!authUser.email_confirmed_at,
    emailConfirmedAt: authUser.email_confirmed_at || null,
    isAdmin: false,
    agreedToTerms: true,
  };
}

/** Resolve a nickname to an email via RPC (returns null if not found). */
export async function resolveEmailFromNickname(nickname: string): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.rpc('get_email_by_nickname', {
    search_nickname: nickname,
  });
  return data ?? null;
}

export interface LoginResult {
  profile: UserProfile;
  welcomeMessage: string;
}

/**
 * Authenticate with username/email + password.
 * Throws a string error message on failure.
 */
export async function performLogin(
  identifier: string,
  password: string,
): Promise<LoginResult> {
  const sanitized = identifier.trim();
  if (!sanitized) throw 'Please enter your username or email address.';

  const isEmail = sanitized.includes('@');
  const supabaseReady = isSupabaseConfigured() && supabase;

  let loginEmail = isEmail ? sanitized : '';

  if (supabaseReady && !isEmail) {
    const resolved = await resolveEmailFromNickname(sanitized);
    if (!resolved) throw 'Username not found. Please verify your details or sign up.';
    loginEmail = resolved;
  }

  if (supabaseReady) {
    const { data, error } = await supabase!.auth.signInWithPassword({
      email: loginEmail,
      password,
    });
    if (error) throw error.message;

    const profile = await profileFromSession(data.user!, loginEmail);
    return { profile, welcomeMessage: `Welcome back, ${profile.nickname}!` };
  }

  // Sandbox fallback
  const players = await dbFetchPlayers();
  const match = players.find(
    (u) =>
      u.nickname.toLowerCase() === sanitized.toLowerCase() ||
      u.email.toLowerCase() === sanitized.toLowerCase(),
  );
  if (!match) throw 'User does not exist. Please verify your details or create an account.';
  if (match.password && password !== match.password) {
    throw 'Incorrect password. Use "Forgot Password?" to recover your account.';
  }

  const profile: UserProfile = { ...match, emailVerified: true };
  return { profile, welcomeMessage: `Welcome back, ${profile.nickname}!` };
}

/** Request a password-reset email. Throws on failure. */
export async function requestPasswordReset(email: string): Promise<void> {
  if (!supabase) throw 'Database not connected. Cannot send reset link.';
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: window.location.origin,
  });
  if (error) throw error.message;
}

/** Update password after recovery link (user must have recovery session). */
export async function updatePassword(newPassword: string): Promise<void> {
  if (!supabase) throw 'Database not connected.';
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error.message;
}
