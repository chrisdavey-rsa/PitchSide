import React, { useEffect, useState } from 'react';
import { ShieldCheck, Globe, Calendar, ChevronRight, ChevronDown, User, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SportType, UserProfile } from '../../types';
import { supabase } from '../../supabase';
import { NATIONS_LIST } from './data';
import CountryFlag from '../CountryFlag';
import { filterTeams } from '../../data/supportedTeams';
import { useTeamsCatalogQuery } from '../../hooks/usePitchsideQueries';
import { usePushNotifications } from '../../hooks/usePushNotifications';

interface GeneralSettingsProps {
  user: UserProfile;
  onUpdateUser: (updatedUser: UserProfile) => void;
  setStatusMsg: (msg: { text: string; mode: 'success' | 'error' | 'none' }) => void;
  setActiveTab: (tab: 'change-email' | 'general' | 'change-password' | 'historic-scores' | 'leagues' | 'contact-support' | 'delete-account') => void;
}

export const GeneralSettings: React.FC<GeneralSettingsProps> = ({ user, onUpdateUser, setStatusMsg, setActiveTab }) => {
  const [selectedNationality, setSelectedNationality] = useState(user.nationality || 'United Kingdom');
  const [nationalitySearch, setNationalitySearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isProfilePublic, setIsProfilePublic] = useState<boolean>(user.isProfilePublic ?? true);
  const [supportedTeam, setSupportedTeam] = useState(user.supportedTeam || '');
  const [emailEnabled, setEmailEnabled] = useState<boolean>(
    user.emailEnabled ?? user.weeklyEmailOptIn ?? false,
  );
  const [pushEnabledPref, setPushEnabledPref] = useState<boolean>(
    user.pushEnabled ?? false,
  );
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [emailBusy, setEmailBusy] = useState(false);
  const [teamSearch, setTeamSearch] = useState('');
  const [isTeamDropdownOpen, setIsTeamDropdownOpen] = useState(false);
  const { data: teamCatalog = [] } = useTeamsCatalogQuery();
  const push = usePushNotifications(user.id, pushEnabledPref);

  const isLocalProfile =
    !supabase ||
    !user?.id ||
    user.id === 'user-admin' ||
    user.id.startsWith('usr_local_');

  // Hydrate notification prefs from profiles on mount / user change.
  useEffect(() => {
    let cancelled = false;
    const loadPrefs = async () => {
      if (isLocalProfile || !supabase) {
        setEmailEnabled(user.emailEnabled ?? user.weeklyEmailOptIn ?? false);
        setPushEnabledPref(user.pushEnabled ?? false);
        setPrefsLoading(false);
        return;
      }
      setPrefsLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('push_enabled, email_enabled, weekly_email_opt_in')
        .eq('id', user.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.warn('[GeneralSettings] notification prefs load failed', error.message);
        setEmailEnabled(user.emailEnabled ?? false);
        setPushEnabledPref(user.pushEnabled ?? false);
      } else {
        const emailOn =
          data?.email_enabled === true ||
          (data?.email_enabled == null && data?.weekly_email_opt_in === true);
        const pushOn = data?.push_enabled === true;
        setEmailEnabled(!!emailOn);
        setPushEnabledPref(!!pushOn);
        onUpdateUser({
          ...user,
          emailEnabled: !!emailOn,
          weeklyEmailOptIn: !!emailOn,
          pushEnabled: !!pushOn,
        });
      }
      setPrefsLoading(false);
    };
    void loadPrefs();
    return () => {
      cancelled = true;
    };
    // Intentionally keyed on user.id only — avoid loops from onUpdateUser identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id, isLocalProfile]);

  const teamSport =
    user.preferredSport === SportType.RUGBY ? 'Rugby' : 'Football';

  const handleEmailToggle = async (next: boolean) => {
    setEmailEnabled(next);
    setEmailBusy(true);
    try {
      if (!isLocalProfile && supabase) {
        const { error } = await supabase
          .from('profiles')
          .update({
            email_enabled: next,
            weekly_email_opt_in: next,
          })
          .eq('id', user.id);
        if (error) throw error;
      }
      onUpdateUser({
        ...user,
        emailEnabled: next,
        weeklyEmailOptIn: next,
      });
    } catch (err) {
      console.warn('[GeneralSettings] email_enabled update failed', err);
      setEmailEnabled(!next);
      setStatusMsg({
        text: 'Could not update email preference. Try again.',
        mode: 'error',
      });
    } finally {
      setEmailBusy(false);
    }
  };

  const handlePushToggle = async () => {
    if (push.enabled) {
      const ok = await push.disable();
      if (ok) {
        setPushEnabledPref(false);
        onUpdateUser({ ...user, pushEnabled: false });
      }
      return;
    }
    const ok = await push.enable();
    if (ok) {
      setPushEnabledPref(true);
      onUpdateUser({ ...user, pushEnabled: true });
    }
  };

  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg({ text: '', mode: 'none' });

    const trimmedTeam = supportedTeam.trim();
    const favoriteTeams = trimmedTeam
      ? Array.from(
          new Set([
            ...(user.favoriteTeams || []).filter(
              (t) => t && t.toLowerCase() !== trimmedTeam.toLowerCase(),
            ),
            trimmedTeam,
          ]),
        )
      : user.favoriteTeams || [];

    try {
      if (supabase && !isLocalProfile) {
        const { error: dbErr } = await supabase
          .from('profiles')
          .update({
            nationality: selectedNationality,
            is_profile_public: isProfilePublic,
            supported_team: trimmedTeam,
            favorite_teams: favoriteTeams,
            email_enabled: emailEnabled,
            weekly_email_opt_in: emailEnabled,
            push_enabled: push.enabled || pushEnabledPref,
          })
          .eq('id', user.id);

        if (dbErr) throw dbErr;
      }

      onUpdateUser({
        ...user,
        nationality: selectedNationality,
        isProfilePublic,
        supportedTeam: trimmedTeam,
        favoriteTeams,
        emailEnabled,
        weeklyEmailOptIn: emailEnabled,
        pushEnabled: push.enabled || pushEnabledPref,
      });
      setStatusMsg({
        text: 'Success! Your settings have been saved to your account permanently.',
        mode: 'success'
      });
    } catch (err: any) {
      console.warn('Settings save error:', err);
      onUpdateUser({
        ...user,
        nationality: selectedNationality,
        isProfilePublic,
        supportedTeam: trimmedTeam,
        favoriteTeams,
        emailEnabled,
        weeklyEmailOptIn: emailEnabled,
        pushEnabled: push.enabled || pushEnabledPref,
      });
      setStatusMsg({
        text: 'Settings updated locally for your current session state.',
        mode: 'success'
      });
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="bg-slate-950/40 p-5 rounded-2xl border border-slate-800/80 space-y-4 relative overflow-hidden">
        <div className="absolute inset-0 select-none pointer-events-none opacity-[0.03] text-white transition-all duration-300 z-0">
          {(() => {
            const bgNationalityObj = NATIONS_LIST.find((n) => n.name.toLowerCase() === user.nationality?.toLowerCase() || n.code.toLowerCase() === user.nationality?.toLowerCase());
            return bgNationalityObj ? (
              <img 
                src={`https://flagcdn.com/256x192/${bgNationalityObj.code.toLowerCase()}.png`} 
                alt="flag-bg"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <Globe className="w-full h-full opacity-50" />
            );
          })()}
        </div>

        <span className="text-[10px] font-bold text-slate-400 font-mono uppercase tracking-widest flex items-center gap-1.5 relative z-10 border-b border-slate-900 pb-2">
          <ShieldCheck className="w-4 h-4 text-emerald-500" /> Secure Details
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs relative z-10">
          <div>
            <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">Name</label>
            <div className="bg-slate-900/60 px-3.5 py-2.5 rounded-xl border border-slate-800/60 text-slate-350 font-semibold text-xs">
              {[user.firstName, user.surname].filter(Boolean).join(' ') || '—'}
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">Date of Birth</label>
            <div className="bg-slate-900/60 px-3.5 py-2.5 rounded-xl border border-slate-800/60 text-slate-350 font-mono text-xs flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-500" />
              {user.dob || '—'}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs relative z-10">
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider">Leaderboard Nickname</label>
            </div>
            <div className="bg-amber-500/5 px-3.5 py-2.5 rounded-xl border border-amber-500/20 text-amber-200 font-bold text-xs ring-4 ring-amber-500/10" title="Nickname can only be updated during official pre-season registration window.">
              {user.nickname}
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">Email</label>
            <div className="bg-slate-900/60 px-3.5 py-2.5 rounded-xl border border-slate-800/60 text-slate-400 text-xs flex items-center justify-between gap-2">
              <span className="font-mono truncate">{user.email}</span>
              <button
                type="button"
                onClick={() => setActiveTab('change-email')}
                className="text-[10px] font-mono text-emerald-400 hover:text-emerald-300 font-bold underline cursor-pointer shrink-0"
              >
                Change →
              </button>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSaveChanges} className="space-y-4">
        <div className="relative">
          <label className="block text-[10px] font-semibold text-slate-300 uppercase tracking-wider mb-1.5 font-mono">
            Preferred Nationality
          </label>

          <div className="relative">
            {(() => {
              const selectedNationalityObj = NATIONS_LIST.find((n) => n.name.toLowerCase() === selectedNationality?.toLowerCase());
              return (
                <div className="absolute left-3.5 top-3.5 select-none pointer-events-none flex items-center justify-center text-sm font-sans">
                  {selectedNationalityObj ? (
                    <CountryFlag
                      code={selectedNationalityObj.code.toLowerCase()}
                      alt={selectedNationalityObj.name}
                      size={16}
                    />
                  ) : (
                    <Globe className="w-4 h-4 text-slate-500" />
                  )}
                </div>
              );
            })()}

            <input
              id="acc-nationality-search-input"
              type="text"
              placeholder="Type to search preferred nationality..."
              value={isDropdownOpen ? nationalitySearch : selectedNationality}
              onChange={(e) => {
                setNationalitySearch(e.target.value);
                setIsDropdownOpen(true);
              }}
              onFocus={() => {
                setNationalitySearch('');
                setIsDropdownOpen(true);
              }}
              className="w-full bg-slate-950 border border-slate-850 focus:border-emerald-500 rounded-xl py-3 pl-10 pr-8 text-xs text-white placeholder:text-slate-650 outline-hidden transition-colors font-semibold"
            />
            <button
              type="button"
              onClick={() => {
                setIsDropdownOpen(!isDropdownOpen);
                setNationalitySearch('');
              }}
              className="absolute right-3 top-3.5 text-slate-550 hover:text-slate-350 transition-colors cursor-pointer"
            >
              <ChevronRight className={`w-4 h-4 text-slate-400 transform transition-transform ${isDropdownOpen ? 'rotate-90' : ''}`} />
            </button>
          </div>

          <AnimatePresence>
            {isDropdownOpen && (
              <>
                <div 
                  className="fixed inset-0 z-45" 
                  onClick={() => {
                    setIsDropdownOpen(false);
                    setNationalitySearch('');
                  }} 
                />
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute left-0 right-0 mt-2 max-h-48 overflow-y-auto bg-slate-950 border border-slate-800 rounded-xl shadow-2xl z-50 divide-y divide-slate-900/60 custom-scrollbar"
                >
                  {(() => {
                    const filteredCountries = NATIONS_LIST.filter((nation) =>
                      nation.name.toLowerCase().includes((nationalitySearch || '').toLowerCase())
                    );
                    if (filteredCountries.length === 0) {
                        return (
                          <div className="p-3 text-slate-500 text-xs font-mono italic text-center">
                            No countries/nations match "{nationalitySearch}"
                          </div>
                        );
                    }
                    return filteredCountries.map((nation) => (
                      <button
                        key={nation.code}
                        type="button"
                        onClick={() => {
                          setSelectedNationality(nation.name);
                          setNationalitySearch('');
                          setIsDropdownOpen(false);
                        }}
                        className={`w-full text-left px-4 py-3 text-xs flex items-center gap-3 transition-colors hover:bg-slate-900/50 cursor-pointer ${
                          selectedNationality?.toLowerCase() === nation.name.toLowerCase() ? 'bg-slate-900/60 text-emerald-450 font-bold' : 'text-slate-300'
                        }`}
                      >
                        <span className="shrink-0 select-none flex items-center justify-center">
                          <CountryFlag
                            code={nation.code.toLowerCase()}
                            alt={nation.name}
                            size={16}
                          />
                        </span>
                        <span className="flex-1 truncate font-mono text-[11px]">{nation.name}</span>
                      </button>
                    ));
                  })()}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Supported team → profiles.supported_team */}
        <div className="relative">
          <label className="block text-[10px] font-semibold text-slate-300 uppercase tracking-wider mb-1.5 font-mono">
            Supported {teamSport} Team
          </label>
          <div className="relative">
            <User className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500 pointer-events-none" />
            <input
              id="acc-supported-team-input"
              type="text"
              placeholder="Search countries or clubs..."
              value={isTeamDropdownOpen ? teamSearch : supportedTeam}
              onChange={(e) => {
                setTeamSearch(e.target.value);
                setSupportedTeam(e.target.value);
                setIsTeamDropdownOpen(true);
              }}
              onFocus={() => {
                setTeamSearch('');
                setIsTeamDropdownOpen(true);
              }}
              className="w-full bg-slate-950 border border-slate-850 focus:border-emerald-500 rounded-xl py-3 pl-10 pr-8 text-xs text-white placeholder:text-slate-650 outline-hidden transition-colors font-semibold"
            />
            <button
              type="button"
              onClick={() => {
                setIsTeamDropdownOpen(!isTeamDropdownOpen);
                setTeamSearch('');
              }}
              className="absolute right-3 top-3.5 text-slate-550 hover:text-slate-350 transition-colors cursor-pointer"
            >
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transform transition-transform ${isTeamDropdownOpen ? 'rotate-180' : ''}`}
              />
            </button>
          </div>

          <AnimatePresence>
            {isTeamDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-45"
                  onClick={() => {
                    setIsTeamDropdownOpen(false);
                    setTeamSearch('');
                  }}
                />
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute left-0 right-0 mt-2 max-h-52 overflow-y-auto bg-slate-950 border border-slate-800 rounded-xl shadow-2xl z-50 custom-scrollbar"
                >
                  {(() => {
                    const { countries, clubs } = filterTeams(
                      teamCatalog,
                      teamSport,
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
                          className="w-full text-left px-4 py-3 text-xs text-slate-400 hover:bg-slate-900/50 cursor-pointer"
                        >
                          Use custom team:{' '}
                          <span className="font-bold text-white">"{teamSearch}"</span>
                        </button>
                      );
                    }
                    return (
                      <>
                        {countries.length > 0 && (
                          <>
                            <div className="sticky top-0 z-10 px-3 py-1.5 text-[9px] font-mono font-bold uppercase tracking-widest text-slate-500 bg-slate-950 border-b border-slate-900">
                              Countries
                            </div>
                            {countries.map((team) => (
                              <button
                                key={`c-${team.name}`}
                                type="button"
                                onClick={() => {
                                  setSupportedTeam(team.name);
                                  setTeamSearch('');
                                  setIsTeamDropdownOpen(false);
                                }}
                                className={`w-full text-left px-4 py-2.5 text-xs flex items-center gap-2.5 transition-colors hover:bg-slate-900/50 cursor-pointer ${
                                  supportedTeam === team.name
                                    ? 'bg-slate-900/60 text-emerald-400 font-bold'
                                    : 'text-slate-300'
                                }`}
                              >
                                <CountryFlag
                                  code={team.countryCode}
                                  alt={team.name}
                                  size={18}
                                />
                                <span className="truncate font-sans">{team.name}</span>
                              </button>
                            ))}
                          </>
                        )}
                        {clubs.length > 0 && (
                          <>
                            <div className="sticky top-0 z-10 px-3 py-1.5 text-[9px] font-mono font-bold uppercase tracking-widest text-slate-500 bg-slate-950 border-b border-slate-900">
                              Clubs
                            </div>
                            {clubs.map((team) => (
                              <button
                                key={`club-${team.name}`}
                                type="button"
                                onClick={() => {
                                  setSupportedTeam(team.name);
                                  setTeamSearch('');
                                  setIsTeamDropdownOpen(false);
                                }}
                                className={`w-full text-left px-4 py-2.5 text-xs transition-colors hover:bg-slate-900/50 cursor-pointer ${
                                  supportedTeam === team.name
                                    ? 'bg-slate-900/60 text-emerald-400 font-bold'
                                    : 'text-slate-300'
                                }`}
                              >
                                <span className="truncate font-sans">{team.name}</span>
                              </button>
                            ))}
                          </>
                        )}
                      </>
                    );
                  })()}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        <div className="bg-slate-950/40 p-5 rounded-2xl border border-slate-800/80 space-y-4">
          <span className="text-[10px] font-bold text-slate-400 font-mono uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-900 pb-2">
            <Bell className="w-4 h-4 text-amber-400" /> Notifications
          </span>

          <div className="flex items-center justify-between gap-4">
            <div>
              <h4 className="text-xs font-bold text-slate-200">24h match reminders</h4>
              <p className="text-[10px] text-slate-400 mt-1">
                Get a browser push when a fixture is about 24 hours away and you still need a pick.
              </p>
              {push.error ? (
                <p className="text-[10px] text-rose-400 mt-1">{push.error}</p>
              ) : null}
              {push.state === "unsupported" ? (
                <p className="text-[10px] text-slate-500 mt-1">Not supported in this browser.</p>
              ) : null}
              {push.state === "denied" ? (
                <p className="text-[10px] text-amber-400/90 mt-1">
                  Permission blocked — enable notifications in browser settings.
                </p>
              ) : null}
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={push.enabled}
                disabled={
                  push.busy ||
                  prefsLoading ||
                  push.state === "unsupported" ||
                  push.state === "denied"
                }
                onChange={() => {
                  void handlePushToggle();
                }}
              />
              <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500 peer-disabled:opacity-40"></div>
            </label>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <h4 className="text-xs font-bold text-slate-200">Weekly fixture email</h4>
              <p className="text-[10px] text-slate-400 mt-1">
                Monday digest of the next 7 days — your favourite teams listed first.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={emailEnabled}
                disabled={emailBusy || prefsLoading}
                onChange={(e) => {
                  void handleEmailToggle(e.target.checked);
                }}
              />
              <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500 peer-disabled:opacity-40"></div>
            </label>
          </div>
        </div>

        <div className="bg-slate-950/40 p-5 rounded-2xl border border-slate-800/80 space-y-4">
          <span className="text-[10px] font-bold text-slate-400 font-mono uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-900 pb-2">
            <ShieldCheck className="w-4 h-4 text-blue-500" /> Privacy Preferences
          </span>
          
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-slate-200">Public Profile</h4>
              <p className="text-[10px] text-slate-400 mt-1">Allow other players to view your performance history and statistics. Personal data like email and date of birth are never shared.</p>
            </div>
            <div className="flex items-center">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={isProfilePublic}
                  onChange={(e) => {
                    setIsProfilePublic(e.target.checked);
                  }}
                />
                <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="w-full bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-200 font-bold font-display uppercase tracking-wider py-3 rounded-xl text-xs cursor-pointer hover:border-emerald-500/40 transition-all font-mono duration-150"
        >
          Save
        </button>
      </form>
    </div>
  );
};
