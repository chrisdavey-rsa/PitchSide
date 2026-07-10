/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mail, 
  User, 
  Shield, 
  KeyRound, 
  Calendar, 
  CheckSquare, 
  Sparkles, 
  LogIn, 
  ArrowRight, 
  Play, 
  Info,
  Globe,
  ChevronDown,
  Check,
  Eye,
  EyeOff
} from 'lucide-react';
import { UserProfile, SportType } from '../types';
import PitchSideLogo from './PitchSideLogo';
import { dbCreatePlayer, dbFetchPlayers, isSupabaseConfigured, supabase } from '../supabase';

const NATIONS_LIST = [
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'IE', name: 'Ireland', flag: '🇮🇪' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'NZ', name: 'New Zealand', flag: '🇳🇿' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦' },
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵' },
  { code: 'AR', name: 'Argentina', flag: '🇦🇷' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱' },
  { code: 'PT', name: 'Portugal', flag: '🇵🇹' },
  { code: 'IN', name: 'India', flag: '🇮🇳' },
  { code: 'CH', name: 'Switzerland', flag: '🇨🇭' },
  { code: 'BE', name: 'Belgium', flag: '🇧🇪' },
  { code: 'SE', name: 'Sweden', flag: '🇸🇪' },
  { code: 'NO', name: 'Norway', flag: '🇳🇴' },
  { code: 'FI', name: 'Finland', flag: '🇫🇮' },
  { code: 'DK', name: 'Denmark', flag: '🇩🇰' },
];

const MAJOR_TEAMS_LIST = [
  // Premier League & Major Football Clubs
  { name: 'Arsenal', sport: 'Football', icon: '⚽' },
  { name: 'Aston Villa', sport: 'Football', icon: '⚽' },
  { name: 'Bournemouth', sport: 'Football', icon: '⚽' },
  { name: 'Brentford', sport: 'Football', icon: '⚽' },
  { name: 'Brighton & Hove Albion', sport: 'Football', icon: '⚽' },
  { name: 'Chelsea', sport: 'Football', icon: '⚽' },
  { name: 'Crystal Palace', sport: 'Football', icon: '⚽' },
  { name: 'Everton', sport: 'Football', icon: '⚽' },
  { name: 'Fulham', sport: 'Football', icon: '⚽' },
  { name: 'Ipswich Town', sport: 'Football', icon: '⚽' },
  { name: 'Leicester City', sport: 'Football', icon: '⚽' },
  { name: 'Liverpool', sport: 'Football', icon: '⚽' },
  { name: 'Manchester City', sport: 'Football', icon: '⚽' },
  { name: 'Manchester United', sport: 'Football', icon: '⚽' },
  { name: 'Newcastle United', sport: 'Football', icon: '⚽' },
  { name: 'Nottingham Forest', sport: 'Football', icon: '⚽' },
  { name: 'Southampton', sport: 'Football', icon: '⚽' },
  { name: 'Tottenham Hotspur', sport: 'Football', icon: '⚽' },
  { name: 'West Ham United', sport: 'Football', icon: '⚽' },
  { name: 'Wolverhampton Wanderers', sport: 'Football', icon: '⚽' },
  { name: 'Real Madrid', sport: 'Football', icon: '⚽' },
  { name: 'Barcelona', sport: 'Football', icon: '⚽' },
  { name: 'Bayern Munich', sport: 'Football', icon: '⚽' },
  { name: 'Paris Saint-Germain', sport: 'Football', icon: '⚽' },
  { name: 'Inter Milan', sport: 'Football', icon: '⚽' },
  { name: 'AC Milan', sport: 'Football', icon: '⚽' },
  { name: 'Juventus', sport: 'Football', icon: '⚽' },
  { name: 'Celtic', sport: 'Football', icon: '⚽' },
  { name: 'Rangers', sport: 'Football', icon: '⚽' },

  // Major Rugby Unions / Teams
  { name: 'All Blacks', sport: 'Rugby', icon: '🏉' },
  { name: 'Springboks', sport: 'Rugby', icon: '🏉' },
  { name: 'Wallabies', sport: 'Rugby', icon: '🏉' },
  { name: 'England', sport: 'Rugby', icon: '🏉' },
  { name: 'Ireland', sport: 'Rugby', icon: '🏉' },
  { name: 'Wales', sport: 'Rugby', icon: '🏉' },
  { name: 'Scotland', sport: 'Rugby', icon: '🏉' },
  { name: 'France', sport: 'Rugby', icon: '🏉' },
  { name: 'Italy', sport: 'Rugby', icon: '🏉' },
  { name: 'Japan', sport: 'Rugby', icon: '🏉' },
  { name: 'Los Pumas', sport: 'Rugby', icon: '🏉' },
  { name: 'Fiji', sport: 'Rugby', icon: '🏉' },
  { name: 'Samoa', sport: 'Rugby', icon: '🏉' },

  // European Rugby Clubs
  { name: 'Leinster', sport: 'Rugby', icon: '🏉' },
  { name: 'Munster', sport: 'Rugby', icon: '🏉' },
  { name: 'Saracens', sport: 'Rugby', icon: '🏉' },
  { name: 'Leicester Tigers', sport: 'Rugby', icon: '🏉' },
  { name: 'Toulouse', sport: 'Rugby', icon: '🏉' },
  { name: 'La Rochelle', sport: 'Rugby', icon: '🏉' },
  { name: 'Northampton Saints', sport: 'Rugby', icon: '🏉' },
  { name: 'Harlequins', sport: 'Rugby', icon: '🏉' },
  { name: 'Bath', sport: 'Rugby', icon: '🏉' },
  { name: 'Stormers', sport: 'Rugby', icon: '🏉' },
  { name: 'Bulls', sport: 'Rugby', icon: '🏉' },
  { name: 'Crusaders', sport: 'Rugby', icon: '🏉' },
  { name: 'Blues', sport: 'Rugby', icon: '🏉' },
];

interface AuthFlowProps {
  onAuthSuccess: (user: UserProfile) => void;
  onOpenRules: () => void;
  registeredUsers: UserProfile[];
  onAddNewUser: (user: UserProfile) => void;
}

export default function AuthFlow({ onAuthSuccess, onOpenRules, registeredUsers, onAddNewUser }: AuthFlowProps) {
  const [mode, setMode] = useState<'login' | 'signup' | 'awaiting_email_confirmation' | 'recovery_request' | 'recovery_confirmation'>('login');

  // Form states
  const [firstName, setFirstName] = useState('');
  const [surname, setSurname] = useState('');
  const [email, setEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [dob, setDob] = useState('');
  const [showCalendar, setShowCalendar] = useState(false);
  const [calMonth, setCalMonth] = useState(9); // Default October
  const [calYear, setCalYear] = useState(1995); // Default 1995
  const [nickname, setNickname] = useState('');
  const [phone, setPhone] = useState('');
  const [phonePlaceholder] = useState(() => {
    let randomNum = '';
    for(let i=0; i<12; i++) {
      randomNum += Math.floor(Math.random() * 10).toString();
    }
    return randomNum;
  });
  const [isPhoneFocused, setIsPhoneFocused] = useState(false);
  const [selectedNationality, setSelectedNationality] = useState('United Kingdom');
  const [supportedTeam, setSupportedTeam] = useState('');
  const [nationalitySearch, setNationalitySearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [teamSearch, setTeamSearch] = useState('');
  const [isTeamDropdownOpen, setIsTeamDropdownOpen] = useState(false);
  const [preferredSport, setPreferredSport] = useState<SportType>(SportType.FOOTBALL);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Switching preferred sport clears any team that no longer matches the sport
  const handleSportChange = (sport: SportType) => {
    setPreferredSport(sport);
    const sportLabel = sport === SportType.RUGBY ? 'Rugby' : 'Football';
    const currentTeam = MAJOR_TEAMS_LIST.find(
      (t) => t.name.toLowerCase() === supportedTeam.toLowerCase()
    );
    if (currentTeam && currentTeam.sport !== sportLabel) {
      setSupportedTeam('');
      setTeamSearch('');
    }
  };

  // Masking toggles for passwords
  const [isPasswordMasked, setIsPasswordMasked] = useState(true);
  const [isConfirmPasswordMasked, setIsConfirmPasswordMasked] = useState(true);
  const [isLoginPasswordMasked, setIsLoginPasswordMasked] = useState(true);

  // Login states
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Password recovery states
  const [recoveryInput, setRecoveryInput] = useState('');
  const [currentUserDraft, setCurrentUserDraft] = useState<UserProfile | null>(null);

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Auto fill for simple play testing
  const fillSampleData = () => {
    setFirstName('Chris');
    setSurname('Davey');
    setEmail('chrispeter.davey@gmail.com');
    setConfirmEmail('chrispeter.davey@gmail.com');
    setPassword('ChrisDavey123');
    setConfirmPassword('ChrisDavey123');
    setDob('1995-10-15');
    setNickname('DaveyPredicts');
    setSelectedNationality('United Kingdom');
    setSupportedTeam('Arsenal');
    setAgreedToTerms(true);
    setErrorMessage('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!loginIdentifier.trim()) {
      setErrorMessage('Please enter your username or email address.');
      return;
    }

    // Standard profile resolution
    const sanitizedIdentifier = loginIdentifier.trim();
    const isEmailInput = sanitizedIdentifier.includes('@');
    const supabaseKeysSet = isSupabaseConfigured() && supabase;

    let loginEmail = isEmailInput ? sanitizedIdentifier : '';

    // If it's a nickname, attempt to securely resolve the email
    if (supabaseKeysSet && !isEmailInput) {
      // Use RPC to bypass RLS for this specific lookup
      const { data: rpcEmail, error: rpcError } = await supabase.rpc('get_email_by_nickname', {
        search_nickname: sanitizedIdentifier
      });
      
      if (rpcEmail) {
        loginEmail = rpcEmail;
      } else {
        setErrorMessage('Username not found. Please verify your details or sign up.');
        return;
      }
    }

    try {
      if (supabaseKeysSet) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: loginEmail,
          password: loginPassword,
        });

        if (error) throw error;

        // Fetch their profile explicitly after authenticating just in case RLS blocked the global fetch
        let authProfile;
        const { data: userProfileData } = await supabase.from('profiles').select('*').eq('id', data.user?.id).single();
        if (userProfileData) {
          authProfile = {
            id: userProfileData.id,
            firstName: userProfileData.first_name || '',
            surname: userProfileData.surname || '',
            email: userProfileData.email || loginEmail,
            phone: userProfileData.phone || '',
            dob: userProfileData.dob || '1990-01-01',
            nickname: userProfileData.username || userProfileData.nickname || 'Contestant',
            createdAt: userProfileData.created_at || new Date().toISOString(),
            emailVerified: !!data.user?.email_confirmed_at,
            emailConfirmedAt: data.user?.email_confirmed_at || null,
            isAdmin: userProfileData.is_admin || false,
            agreedToTerms: true,
            nationality: userProfileData.nationality || 'Global',
            supportedTeam: userProfileData.supported_team || 'Unknown',
            preferredSport: (userProfileData.preferred_sport as SportType) || undefined,
          };
        } else {
          // Fallback minimal profile if the db profile isn't found
          authProfile = {
            id: data.user?.id || '',
            firstName: 'Player',
            surname: '',
            email: data.user?.email || loginEmail,
            phone: '',
            dob: '1990-01-01',
            nickname: data.user?.email?.split('@')[0] || 'Player',
            nationality: 'Global',
            supportedTeam: 'Unknown',
            createdAt: new Date().toISOString(),
            emailVerified: !!data.user?.email_confirmed_at,
            emailConfirmedAt: data.user?.email_confirmed_at || null,
            isAdmin: false,
            agreedToTerms: true
          };
        }
        
        const profile: UserProfile = {
          id: data.user?.id || authProfile.id,
          firstName: authProfile.firstName,
          surname: authProfile.surname,
          email: authProfile.email,
          phone: authProfile.phone,
          dob: authProfile.dob,
          nickname: authProfile.nickname,
          nationality: authProfile.nationality,
          supportedTeam: authProfile.supportedTeam || 'None',
          createdAt: authProfile.createdAt,
          emailVerified: !!data.user?.email_confirmed_at,
          emailConfirmedAt: data.user?.email_confirmed_at || null,
          isAdmin: authProfile.isAdmin,
          agreedToTerms: authProfile.agreedToTerms || true,
        };

        onAddNewUser(profile);
        onAuthSuccess(profile);
        setSuccessMessage(`Welcome back, ${profile.nickname}!`);
        return;
      }

      // Offline Sandbox Mode fallback logic - check password if defined on local mock profile
      const players = await dbFetchPlayers();
      let targetMatch = players.find(
        (u) =>
          u.nickname.toLowerCase() === sanitizedIdentifier.toLowerCase() ||
          u.email.toLowerCase() === sanitizedIdentifier.toLowerCase()
      );

      if (!targetMatch) {
        setErrorMessage('User does not exist in the database. Please verify your username/email, or switch to Create Account.');
        return;
      }
      
      if (targetMatch.password && loginPassword !== targetMatch.password) {
        setErrorMessage('Incorrect password. Click the "Forgot Password?" link below to safely recover your account.');
         return;
      }

      const profile: UserProfile = {
        ...targetMatch,
        emailVerified: true
      };
      onAddNewUser(profile);
      onAuthSuccess(profile);
      setSuccessMessage(`Welcome back, ${profile.nickname}! [Sandbox Mode]`);

    } catch (sbError: any) {
      console.error('PostgreSQL Signup failed:', sbError);
      
      // 1. Extract the message safely
      let errorText = sbError?.message;
      
      // 2. Intercept the literal "{}" string bug from Supabase
      if (!errorText || errorText === '{}' || errorText === '[object Object]') {
        errorText = 'Registration failed due to a backend database error. Please check the console.';
      }
      
      // 3. Route to the correct UI state
      if (sbError?.code === '23505' || String(errorText).includes('duplicate key')) {
        setErrorMessage('This email or nickname is already in use in the database.');
      } else if (String(errorText).includes('fetch')) {
        setErrorMessage('Network error connecting to the database. Please check your Supabase credentials.');
      } else {
        setErrorMessage(String(errorText));
      }
    }
  };

  // Password Recovery Handlers
  const handleRecoveryRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!recoveryInput.trim()) {
      setErrorMessage('Please enter your registered username or email.');
      return;
    }

    if (isSupabaseConfigured() && supabase) {
      const { error } = await supabase.auth.resetPasswordForEmail(recoveryInput.trim().toLowerCase());
      if (error) {
        setErrorMessage('Failed to send a recovery link. Make sure this is a registered email account');
        return;
      }
    }

    setMode('recovery_confirmation');
    setSuccessMessage(`A password reset link has been sent to your email. Please click it to define a new password.`);
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !surname || !email || !confirmEmail || !password || !confirmPassword || !dob || !nickname || !supportedTeam) {
      setErrorMessage('All fields are requested, including nationality and supported team.');
      return;
    }

    if (email.toLowerCase().trim() !== confirmEmail.toLowerCase().trim()) {
      setErrorMessage('Email Address and Confirm Email Address fields do not match.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Password and Confirm Password fields do not match.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    if (nickname.length < 3) {
      setErrorMessage('Username must be at least 3 characters.');
      return;
    }

    if (!agreedToTerms) {
      setErrorMessage('You must accept the Terms & Conditions.');
      return;
    }

    // Check age logic (Must be at least 16 years old)
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    if (age < 16) {
      setErrorMessage('Contestants must be at least 16 years old to register.');
      return;
    }

    // Local duplicated check against non-binned active users from the database
    const players = await dbFetchPlayers();
    const duplicateNickname = players.some((u) => u.nickname.toLowerCase() === nickname.toLowerCase());
    if (duplicateNickname) {
      setErrorMessage('Nickname is already taken. Please choose another username.');
      return;
    }

    const duplicateEmail = players.some((u) => u.email.toLowerCase() === email.toLowerCase());
    if (duplicateEmail) {
      setErrorMessage('An account with this email address already exists.');
      return;
    }

    // --- THE NEW UPDATED TRY/CATCH BLOCK STARTS HERE ---
    try {
      let finalUid = isSupabaseConfigured()
        ? `usr_${Math.random().toString(36).substring(2, 12)}`
        : `usr_local_${Math.random().toString(36).substring(2, 11)}`;

      if (isSupabaseConfigured() && supabase) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password: password,
          options: {
            data: {
              first_name: firstName.trim(),
              surname: surname.trim(),
              username: nickname.trim(),
              phone: phone.trim(),
              nationality: selectedNationality,
              dob: dob,
              supported_team: supportedTeam.trim(),
              preferred_sport: preferredSport,
            }
          }
        });

        if (error) {
          throw error;
        }

        if (data?.user?.id) {
          finalUid = data.user.id;
        }
      }

      const draftUser: UserProfile = {
        id: finalUid,
        firstName: firstName.trim(),
        surname: surname.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        dob,
        nickname: nickname.trim(),
        nationality: selectedNationality,
        supportedTeam: supportedTeam.trim(),
        preferredSport,
        createdAt: new Date().toISOString(),
        emailVerified: false,
        isAdmin: false, // Strictly enforced
        agreedToTerms: true,
      };

      setCurrentUserDraft(draftUser);



      setMode('awaiting_email_confirmation');
      setSuccessMessage(`Account successfully created! Please check your email inbox and click the verification link to activate your account.`);
    } catch (sbError: any) {
      console.error('PostgreSQL Signup failed:', sbError?.message || (typeof sbError === 'object' ? JSON.stringify(sbError) : String(sbError)));
      
      // Look for specific database-level error codes to give the user better feedback
      if (sbError?.code === '23505' || (sbError?.message && String(sbError.message).includes('duplicate key'))) {
        setErrorMessage('This email or nickname is already in use in the database.');
      } else if (sbError?.message === 'Failed to fetch' || String(sbError?.message).includes('fetch')) {
        setErrorMessage('Network error connecting to the database. Please check your Supabase credentials.');
      } else {
        const errorText = sbError?.message || (typeof sbError === 'string' ? sbError : 'Registration failed. Please try again.');
        setErrorMessage(String(errorText));
      }
    }
  };

  const maxDobDate = new Date();
  maxDobDate.setFullYear(maxDobDate.getFullYear() - 16);
  const maxDobStr = maxDobDate.toISOString().split('T')[0];

  return (
    <div className="w-full max-w-md mx-auto relative z-10">
      {/* Dynamic Header */}
      <div className="text-center mb-8">
        <PitchSideLogo size="lg" autoplay={true} />
        <p className="text-xs text-slate-400 font-mono mt-2 uppercase tracking-widest">
          Play. Predict. Prevail.
        </p>
      </div>

      <div className="bg-slate-900/85 backdrop-blur-md rounded-2xl border border-slate-800 p-6 shadow-2xl relative">
        {/* Highlight Accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-blue-500 via-green-500 to-red-500 rounded-t-2xl" />

        {/* Tab Controls */}
        {(mode === 'login' || mode === 'signup') && (
          <div className="flex border-b border-slate-800 mb-6 pb-1">
            <button
              id="switch-login-btn"
              onClick={() => {
                setMode('login');
                setErrorMessage('');
                setSuccessMessage('');
              }}
              className={`flex-1 pb-3 text-sm font-semibold font-display tracking-wide uppercase transition-colors relative cursor-pointer ${
                mode === 'login' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Login
              {mode === 'login' && (
                <motion.div layoutId="authTabId" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
              )}
            </button>
            <button
              id="switch-signup-btn"
              onClick={() => {
                setMode('signup');
                setErrorMessage('');
                setSuccessMessage('');
              }}
              className={`flex-1 pb-3 text-sm font-semibold font-display tracking-wide uppercase transition-colors relative cursor-pointer ${
                mode === 'signup' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Create Account
              {mode === 'signup' && (
                <motion.div layoutId="authTabId" className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-500" />
              )}
            </button>
          </div>
        )}

        {/* Messages */}
        {errorMessage && (
          <div className="mb-4 p-3 bg-red-950/40 border border-red-500/30 rounded-lg text-xs text-red-300 flex flex-col gap-1.5">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{String(errorMessage)}</span>
            </div>
            {String(errorMessage).toLowerCase().includes('password') && !mode.startsWith('recovery_') && (
              <button
                type="button"
                onClick={() => {
                  setMode('recovery_request');
                  setErrorMessage('');
                  if (loginIdentifier) {
                    setRecoveryInput(loginIdentifier);
                  }
                }}
                className="text-left text-blue-400 hover:text-blue-300 underline font-semibold flex items-center gap-1 ml-6 cursor-pointer"
              >
                Click here to recover password <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 bg-green-950/40 border border-green-500/30 rounded-lg text-xs text-green-300 flex items-start gap-2">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* AUTH CONTENT SCREENS */}
        <AnimatePresence mode="wait">
          {mode === 'login' && (
            <motion.form
              key="login-form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              onSubmit={handleLogin}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 font-mono">
                  Username or Email
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    id="login-identifier-input"
                    type="text"
                    required
                    placeholder="username"
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    className="w-full bg-slate-950/60 border border-slate-800 focus:border-blue-500 rounded-lg py-2 pl-10 pr-4 text-sm text-white placeholder:text-slate-600 outline-hidden transition-colors"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('recovery_request');
                      setErrorMessage('');
                      setSuccessMessage('');
                      if (loginIdentifier) {
                        setRecoveryInput(loginIdentifier);
                      }
                    }}
                    className="text-[10px] text-blue-400 hover:text-blue-300 hover:underline cursor-pointer font-semibold font-mono uppercase tracking-wide"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    id="login-password-input"
                    type={isLoginPasswordMasked ? "password" : "text"}
                    placeholder="Enter password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full bg-slate-950/60 border border-slate-800 focus:border-blue-500 rounded-lg py-2 pl-10 pr-10 text-sm text-white placeholder:text-slate-600 outline-hidden transition-colors"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onMouseDown={() => setIsLoginPasswordMasked(false)}
                    onMouseUp={() => setIsLoginPasswordMasked(true)}
                    onMouseLeave={() => setIsLoginPasswordMasked(true)}
                    onTouchStart={() => setIsLoginPasswordMasked(false)}
                    onTouchEnd={() => setIsLoginPasswordMasked(true)}
                    onClick={() => setIsLoginPasswordMasked(!isLoginPasswordMasked)}
                    className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 cursor-pointer"
                  >
                    {isLoginPasswordMasked ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4 text-white" />}
                  </button>
                </div>
              </div>

              <button
                id="login-submit-btn"
                type="submit"
                className="group relative w-full overflow-hidden bg-blue-500 hover:bg-blue-600 active:translate-y-[1px] transition-all text-white font-semibold font-display tracking-wide rounded-lg py-2.5 text-xs uppercase flex items-center justify-center gap-1.5 cursor-pointer shadow-[0_4px_12px_rgba(59,130,246,0.3)]"
              >
                <span className="relative z-10 flex items-center gap-1.5">Enter</span>
                <div className="absolute inset-0 -translate-x-[150%] bg-linear-to-r from-transparent via-white/40 to-transparent group-hover:animate-[shimmer_0.75s_ease-in-out_1]" />
              </button>
            </motion.form>
          )}

          {mode === 'recovery_request' && (
            <motion.form
              key="recovery-request-form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              onSubmit={handleRecoveryRequest}
              className="space-y-4"
            >
              <div className="text-center py-1">
                <Shield className="w-10 h-10 text-blue-400 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">Account Password Recovery</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Enter your registered username or email to verify your identity.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 font-mono">
                  Registered Username or Email
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    id="recovery-identifier-input"
                    type="text"
                    required
                    placeholder="username"
                    value={recoveryInput}
                    onChange={(e) => setRecoveryInput(e.target.value)}
                    className="w-full bg-slate-950/60 border border-slate-800 focus:border-blue-500 rounded-lg py-2 pl-10 pr-4 text-sm text-white placeholder:text-slate-600 outline-hidden transition-colors font-sans"
                  />
                </div>
              </div>

              <div className="flex gap-2.5">
                <button
                  id="recovery-request-back-btn"
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setErrorMessage('');
                    setSuccessMessage('');
                  }}
                  className="flex-1 bg-slate-950 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700 font-semibold rounded-lg py-2 text-xs uppercase cursor-pointer transition-all font-sans"
                >
                  Cancel
                </button>
                <button
                  id="recovery-request-submit-btn"
                  type="submit"
                  className="flex-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold font-display tracking-wide rounded-lg py-2 text-xs uppercase flex items-center justify-center gap-1.5 cursor-pointer shadow-[0_4px_12px_rgba(59,130,246,0.3)] transition-all"
                >
                  Verify Account <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.form>
          )}

          {mode === 'recovery_confirmation' && (
            <motion.div
              key="recovery-confirmation"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="text-center py-6 space-y-4"
            >
              <Mail className="w-12 h-12 text-blue-500 mx-auto" />
              <h3 className="text-lg font-bold text-white uppercase tracking-wider font-mono">Check Your Email</h3>
              <p className="text-sm text-slate-300 px-4">
                A password reset link has been sent to your email address. Please click the link to securely define a new password.
              </p>
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMessage('');
                  setSuccessMessage('');
                }}
                className="mt-6 bg-slate-950 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 font-semibold rounded-lg py-2.5 px-6 text-xs uppercase cursor-pointer transition-all"
              >
                Return to Login
              </button>
            </motion.div>
          )}

          {mode === 'signup' && (
            <motion.form
              key="signup-form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              onSubmit={handleSignupSubmit}
              className="space-y-3.5"
            >
              {/* Name Row */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-[10px] font-semibold text-slate-300 uppercase tracking-wider mb-1 font-mono">
                    First Name
                  </label>
                  <input
                    id="signup-firstname-input"
                    type="text"
                    required
                    placeholder="John"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full bg-slate-950/60 border border-slate-800 focus:border-green-500 rounded-lg py-2 px-3 text-xs text-white placeholder:text-slate-600 outline-hidden transition-colors font-sans"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] font-semibold text-slate-300 uppercase tracking-wider mb-1 font-mono">
                    Surname
                  </label>
                  <input
                    id="signup-surname-input"
                    type="text"
                    required
                    placeholder="Doe"
                    value={surname}
                    onChange={(e) => setSurname(e.target.value)}
                    className="w-full bg-slate-950/60 border border-slate-800 focus:border-green-500 rounded-lg py-2 px-3 text-xs text-white placeholder:text-slate-600 outline-hidden transition-colors font-sans"
                  />
                </div>
              </div>

              {/* Chosen Nickname */}
              <div>
                <label className="block text-[10px] font-semibold text-slate-300 uppercase tracking-wider mb-1 font-mono">
                  Username / Nickname <span className="text-slate-500">(Leaderboard Name)</span>
                </label>
                <div className="relative">
                  <Sparkles className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    id="signup-nickname-input"
                    type="text"
                    required
                    maxLength={15}
                    placeholder="e.g. GoalGetter"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                    className="w-full bg-slate-950/60 border border-slate-800 focus:border-green-500 rounded-lg py-2 pl-10 pr-4 text-xs text-white placeholder:text-slate-600 outline-hidden transition-colors font-sans"
                  />
                </div>
              </div>

              {/* Preferred Nationality Selector */}
              <div>
                <label className="block text-[10px] font-semibold text-slate-300 uppercase tracking-wider mb-1.5 font-mono">
                  Preferred Nationality
                </label>
                <div className="relative">
                  <button
                    id="signup-nationality-btn"
                    type="button"
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="w-full bg-slate-950/60 border border-slate-800 hover:border-slate-700 rounded-lg py-2.5 pl-3.5 pr-10 text-xs text-white outline-hidden transition-colors flex items-center justify-between cursor-pointer animate-fade-in"
                  >
                    <span className="flex items-center gap-2">
                      <span className="select-none shrink-0 flex items-center justify-center">
                        {(() => {
                          const matched = NATIONS_LIST.find((n) => n.name === selectedNationality || n.code === selectedNationality);
                          const cCode = matched ? matched.code.toLowerCase() : 'gb';
                          return (
                            <img 
                              src={`https://flagcdn.com/16x12/${cCode}.png`} 
                              width="16" 
                              height="12" 
                              alt="flag" 
                              className="rounded-xs object-cover select-none"
                              referrerPolicy="no-referrer"
                            />
                          );
                        })()}
                      </span>
                      <span className="font-semibold text-slate-200">
                        {(() => {
                          const matched = NATIONS_LIST.find((n) => n.name === selectedNationality || n.code === selectedNationality);
                          return matched ? `${matched.name} (${matched.code})` : selectedNationality;
                        })()}
                      </span>
                    </span>
                    <ChevronDown className="w-4 h-4 text-slate-500" />
                  </button>

                  {/* Dropdown panel */}
                  <AnimatePresence>
                    {isDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-slate-900 border border-slate-800 rounded-lg shadow-2xl z-20"
                      >
                        {/* Search input to refine options */}
                        <div className="sticky top-0 p-1.5 bg-slate-900 border-b border-slate-800">
                          <input
                            type="text"
                            placeholder="Type to search nationality..."
                            value={nationalitySearch}
                            onChange={(e) => setNationalitySearch(e.target.value)}
                            className="w-full bg-slate-950/80 border border-slate-800 rounded-md py-1 px-2 text-[11px] text-white outline-hidden font-sans"
                          />
                        </div>

                        {/* List entries */}
                        {NATIONS_LIST.filter((nation) =>
                          nation.name.toLowerCase().includes(nationalitySearch.toLowerCase()) ||
                          nation.code.toLowerCase().includes(nationalitySearch.toLowerCase())
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
                            <span className="select-none shrink-0 flex items-center justify-center">
                              <img 
                                src={`https://flagcdn.com/16x12/${nation.code.toLowerCase()}.png`} 
                                width="16" 
                                height="12" 
                                alt={nation.name} 
                                className="rounded-xs object-cover select-none"
                                referrerPolicy="no-referrer"
                              />
                            </span>
                            <span className="flex-1 font-mono text-[11px] text-slate-200">
                              {nation.name} <span className="text-slate-500 font-sans">({nation.code})</span>
                            </span>
                            {(selectedNationality === nation.name || selectedNationality === nation.code) && (
                              <Check className="w-3.5 h-3.5 text-green-400" />
                            )}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Preferred Sport */}
              <div>
                <label className="block text-[10px] font-semibold text-slate-300 uppercase tracking-wider mb-1 font-mono">
                  Preferred Sport
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleSportChange(SportType.FOOTBALL)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                      preferredSport === SportType.FOOTBALL
                        ? 'bg-blue-500/15 border-blue-500/40 text-blue-300'
                        : 'bg-slate-950/60 border-slate-800 text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    <span>⚽</span> Football
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSportChange(SportType.RUGBY)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                      preferredSport === SportType.RUGBY
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                        : 'bg-slate-950/60 border-slate-800 text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    <span>🏉</span> Rugby
                  </button>
                </div>
              </div>

              {/* Supported Team (Searchable Dropdown) */}
              <div className="relative">
                <label className="block text-[10px] font-semibold text-slate-300 uppercase tracking-wider mb-1 font-mono flex items-center justify-between">
                  <span>Supported {preferredSport === SportType.RUGBY ? 'Rugby' : 'Football'} Team</span>
                  {supportedTeam && (
                    <span className="text-[10px] text-green-400 font-bold font-mono">
                      Selected Team
                    </span>
                  )}
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    id="signup-supportedteam-input"
                    type="text"
                    required
                    placeholder="Search/Select supporting club..."
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
                    className="w-full bg-slate-950/60 border border-slate-800 focus:border-green-500 rounded-lg py-2 pl-10 pr-10 text-xs text-white placeholder:text-slate-600 outline-hidden transition-colors font-sans"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setIsTeamDropdownOpen(!isTeamDropdownOpen);
                      setTeamSearch('');
                    }}
                    className="absolute right-3 top-2.5 text-slate-550 hover:text-slate-305 transition-colors cursor-pointer"
                  >
                    <ChevronDown className={`w-4 h-4 text-slate-400 transform transition-transform ${isTeamDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                <AnimatePresence>
                  {isTeamDropdownOpen && (
                    <>
                      {/* Clickaway backdrop shield */}
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
                        className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-slate-950 border border-slate-800 rounded-lg shadow-2xl z-50 divide-y divide-slate-900/40 custom-scrollbar"
                      >
                        {(() => {
                          const searched = teamSearch.trim().toLowerCase();
                          const sportLabel = preferredSport === SportType.RUGBY ? 'Rugby' : 'Football';
                          const filtered = MAJOR_TEAMS_LIST.filter((t) =>
                            t.sport === sportLabel && t.name.toLowerCase().includes(searched)
                          );
                          if (filtered.length === 0) {
                            return (
                              <button
                                type="button"
                                onClick={() => {
                                  setSupportedTeam(teamSearch);
                                  setIsTeamDropdownOpen(false);
                                  setTeamSearch('');
                                }}
                                className="w-full text-left px-3.5 py-2 text-xs text-slate-400 hover:bg-slate-900/60 transition-colors cursor-pointer"
                              >
                                Use custom team: <span className="font-bold text-white">"{teamSearch}"</span>
                              </button>
                            );
                          }
                          return filtered.map((team) => (
                            <button
                              key={team.name}
                              type="button"
                              onClick={() => {
                                setSupportedTeam(team.name);
                                setTeamSearch('');
                                setIsTeamDropdownOpen(false);
                              }}
                              className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between transition-colors hover:bg-slate-900/60 cursor-pointer ${
                                supportedTeam === team.name ? 'bg-slate-900 text-green-400 font-bold' : 'text-slate-300'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-sm">{team.icon}</span>
                                <span className="font-sans text-xs">{team.name}</span>
                              </div>
                              <span className="text-[9px] font-mono text-slate-500 uppercase">{team.sport}</span>
                            </button>
                          ));
                        })()}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              {/* Email Address */}
              <div>
                <label className="block text-[10px] font-semibold text-slate-300 uppercase tracking-wider mb-1 font-mono">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    id="signup-email-input"
                    type="email"
                    required
                    placeholder="john@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-950/60 border border-slate-800 focus:border-green-500 rounded-lg py-2 pl-10 pr-4 text-xs text-white placeholder:text-slate-600 outline-hidden transition-colors font-sans"
                  />
                </div>
              </div>

              {/* Confirm Email Address */}
              <div>
                <label className="block text-[10px] font-semibold text-slate-300 uppercase tracking-wider mb-1 font-mono">
                  Confirm Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    id="signup-confirm-email-input"
                    type="email"
                    required
                    placeholder="Re-enter your email"
                    value={confirmEmail}
                    onChange={(e) => setConfirmEmail(e.target.value)}
                    className="w-full bg-slate-950/60 border border-slate-800 focus:border-green-500 rounded-lg py-2 pl-10 pr-4 text-xs text-white placeholder:text-slate-600 outline-hidden transition-colors font-sans"
                  />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-[10px] font-semibold text-slate-300 uppercase tracking-wider mb-1 font-mono">
                  Phone Number
                </label>
                <div className="relative">
                  <input
                    id="signup-phone-input"
                    type="tel"
                    required
                    placeholder={isPhoneFocused ? '' : phonePlaceholder}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    onFocus={() => setIsPhoneFocused(true)}
                    onBlur={() => setIsPhoneFocused(false)}
                    className="w-full bg-slate-950/60 border border-slate-800 focus:border-green-500 rounded-lg py-2 px-4 text-xs text-white placeholder:text-slate-600 outline-hidden transition-colors font-sans"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-[10px] font-semibold text-slate-300 uppercase tracking-wider mb-1 font-mono">
                  Password
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    id="signup-password-input"
                    type={isPasswordMasked ? 'password' : 'text'}
                    required
                    placeholder="Min. 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-950/60 border border-slate-800 focus:border-green-500 rounded-lg py-2 pl-10 pr-10 text-xs text-white placeholder:text-slate-600 outline-hidden transition-colors font-sans"
                  />
                  {/* Password Toggle Visibility triggers */}
                  <button
                    type="button"
                    onMouseDown={() => setIsPasswordMasked(false)}
                    onMouseUp={() => setIsPasswordMasked(true)}
                    onMouseLeave={() => setIsPasswordMasked(true)}
                    onTouchStart={() => setIsPasswordMasked(false)}
                    onTouchEnd={() => setIsPasswordMasked(true)}
                    onClick={() => setIsPasswordMasked(!isPasswordMasked)}
                    className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 cursor-pointer"
                  >
                    {isPasswordMasked ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4 text-white" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-[10px] font-semibold text-slate-300 uppercase tracking-wider mb-1 font-mono">
                  Confirm Password
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    id="signup-confirm-password-input"
                    type={isConfirmPasswordMasked ? 'password' : 'text'}
                    required
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-slate-950/60 border border-slate-800 focus:border-green-500 rounded-lg py-2 pl-10 pr-10 text-xs text-white placeholder:text-slate-600 outline-hidden transition-colors font-sans"
                  />
                  {/* Secure confirmation eye toggles */}
                  <button
                    type="button"
                    onMouseDown={() => setIsConfirmPasswordMasked(false)}
                    onMouseUp={() => setIsConfirmPasswordMasked(true)}
                    onMouseLeave={() => setIsConfirmPasswordMasked(true)}
                    onTouchStart={() => setIsConfirmPasswordMasked(false)}
                    onTouchEnd={() => setIsConfirmPasswordMasked(true)}
                    onClick={() => setIsConfirmPasswordMasked(!isConfirmPasswordMasked)}
                    className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 cursor-pointer"
                  >
                    {isConfirmPasswordMasked ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4 text-white" />}
                  </button>
                </div>
              </div>

              {/* Date of Birth */}
              <div>
                <label className="block text-[10px] font-semibold text-slate-300 uppercase tracking-wider mb-1 font-mono">
                  Date of Birth
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    id="signup-dob-input"
                    type="text"
                    required
                    readOnly
                    placeholder="YYYY-MM-DD (Click to open calendar)"
                    value={dob}
                    onClick={() => setShowCalendar(!showCalendar)}
                    onFocus={() => setShowCalendar(true)}
                    className="w-full bg-slate-950/60 border border-slate-800 focus:border-green-500 rounded-lg py-2 pl-10 pr-4 text-xs text-white outline-hidden transition-colors font-sans cursor-pointer"
                  />
                  
                  {showCalendar && (
                    <div className="absolute left-0 bottom-[100%] mb-2 p-3 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 w-64 text-xs font-sans">
                      {/* Select controls */}
                      <div className="flex justify-between gap-1.5 mb-2.5">
                        <select 
                          value={calMonth} 
                          onChange={(e) => setCalMonth(parseInt(e.target.value))}
                          className="flex-1 bg-slate-950 border border-slate-800 text-slate-200 text-[11px] rounded px-1.5 py-1 outline-hidden"
                        >
                          {[
                            'January', 'February', 'March', 'April', 'May', 'June',
                            'July', 'August', 'September', 'October', 'November', 'December'
                          ].map((m, idx) => (
                            <option key={m} value={idx}>{m}</option>
                          ))}
                        </select>

                        <select 
                          value={calYear} 
                          onChange={(e) => setCalYear(parseInt(e.target.value))}
                          className="bg-slate-950 border border-slate-800 text-slate-200 text-[11px] rounded px-1.5 py-1 outline-hidden"
                        >
                          {Array.from({ length: 76 }, (_, i) => 2012 - i).map((y) => (
                            <option key={y} value={y}>{y}</option>
                          ))}
                        </select>
                      </div>

                      {/* Day headers */}
                      <div className="grid grid-cols-7 gap-1 text-center font-bold text-slate-500 text-[9px] uppercase mb-1">
                        <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
                      </div>

                      {/* Days Grid */}
                      <div className="grid grid-cols-7 gap-1 text-center">
                        {(() => {
                          const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
                          const startDay = new Date(calYear, calMonth, 1).getDay();
                          
                          const list = [];
                          for (let i = 0; i < startDay; i++) {
                            list.push(<div key={`blank-${i}`} />);
                          }
                          for (let d = 1; d <= daysInMonth; d++) {
                            const pad = (num: number) => num.toString().padStart(2, '0');
                            const dateStr = `${calYear}-${pad(calMonth + 1)}-${pad(d)}`;
                            const isSelected = dob === dateStr;
                            list.push(
                              <button
                                key={`day-${d}`}
                                type="button"
                                onClick={() => {
                                  setDob(dateStr);
                                  setShowCalendar(false);
                                }}
                                className={`py-1 rounded-sm text-[10px] cursor-pointer transition-colors ${
                                  isSelected 
                                    ? 'bg-green-500 text-slate-950 font-bold' 
                                    : 'text-slate-300 hover:bg-slate-800'
                                }`}
                              >
                                {d}
                              </button>
                            );
                          }
                          return list;
                        })()}
                      </div>

                      <div className="flex justify-end mt-2 pt-2 border-t border-slate-800/60">
                        <button
                          type="button"
                          onClick={() => setShowCalendar(false)}
                          className="bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white px-2.5 py-1 rounded text-[10px] font-semibold cursor-pointer border border-slate-800"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Privacy Rules confirmation */}
              <div className="flex items-start gap-2.5 pt-1">
                <input
                  id="signup-terms-checkbox"
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="mt-1 accent-green-500 rounded-xs bg-slate-950 border-slate-800"
                />
                <label htmlFor="signup-terms-checkbox" className="text-xs text-slate-400 leading-normal select-none">
                  I accept the PitchSide <span className="text-slate-200 underline cursor-pointer hover:text-white" onClick={onOpenRules}>Terms of Services</span> and confirm my details are accurate for public leaderboard rosters.
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="flex pt-2">
                <button
                  id="signup-submit-btn"
                  type="submit"
                  className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold font-display tracking-wide rounded-lg py-2 text-xs uppercase flex items-center justify-center gap-1 cursor-pointer transition-transform shadow-[0_4px_12px_rgba(34,197,94,0.3)]"
                >
                  Submit & Confirm <ArrowRight className="w-4 h-4" />
                </button>
              </div>
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
              <h3 className="text-lg font-bold text-white uppercase tracking-wider font-mono">Check Your Email</h3>
              <p className="text-sm text-slate-300 px-4">
                Account successfully created! Please check your email inbox and click the verification link to activate your account.
              </p>
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMessage('');
                  setSuccessMessage('');
                }}
                className="mt-6 bg-slate-950 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 font-semibold rounded-lg py-2.5 px-6 text-xs uppercase cursor-pointer transition-all"
              >
                Return to Login
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-6 text-center text-xs text-slate-500">
        <span>PitchSide © 2026</span>
      </div>
    </div>
  );
}
