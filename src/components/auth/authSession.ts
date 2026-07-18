/**
 * Shared helpers for Supabase auth flows: profile building, email resolution,
 * and URL hash inspection for email-link redirects.
 */

import { User as SupabaseUser } from '@supabase/supabase-js';
import { UserProfile, SportType } from '../../types';
import { dbFetchPlayers, isSupabaseConfigured, supabase } from '../../supabase';
import { parseSeenFeatures } from '../../lib/seenFeatures';

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
    .select('*')
    .eq('id', authUser.id)
    .single();

  if (row) {
    return {
      id: row.id,
      firstName: row.first_name || '',
      surname: row.surname || '',
      email: row.email || authUser.email || loginEmail || '',
      phone: row.phone || '',
      dob: row.dob || '1990-01-01',
      nickname: row.username || row.nickname || 'Contestant',
      createdAt: row.created_at || new Date().toISOString(),
      emailVerified: !!authUser.email_confirmed_at,
      emailConfirmedAt: authUser.email_confirmed_at || null,
      isAdmin: row.is_admin || false,
      agreedToTerms: true,
      nationality: row.nationality || 'Global',
      supportedTeam: row.supported_team || 'Unknown',
      preferredSport: (row.preferred_sport as SportType) || undefined,
      isProfilePublic: row.is_profile_public ?? undefined,
      seenFeatures: parseSeenFeatures(row.seen_features),
    };
  }

  return minimalProfile(authUser, loginEmail);
}

function minimalProfile(authUser: SupabaseUser, loginEmail?: string): UserProfile {
  return {
    id: authUser.id,
    firstName: 'Player',
    surname: '',
    email: authUser.email || loginEmail || '',
    phone: '',
    dob: '1990-01-01',
    nickname: authUser.email?.split('@')[0] || 'Player',
    nationality: 'Global',
    supportedTeam: 'Unknown',
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
