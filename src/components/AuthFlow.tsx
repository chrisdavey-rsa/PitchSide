/**
 * Create Account + email-confirmation gate.
 * Field set matches the Round-2 UX mockup (full name, optional phone, age checkbox).
 */

import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mail,
  User,
  KeyRound,
  ArrowRight,
  Sparkles,
  Info,
  ChevronDown,
  Check,
  Eye,
  EyeOff,
} from 'lucide-react';
import { UserProfile, SportType } from '../types';
import PitchSideLogo from './PitchSideLogo';
import { dbFetchPlayers, isSupabaseConfigured, supabase } from '../supabase';
import { NATIONS_LIST } from './AccountPortal/data';
import CountryFlag from './CountryFlag';
import { filterTeams } from '../data/supportedTeams';
import { useTeamsCatalogQuery } from '../hooks/usePitchsideQueries';
import OAuthButtons from './auth/OAuthButtons';
import { splitFullName } from '../lib/oauthProfile';

interface AuthFlowProps {
  onAuthSuccess: (user: UserProfile) => void;
  onOpenRules: () => void;
  registeredUsers: UserProfile[];
  onAddNewUser: (user: UserProfile) => void;
  onSwitchToLogin: () => void;
  onLogoClick?: () => void;
  onTakeTour?: () => void;
}

const LABEL =
  'block text-[11px] font-medium text-slate-400 mb-1';
const INPUT =
  'w-full bg-slate-950/60 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-sm text-white placeholder:text-slate-600 outline-none transition-colors font-sans';

function passwordStrength(password: string): { score: number; label: string } {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  const clamped = Math.min(score, 4);
  const labels = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];
  return { score: clamped, label: password.length === 0 ? '' : labels[clamped] };
}

export default function AuthFlow({
  onOpenRules,
  onSwitchToLogin,
  onLogoClick,
  onTakeTour,
}: AuthFlowProps) {
  const [mode, setMode] = useState<'signup' | 'awaiting_email_confirmation'>('signup');
  const [showParentalGate, setShowParentalGate] = useState(false);

  const [fullName, setFullName] = useState('');
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedNationality, setSelectedNationality] = useState('United Kingdom');
  const [supportedTeam, setSupportedTeam] = useState('');
  const [nationalitySearch, setNationalitySearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [teamSearch, setTeamSearch] = useState('');
  const [isTeamDropdownOpen, setIsTeamDropdownOpen] = useState(false);
  const [preferredSport, setPreferredSport] = useState<SportType>(SportType.FOOTBALL);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isPasswordMasked, setIsPasswordMasked] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const { data: teamCatalog = [] } = useTeamsCatalogQuery();
  const strength = useMemo(() => passwordStrength(password), [password]);

  const handleSportChange = (sport: SportType) => {
    setPreferredSport(sport);
    const sportLabel = sport === SportType.RUGBY ? 'Rugby' : 'Football';
    const currentTeam = teamCatalog.find(
      (t) => t.name.toLowerCase() === supportedTeam.toLowerCase(),
    );
    if (currentTeam && currentTeam.sport !== sportLabel) {
      setSupportedTeam('');
      setTeamSearch('');
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { firstName, surname } = splitFullName(fullName);

    if (!fullName.trim() || !email.trim() || !password || !nickname.trim() || !supportedTeam.trim()) {
      setErrorMessage('Please complete all required fields.');
      return;
    }
    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }
    if (nickname.length < 3) {
      setErrorMessage('Username must be at least 3 characters.');
      return;
    }
    if (!ageConfirmed) {
      setShowParentalGate(true);
      setErrorMessage('');
      return;
    }
    if (!agreedToTerms) {
      setErrorMessage('You must agree to the Terms of Service and Privacy Policy.');
      return;
    }

    const players = await dbFetchPlayers();
    if (players.some((u) => u.nickname.toLowerCase() === nickname.toLowerCase())) {
      setErrorMessage('Username is already taken. Please choose another.');
      return;
    }
    if (players.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      setErrorMessage('An account with this email address already exists.');
      return;
    }

    try {
      if (isSupabaseConfigured() && supabase) {
        const { error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              full_name: fullName.trim(),
              first_name: firstName,
              surname,
              username: nickname.trim(),
              phone: phone.trim() || null,
              nationality: selectedNationality,
              age_confirmed_13: true,
              terms_accepted: true,
              agreed_to_terms: true,
              dob: null,
              supported_team: supportedTeam.trim(),
              preferred_sport: preferredSport,
              selected_sports: [preferredSport],
            },
          },
        });
        if (error) throw error;
      }
      setMode('awaiting_email_confirmation');
    } catch (sbError: unknown) {
      const err =
        sbError && typeof sbError === 'object'
          ? (sbError as { message?: string; code?: string })
          : { message: typeof sbError === 'string' ? sbError : undefined };
      console.error('Signup failed:', err.message || String(sbError));
      if (err.code === '23505' || (err.message && String(err.message).includes('duplicate key'))) {
        setErrorMessage('This email or username is already in use.');
      } else if (err.message === 'Failed to fetch' || String(err.message || '').includes('fetch')) {
        setErrorMessage('Network error connecting to the database. Please try again.');
      } else {
        setErrorMessage(
          String(
            err.message ||
              (typeof sbError === 'string' ? sbError : 'Registration failed. Please try again.'),
          ),
        );
      }
    }
  };

  const nationMatched = NATIONS_LIST.find(
    (n) => n.name === selectedNationality || n.code === selectedNationality,
  );
  const nationCode = (nationMatched?.code || 'GB').toLowerCase();

  return (
    <div className="w-full max-w-md mx-auto relative z-10">
      <div className="text-center mb-8">
        <div
          onClick={onLogoClick}
          className={onLogoClick ? 'cursor-pointer inline-block' : 'inline-block'}
          title={onLogoClick ? 'Return to home' : undefined}
        >
          <PitchSideLogo size="lg" autoplay={true} />
        </div>
        <p className="text-xs text-slate-400 font-mono mt-2 uppercase tracking-widest">
          Play. Predict. Prevail.
        </p>
      </div>

      <div className="bg-slate-900/85 backdrop-blur-md rounded-2xl border border-slate-800 p-6 shadow-2xl relative">
        <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-blue-500 via-green-500 to-red-500 rounded-t-2xl" />

        {mode === 'signup' && (
          <>
          {onTakeTour && (
            <button
              type="button"
              onClick={onTakeTour}
              className="mb-4 w-full text-center text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
            >
              Take a Tour
            </button>
          )}
          <div className="flex border-b border-slate-800 mb-6 pb-1">
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="flex-1 flex justify-center pb-3 text-sm font-semibold font-display tracking-wide uppercase text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            >
              <span className="relative inline-block text-center">Login</span>
            </button>
            <div className="flex-1 flex justify-center">
              <span className="relative inline-block pb-3 text-sm font-semibold font-display tracking-wide uppercase text-white text-center">
                Create Account
                <motion.div
                  layoutId="authTabId"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-500"
                />
              </span>
            </div>
          </div>
          </>
        )}

        {errorMessage && (
          <div className="mb-4 p-3 bg-red-950/40 border border-red-500/30 rounded-lg text-xs text-red-300 flex items-start gap-2">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{String(errorMessage)}</span>
          </div>
        )}

        <AnimatePresence mode="wait">
          {mode === 'signup' && (
            <motion.form
              key="signup-form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              onSubmit={handleSignupSubmit}
              className="space-y-3.5"
            >
              {/* Full name + Username */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={LABEL} htmlFor="signup-fullname-input">
                    Full name
                  </label>
                  <input
                    id="signup-fullname-input"
                    type="text"
                    required
                    autoComplete="name"
                    placeholder="Jamie Carter"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className={INPUT}
                  />
                </div>
                <div>
                  <label className={LABEL} htmlFor="signup-nickname-input">
                    Username
                  </label>
                  <div className="relative">
                    <Sparkles className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                    <input
                      id="signup-nickname-input"
                      type="text"
                      required
                      maxLength={15}
                      autoComplete="username"
                      placeholder="GoalGetter"
                      value={nickname}
                      onChange={(e) =>
                        setNickname(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))
                      }
                      className={`${INPUT} pl-10`}
                    />
                  </div>
                </div>
              </div>

              {/* Nationality | Sport + Team */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
                <div>
                  <label className={LABEL}>Nationality</label>
                  <div className="relative">
                    <button
                      id="signup-nationality-btn"
                      type="button"
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      className="w-full bg-slate-950/60 border border-slate-800 hover:border-slate-700 rounded-lg py-2.5 pl-3.5 pr-10 text-sm text-white outline-none transition-colors flex items-center justify-between cursor-pointer"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <img
                          src={`https://flagcdn.com/16x12/${nationCode}.png`}
                          width="16"
                          height="12"
                          alt=""
                          className="rounded-xs object-cover shrink-0"
                          referrerPolicy="no-referrer"
                        />
                        <span className="font-medium text-slate-200 truncate">
                          {nationMatched
                            ? `${nationMatched.name}`
                            : selectedNationality}
                        </span>
                      </span>
                      <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                    </button>
                    <AnimatePresence>
                      {isDropdownOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-slate-900 border border-slate-800 rounded-lg shadow-2xl z-20"
                        >
                          <div className="sticky top-0 p-1.5 bg-slate-900 border-b border-slate-800">
                            <input
                              type="text"
                              placeholder="Search nationality…"
                              value={nationalitySearch}
                              onChange={(e) => setNationalitySearch(e.target.value)}
                              className="w-full bg-slate-950/80 border border-slate-800 rounded-md py-1 px-2 text-[11px] text-white outline-none font-sans"
                            />
                          </div>
                          {NATIONS_LIST.filter(
                            (nation) =>
                              nation.name
                                .toLowerCase()
                                .includes(nationalitySearch.toLowerCase()) ||
                              nation.code
                                .toLowerCase()
                                .includes(nationalitySearch.toLowerCase()),
                          ).map((nation) => (
                            <button
                              key={nation.code}
                              type="button"
                              onClick={() => {
                                setSelectedNationality(nation.name);
                                setIsDropdownOpen(false);
                                setNationalitySearch('');
                              }}
                              className="w-full text-left px-3 py-2 text-xs hover:bg-slate-800 text-slate-300 hover:text-white flex items-center gap-2 cursor-pointer transition-colors"
                            >
                              <img
                                src={`https://flagcdn.com/16x12/${nation.code.toLowerCase()}.png`}
                                width="16"
                                height="12"
                                alt=""
                                className="rounded-xs object-cover"
                                referrerPolicy="no-referrer"
                              />
                              <span className="flex-1 text-[11px] text-slate-200">
                                {nation.name}
                              </span>
                              {(selectedNationality === nation.name ||
                                selectedNationality === nation.code) && (
                                <Check className="w-3.5 h-3.5 text-green-400" />
                              )}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className={LABEL}>Preferred sport</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleSportChange(SportType.FOOTBALL)}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all border cursor-pointer ${
                          preferredSport === SportType.FOOTBALL
                            ? 'bg-blue-500/15 border-blue-500/40 text-blue-300'
                            : 'bg-slate-950/60 border-slate-800 text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        Football
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSportChange(SportType.RUGBY)}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all border cursor-pointer ${
                          preferredSport === SportType.RUGBY
                            ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                            : 'bg-slate-950/60 border-slate-800 text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        Rugby
                      </button>
                    </div>
                  </div>

                  <div className="relative">
                    <label className={LABEL} htmlFor="signup-supportedteam-input">
                      {preferredSport === SportType.RUGBY
                        ? 'Supported Rugby team'
                        : 'Supported Football team'}
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                      <input
                        id="signup-supportedteam-input"
                        type="text"
                        required
                        placeholder="Search club"
                        value={isTeamDropdownOpen ? teamSearch : supportedTeam}
                        onChange={(e) => {
                          setTeamSearch(e.target.value);
                          setIsTeamDropdownOpen(true);
                          setSupportedTeam(e.target.value);
                        }}
                        onFocus={() => {
                          setTeamSearch('');
                          setIsTeamDropdownOpen(true);
                        }}
                        className={`${INPUT} pl-10 pr-10`}
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => {
                          setIsTeamDropdownOpen(!isTeamDropdownOpen);
                          setTeamSearch('');
                        }}
                        className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 cursor-pointer"
                      >
                        <ChevronDown
                          className={`w-4 h-4 transition-transform ${
                            isTeamDropdownOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                    </div>
                    <AnimatePresence>
                      {isTeamDropdownOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-40 cursor-default"
                            onClick={() => {
                              setIsTeamDropdownOpen(false);
                              setTeamSearch('');
                            }}
                          />
                          <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-slate-950 border border-slate-800 rounded-lg shadow-2xl z-50 divide-y divide-slate-900/40"
                          >
                            {(() => {
                              const sportLabel =
                                preferredSport === SportType.RUGBY ? 'Rugby' : 'Football';
                              const { countries, clubs } = filterTeams(
                                teamCatalog,
                                sportLabel,
                                teamSearch,
                              );
                              if (countries.length === 0 && clubs.length === 0) {
                                return (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSupportedTeam(teamSearch);
                                      setIsTeamDropdownOpen(false);
                                      setTeamSearch('');
                                    }}
                                    className="w-full text-left px-3.5 py-2 text-xs text-slate-400 hover:bg-slate-900/60 cursor-pointer"
                                  >
                                    Use custom team:{' '}
                                    <span className="font-bold text-white">
                                      &quot;{teamSearch}&quot;
                                    </span>
                                  </button>
                                );
                              }
                              const renderTeamBtn = (
                                team: (typeof countries)[number],
                                withFlag: boolean,
                              ) => (
                                <button
                                  key={`${team.category}-${team.name}`}
                                  type="button"
                                  onClick={() => {
                                    setSupportedTeam(team.name);
                                    setTeamSearch('');
                                    setIsTeamDropdownOpen(false);
                                  }}
                                  className={`w-full text-left px-3.5 py-2 text-xs flex items-center gap-2 hover:bg-slate-900/60 cursor-pointer ${
                                    supportedTeam === team.name
                                      ? 'bg-slate-900 text-green-400 font-bold'
                                      : 'text-slate-300'
                                  }`}
                                >
                                  {withFlag ? (
                                    <CountryFlag
                                      code={team.countryCode}
                                      alt={team.name}
                                      size={18}
                                    />
                                  ) : null}
                                  <span className="truncate">{team.name}</span>
                                </button>
                              );
                              return (
                                <>
                                  {countries.map((t) => renderTeamBtn(t, true))}
                                  {clubs.map((t) => renderTeamBtn(t, false))}
                                </>
                              );
                            })()}
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              {/* Email */}
              <div>
                <label className={LABEL} htmlFor="signup-email-input">
                  Email address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    id="signup-email-input"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`${INPUT} pl-10`}
                  />
                </div>
              </div>

              {/* Password + strength */}
              <div>
                <label className={LABEL} htmlFor="signup-password-input">
                  Password
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    id="signup-password-input"
                    type={isPasswordMasked ? 'password' : 'text'}
                    required
                    autoComplete="new-password"
                    minLength={8}
                    placeholder="8+ characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`${INPUT} pl-10 pr-10`}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setIsPasswordMasked(!isPasswordMasked)}
                    className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 cursor-pointer"
                  >
                    {isPasswordMasked ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4 text-white" />
                    )}
                  </button>
                </div>
                {password.length > 0 && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex-1 flex gap-1">
                      {[0, 1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full ${
                            i < strength.score
                              ? strength.score <= 1
                                ? 'bg-rose-500'
                                : strength.score === 2
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                              : 'bg-slate-800'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-[10px] text-slate-500 shrink-0">
                      {strength.label}
                    </span>
                  </div>
                )}
              </div>

              {/* Optional phone */}
              <div className="rounded-lg border border-dashed border-slate-700/80 px-3 py-2.5">
                <label className={LABEL} htmlFor="signup-phone-input">
                  Phone number — optional, for kickoff reminders
                </label>
                <input
                  id="signup-phone-input"
                  type="tel"
                  autoComplete="tel"
                  placeholder="+44 7911 123456"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={INPUT}
                />
              </div>

              {/* Age + Terms */}
              <div className="space-y-2.5 pt-1">
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    id="signup-age-checkbox"
                    type="checkbox"
                    checked={ageConfirmed}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setAgeConfirmed(checked);
                      if (!checked) setShowParentalGate(true);
                    }}
                    className="mt-0.5 accent-emerald-500 rounded-xs bg-slate-950 border-slate-800"
                  />
                  <span className="text-xs text-slate-400 leading-normal">
                    I confirm that I am 13 years of age or older
                  </span>
                </label>
                {showParentalGate && !ageConfirmed && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-950/30 px-3 py-2.5 text-[11px] text-amber-100/90 font-sans leading-relaxed">
                    If you are under 13, please ask a parent or guardian for permission.
                    They can email{" "}
                    <a
                      href="mailto:admin@pitchside.pro"
                      className="text-emerald-400 underline font-semibold"
                    >
                      admin@pitchside.pro
                    </a>{" "}
                    to confirm they are happy for you to play.
                  </div>
                )}
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    id="signup-terms-checkbox"
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="mt-0.5 accent-emerald-500 rounded-xs bg-slate-950 border-slate-800"
                  />
                  <span className="text-xs text-slate-400 leading-normal">
                    I agree to the{" "}
                    <a
                      href="/terms"
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-400 underline hover:text-emerald-300"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Terms of Service
                    </a>{" "}
                    and{" "}
                    <a
                      href="/privacy"
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-400 underline hover:text-emerald-300"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Privacy Policy
                    </a>
                    .
                  </span>
                </label>
              </div>

              <button
                id="signup-submit-btn"
                type="submit"
                disabled={!agreedToTerms}
                className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold font-display tracking-wide rounded-lg py-2.5 text-xs uppercase flex items-center justify-center gap-1.5 cursor-pointer transition-transform shadow-[0_4px_12px_rgba(59,130,246,0.3)]"
              >
                Create account <ArrowRight className="w-4 h-4" />
              </button>

              <OAuthButtons onError={setErrorMessage} />
            </motion.form>
          )}

          {mode === 'awaiting_email_confirmation' && (
            <motion.div
              key="awaiting-confirmation"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="text-center py-6 space-y-4"
            >
              <Mail className="w-12 h-12 text-blue-500 mx-auto" />
              <h3 className="text-lg font-bold text-white font-display">
                Check your inbox
              </h3>
              <p className="text-sm text-slate-300 px-4 leading-relaxed">
                Account created. Click the verification link we emailed you to
                activate your account — that confirms your address (no need to
                re-type it at signup).
              </p>
              <button
                type="button"
                onClick={() => {
                  onSwitchToLogin();
                  setErrorMessage('');
                }}
                className="mt-4 bg-slate-950 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 font-semibold rounded-lg py-2.5 px-6 text-xs cursor-pointer transition-all"
              >
                Return to Login
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-6 text-center text-xs text-slate-500">
        <span>PitchSide © {new Date().getFullYear()}</span>
      </div>
    </div>
  );
}
