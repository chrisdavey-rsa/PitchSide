/**
 * Post-auth onboarding for OAuth (and any profile missing country / sports).
 * Captures nationality, preferred sports, and favorites, then updates profiles.
 */

import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight, ArrowLeft, Check, Globe, ChevronDown } from "lucide-react";
import { SportType, type UserProfile } from "../types";
import type { SportKey } from "../sports/emerging/types";
import { SportIcon } from "../sports/emerging/sportIcons";
import {
  useF1ConstructorsQuery,
  useGolfPlayersQuery,
} from "../sports/emerging/hooks/useEmergingSports";
import EmergingSearchCombobox from "../sports/emerging/components/EmergingSearchCombobox";
import { NATIONS_LIST } from "./AccountPortal/data";
import CountryFlag from "./CountryFlag";
import { filterTeams } from "../data/supportedTeams";
import { useTeamsCatalogQuery } from "../hooks/usePitchsideQueries";
import { supabase } from "../supabase";
import PitchSideLogo from "./PitchSideLogo";
import {
  defaultGolfCoverageTier,
  defaultSubscribedLeagues,
  preferredNationFromLabel,
} from "../utils/userOnboardingDefaults";
import { GOLF_LEAGUE_ID_BY_TIER } from "../constants/golfCoverage";

type Props = {
  user: UserProfile;
  onComplete: (updated: UserProfile) => void;
};

/** Core sports selectable; Golf / F1 shown as Coming Soon. */
const SPORT_OPTIONS: { key: SportKey; label: string; comingSoon?: boolean }[] = [
  { key: "football", label: "Football" },
  { key: "rugby", label: "Rugby" },
  { key: "formula1", label: "F1", comingSoon: true },
  { key: "golf", label: "Golf", comingSoon: true },
];

export default function OnboardingFlow({ user, onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [nationality, setNationality] = useState(
    user.nationality && user.nationality !== "Global" ? user.nationality : "",
  );
  const [nationalitySearch, setNationalitySearch] = useState("");
  const [nationOpen, setNationOpen] = useState(false);
  const [selectedSports, setSelectedSports] = useState<SportKey[]>(() => {
    const fromProfile = (user.selectedSports ?? []).filter(
      (s): s is SportKey => s === "football" || s === "rugby",
    );
    return fromProfile;
  });
  const [supportedTeam, setSupportedTeam] = useState(
    user.supportedTeam && user.supportedTeam !== "Unknown"
      ? user.supportedTeam
      : "",
  );
  const [teamSearch, setTeamSearch] = useState("");
  const [teamOpen, setTeamOpen] = useState(false);
  const [favoriteF1, setFavoriteF1] = useState<string | null>(
    user.favoriteF1Team ?? null,
  );
  const [favoriteGolfer, setFavoriteGolfer] = useState<string | null>(
    user.favoriteGolfer ?? null,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const { data: teamCatalog = [] } = useTeamsCatalogQuery();
  const { data: constructors = [] } = useF1ConstructorsQuery();
  const { data: golfers = [] } = useGolfPlayersQuery();

  const needsTeamFavorites =
    selectedSports.includes("football") || selectedSports.includes("rugby");
  const needsF1 = selectedSports.includes("formula1");
  const needsGolf = selectedSports.includes("golf");
  const totalSteps = needsTeamFavorites || needsF1 || needsGolf ? 3 : 2;

  const teamSportForFilter: "Football" | "Rugby" = selectedSports.includes(
    "rugby",
  ) && !selectedSports.includes("football")
    ? "Rugby"
    : "Football";

  const filteredTeams = useMemo(() => {
    const { countries, clubs } = filterTeams(
      teamCatalog,
      teamSportForFilter,
      teamSearch,
    );
    // If both football + rugby selected, also include the other sport's teams.
    if (
      selectedSports.includes("football") &&
      selectedSports.includes("rugby")
    ) {
      const other = filterTeams(
        teamCatalog,
        teamSportForFilter === "Football" ? "Rugby" : "Football",
        teamSearch,
      );
      const seen = new Set(
        [...countries, ...clubs].map((t) => `${t.sport}:${t.name}`),
      );
      const merged = [...countries, ...clubs];
      for (const t of [...other.countries, ...other.clubs]) {
        const key = `${t.sport}:${t.name}`;
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(t);
        }
      }
      return merged;
    }
    return [...countries, ...clubs];
  }, [teamCatalog, teamSearch, teamSportForFilter, selectedSports]);

  const ctorOptions = useMemo(
    () =>
      constructors.map((c) => ({
        id: c.id,
        label: c.name,
        countryCode: c.countryCode,
        swatchHex: c.teamColorHex,
      })),
    [constructors],
  );

  const golferOptions = useMemo(
    () =>
      golfers.map((g) => ({
        id: g.id,
        label: g.name,
        countryCode: g.countryCode,
      })),
    [golfers],
  );

  const toggleSport = (key: SportKey) => {
    setSelectedSports((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const canAdvance = () => {
    if (step === 0) return !!nationality.trim();
    if (step === 1) return selectedSports.length > 0;
    if (step === 2) {
      if (needsTeamFavorites && !supportedTeam.trim()) return false;
      if (needsF1 && !favoriteF1) return false;
      if (needsGolf && !favoriteGolfer) return false;
      return true;
    }
    return false;
  };

  const preferredSport: SportType | undefined = selectedSports.includes("football")
    ? SportType.FOOTBALL
    : selectedSports.includes("rugby")
      ? SportType.RUGBY
      : undefined;

  const submit = async () => {
    if (!supabase) {
      setError("Database not connected.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const nationIso = preferredNationFromLabel(nationality.trim());
      const golfTier = defaultGolfCoverageTier(selectedSports);
      const subscribed = defaultSubscribedLeagues({
        preferredNation: nationIso,
        selectedSports,
      });
      // Ensure golf league id matches tier when golf is selected.
      const leagues = selectedSports.includes("golf")
        ? [
            ...subscribed.filter((id) => !id.startsWith("g-")),
            GOLF_LEAGUE_ID_BY_TIER[golfTier],
          ]
        : subscribed;

      const payload = {
        nationality: nationality.trim(),
        preferred_nation: nationIso,
        selected_sports: selectedSports,
        supported_team: needsTeamFavorites ? supportedTeam.trim() : null,
        preferred_sport: preferredSport ?? null,
        favorite_f1_team: needsF1 ? favoriteF1 : null,
        favorite_golfer: needsGolf ? favoriteGolfer : null,
        subscribed_leagues: leagues,
        golf_coverage_tier: golfTier,
      };

      const { error: updateError } = await supabase
        .from("profiles")
        .update(payload)
        .eq("id", user.id);

      if (updateError) throw updateError;

      const updated: UserProfile = {
        ...user,
        nationality: payload.nationality,
        preferredNation: nationIso,
        selectedSports,
        supportedTeam: payload.supported_team || undefined,
        preferredSport,
        favoriteF1Team: payload.favorite_f1_team,
        favoriteGolfer: payload.favorite_golfer,
        subscribedLeagues: leagues,
        golfCoverageTier: golfTier,
      };
      onComplete(updated);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Could not save your preferences.",
      );
    } finally {
      setSaving(false);
    }
  };

  const next = () => {
    if (!canAdvance()) return;
    if (step < totalSteps - 1) {
      setStep((s) => s + 1);
      return;
    }
    void submit();
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center py-8 px-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <PitchSideLogo size="lg" autoplay={false} />
          <p className="text-xs text-slate-400 font-mono mt-2 uppercase tracking-widest">
            Finish setting up your PitchSide seat
          </p>
        </div>

        <div className="bg-slate-900/85 backdrop-blur-md rounded-2xl border border-slate-800 p-6 shadow-2xl relative">
          <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-blue-500 via-green-500 to-red-500 rounded-t-2xl" />

          <div className="flex items-center gap-2 mb-6">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full ${
                  i <= step ? "bg-emerald-500" : "bg-slate-800"
                }`}
              />
            ))}
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-950/40 border border-red-500/30 rounded-lg text-xs text-red-300">
              {error}
            </div>
          )}

          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div
                key="country"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                className="space-y-4"
              >
                <h2 className="text-lg font-display font-extrabold text-white">
                  Where are you from?
                </h2>
                <p className="text-xs text-slate-400 font-sans">
                  Used for flags on leaderboards and league standings.
                </p>
                <div className="relative">
                  <Globe className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 z-10" />
                  <input
                    type="text"
                    value={nationOpen ? nationalitySearch : nationality}
                    onFocus={() => {
                      setNationOpen(true);
                      setNationalitySearch("");
                    }}
                    onChange={(e) => {
                      setNationalitySearch(e.target.value);
                      setNationOpen(true);
                    }}
                    placeholder="Search country…"
                    className="w-full bg-slate-950/60 border border-slate-800 focus:border-emerald-500 rounded-lg py-2 pl-10 pr-10 text-sm text-white placeholder:text-slate-600 outline-none"
                  />
                  <ChevronDown className="absolute right-3 top-2.5 h-4 w-4 text-slate-500" />
                  {nationOpen && (
                    <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-slate-800 bg-slate-950 shadow-xl">
                      {NATIONS_LIST.filter((n) =>
                        n.name
                          .toLowerCase()
                          .includes((nationalitySearch || "").toLowerCase()),
                      )
                        .slice(0, 40)
                        .map((n) => (
                          <button
                            key={n.code}
                            type="button"
                            onClick={() => {
                              setNationality(n.name);
                              setNationalitySearch("");
                              setNationOpen(false);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-slate-200 hover:bg-slate-900 cursor-pointer"
                          >
                            <CountryFlag code={n.code} size={16} alt="" />
                            {n.name}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div
                key="sports"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                className="space-y-4"
              >
                <h2 className="text-lg font-display font-extrabold text-white">
                  Which sports do you follow?
                </h2>
                <p className="text-xs text-slate-400 font-sans">
                  Pick at least one. You can change this later in settings.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {SPORT_OPTIONS.map(({ key, label, comingSoon }) => {
                    const active = selectedSports.includes(key);
                    if (comingSoon) {
                      return (
                        <span
                          key={key}
                          aria-disabled="true"
                          title="Coming soon"
                          className="flex flex-col items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-4 text-slate-500 opacity-50 pointer-events-none cursor-not-allowed"
                        >
                          <SportIcon sport={key} className="h-10 w-10 opacity-60" />
                          <span className="text-xs font-display font-bold uppercase tracking-wide">
                            {label}
                          </span>
                          <span className="text-[8px] font-mono uppercase tracking-wider text-slate-600">
                            Coming Soon
                          </span>
                        </span>
                      );
                    }
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => toggleSport(key)}
                        className={`flex flex-col items-center gap-2 rounded-xl border px-3 py-4 transition-colors cursor-pointer ${
                          active
                            ? "border-emerald-500 bg-emerald-500/10 text-white"
                            : "border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700"
                        }`}
                      >
                        <SportIcon sport={key} className="h-10 w-10" />
                        <span className="text-xs font-display font-bold uppercase tracking-wide">
                          {label}
                        </span>
                        {active && <Check className="h-3.5 w-3.5 text-emerald-400" />}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="favorites"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                className="space-y-5"
              >
                <h2 className="text-lg font-display font-extrabold text-white">
                  Pick your favourites
                </h2>
                <p className="text-xs text-slate-400 font-sans">
                  Helps personalise your PitchSide workspace.
                </p>

                {needsTeamFavorites && (
                  <div className="space-y-2 relative">
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400">
                      Favourite football / rugby team
                    </label>
                    <input
                      type="text"
                      value={teamOpen ? teamSearch : supportedTeam}
                      onFocus={() => {
                        setTeamOpen(true);
                        setTeamSearch("");
                      }}
                      onChange={(e) => {
                        setTeamSearch(e.target.value);
                        setTeamOpen(true);
                      }}
                      placeholder="Search teams…"
                      className="w-full bg-slate-950/60 border border-slate-800 focus:border-emerald-500 rounded-lg py-2 px-3 text-sm text-white placeholder:text-slate-600 outline-none"
                    />
                    {teamOpen && (
                      <div className="absolute z-20 mt-1 max-h-40 w-full overflow-y-auto rounded-lg border border-slate-800 bg-slate-950 shadow-xl">
                        {filteredTeams.slice(0, 40).map((t) => (
                          <button
                            key={`${t.sport}-${t.name}`}
                            type="button"
                            onClick={() => {
                              setSupportedTeam(t.name);
                              setTeamSearch("");
                              setTeamOpen(false);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-slate-200 hover:bg-slate-900 cursor-pointer"
                          >
                            {t.countryCode && (
                              <CountryFlag code={t.countryCode} size={14} alt="" />
                            )}
                            <span>{t.name}</span>
                            <span className="ml-auto text-[9px] uppercase text-slate-500">
                              {t.sport}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {needsF1 && (
                  <div className="space-y-2">
                    <EmergingSearchCombobox
                      label="Favourite F1 team"
                      options={ctorOptions}
                      value={favoriteF1}
                      onChange={setFavoriteF1}
                      placeholder="Search constructors…"
                    />
                  </div>
                )}

                {needsGolf && (
                  <div className="space-y-2">
                    <EmergingSearchCombobox
                      label="Favourite golfer"
                      options={golferOptions}
                      value={favoriteGolfer}
                      onChange={setFavoriteGolfer}
                      placeholder="Search golfers…"
                    />
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-8 flex items-center gap-3">
            {step > 0 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 px-4 py-2.5 text-xs font-semibold text-white cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </button>
            ) : (
              <div className="flex-1" />
            )}
            <button
              type="button"
              disabled={!canAdvance() || saving}
              onClick={next}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed px-5 py-2.5 text-xs font-semibold font-display uppercase tracking-wide text-white cursor-pointer shadow-[0_4px_12px_rgba(16,185,129,0.3)]"
            >
              {saving
                ? "Saving…"
                : step >= totalSteps - 1
                  ? "Enter PitchSide"
                  : "Continue"}
              {!saving && <ArrowRight className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** True when country or selected sports are missing (post-OAuth gate). */
export function needsOnboarding(profile: UserProfile): boolean {
  const country = profile.nationality?.trim();
  const sports = profile.selectedSports ?? [];
  return !country || country === "Global" || sports.length === 0;
}
