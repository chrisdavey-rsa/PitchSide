/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, {
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { AnimatePresence } from "motion/react";
import {
  ShieldAlert,
  Plus,
  Minus,
  Users,
  Sparkles,
  Lock as LockIcon,
  ChevronDown,
  History,
} from "lucide-react";
import { SportType, Competition, Match } from "../../types";
import {
  getCompetitionTitle,
  matchPassesNationFilter,
} from "../../constants/competitions";
import CompetitionFlag from "../predictions/CompetitionFlag";
import {
  CARD_CORNER_META_CLASS,
  CardKickoffTime,
  CompetitionSubHeader,
  SportColorStrip,
  TEAM_NAME_CLASS,
  formatTeamName,
} from "../predictions/MatchCard";
import { usePersistedCompetitionFilter } from "../predictions/CompetitionFilterRail";
import { settlePredictionWithPowerUp } from "../../utils";
import LockGuessButton from "./LockGuessButton";
import PowerUpPerimeterBeam from "./PowerUpPerimeterBeam";
import SportIntroModal from "../onboarding/SportIntroModal";
import PowerUpSelector from "../predictions/PowerUpSelector";
import StickyActionPill from "../predictions/StickyActionPill";
import PowerUpLockConfirmModal from "../predictions/PowerUpLockConfirmModal";
import LockConfirmModal from "../predictions/LockConfirmModal";
import { useScrollObserver } from "../../hooks/useScrollObserver";
import { shouldSkipLockConfirm } from "../../lib/lockConfirmPrefs";
import {
  dbEnsureBaselinePowerups,
  dbFetchMatchConsensus,
  dbFetchUserPowerups,
  type MatchConsensus,
  type PredictionEntry,
} from "../../supabase";
import type { FeedSportFilter } from "../predictions/PredictionsFeedFilter";
import {
  POWER_UP_IDS,
  buildSeasonWallet,
  toPowerUpSportType,
  type PowerUpId,
  type UserPowerUpInstance,
} from "../../constants/powerups";

/** Perimeter accent colours matching each Power-Up chip. */
const POWERUP_RING_COLOR: Record<PowerUpId, string> = {
  double_bubble: "#38bdf8",
  safety_net: "#34d399",
  sniper: "#fb7185",
  banker: "#cbd5e1",
  pitchside_master: "#fcd34d",
};

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useOverlayHistory } from "../../hooks/useOverlayHistory";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import {
  SeenFeature,
  hasSeenFeature,
  type SeenFeatureKey,
  type SeenFeatures,
} from "../../lib/seenFeatures";

const CONSENSUS_THRESHOLD = 20;

function getMatchStatusDisplay(match: Match) {
  if (match.status === "completed") {
    return {
      label: "Finished",
      className:
        "text-green-500 font-mono text-[10px] uppercase tracking-widest font-bold",
    };
  }
  if (match.status === "live") {
    return {
      label: "In play",
      className:
        "text-green-500 font-mono text-[10px] uppercase tracking-widest font-bold animate-pulse",
    };
  }
  return {
    label: "To be played",
    className:
      "text-slate-400 font-mono text-[10px] uppercase tracking-widest font-bold",
  };
}

interface MatchPredictorProps {
  selectedSport: SportType | null;
  selectedCompId: string | null;
  setSelectedCompId: (id: string | null) => void;
  allMatches: Match[];
  sortedActiveMatches: Match[];
  activeMatches: Match[];
  filteredCompetitions: Competition[];
  selectedCompetition?: Competition;
  predictions: Record<string, PredictionEntry>;
  isEmailVerified: boolean;
  seenFeatures?: SeenFeatures;
  onFeatureSeen: (featureKey: SeenFeatureKey) => void | Promise<unknown>;
  onScoreChange: (matchId: string, side: "home" | "away", val: string) => void;
  onRugbyPredictionChange: (matchId: string, winner: "home" | "away" | "draw" | null, marginStr: string) => void;
  onSubmitPrediction: (matchId: string, powerupInstanceId?: string | null) => void;
  /** Needed to load / consume season power-up inventory. */
  userId?: string;
  /** Skip competition picker — show continuous multi-sport feed. */
  unifiedFeed?: boolean;
  feedSportFilter?: FeedSportFilter;
  /** Controlled competition filter (rail rendered by PredictionsPage). */
  competitionFilterIds?: string[];
  onCompetitionFilterIdsChange?: (ids: string[]) => void;
}

/** Calendar day key for date headers. */
function dateGroupKey(matchDate: string): string {
  const d = new Date(matchDate);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** e.g. "Saturday, 1 August 2026" (uppercased in the feed header). */
function dateGroupLabel(matchDate: string): string {
  return new Date(matchDate).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function sportGroupLabel(match: Match): string {
  return String(match.sport) === "rugby" ? "Rugby" : "Football";
}

function competitionGroupKey(match: Match): string {
  return match.competitionId || match.competitionName || "unknown";
}

function competitionGroupLabel(match: Match): string {
  return getCompetitionTitle(match.competitionId, match.competitionName);
}

export default function MatchPredictor({
  selectedSport,
  selectedCompId,
  setSelectedCompId,
  allMatches,
  sortedActiveMatches,
  activeMatches,
  filteredCompetitions,
  selectedCompetition,
  predictions,
  isEmailVerified,
  seenFeatures,
  onFeatureSeen,
  onScoreChange,
  onRugbyPredictionChange,
  onSubmitPrediction,
  userId,
  unifiedFeed = false,
  feedSportFilter = "all",
  competitionFilterIds: competitionFilterIdsProp,
  onCompetitionFilterIdsChange,
}: MatchPredictorProps) {
  const queryClient = useQueryClient();
  // Just-in-time onboarding: first open of Football / Rugby (profiles.seen_features).
  const [introSport, setIntroSport] = useState<"football" | "rugby" | null>(null);

  useEffect(() => {
    if (
      selectedSport === SportType.FOOTBALL &&
      !hasSeenFeature(seenFeatures, SeenFeature.FootballIntro)
    ) {
      setIntroSport("football");
    } else if (
      selectedSport === SportType.RUGBY &&
      !hasSeenFeature(seenFeatures, SeenFeature.RugbyIntro)
    ) {
      setIntroSport("rugby");
    } else {
      setIntroSport(null);
    }
  }, [selectedSport, seenFeatures]);

  const dismissIntro = useCallback(() => {
    setIntroSport((current) => {
      if (current === "football") {
        void onFeatureSeen(SeenFeature.FootballIntro);
      } else if (current === "rugby") {
        void onFeatureSeen(SeenFeature.RugbyIntro);
      }
      return null;
    });
  }, [onFeatureSeen]);

  useBodyScrollLock(!!introSport);
  useOverlayHistory(!!introSport, dismissIntro, "sport-intro");

  const powerUpSport = toPowerUpSportType(selectedSport);
  const sportSeasonId = selectedCompId || selectedCompetition?.id || "season";

  const { data: powerupRows = [] } = useQuery({
    queryKey: ["userPowerups", userId, powerUpSport],
    enabled: !!userId && !!powerUpSport,
    queryFn: async () => {
      if (!userId) return [];
      await dbEnsureBaselinePowerups(userId);
      return dbFetchUserPowerups(userId, powerUpSport);
    },
    staleTime: 30_000,
  });

  const wallet = useMemo(() => {
    const defaults = buildSeasonWallet({
      sportType: powerUpSport,
      sportSeasonId,
      seasonIsActive: true,
    });

    const byType = new Map<PowerUpId, (typeof powerupRows)[number]>();
    for (const row of powerupRows) {
      const type = row.powerup_type as PowerUpId;
      if (!POWER_UP_IDS.includes(type)) continue;
      const existing = byType.get(type);
      // Prefer available over used/expired for the chip face.
      if (
        !existing ||
        (row.status === "available" && existing.status !== "available")
      ) {
        byType.set(type, row);
      }
    }

    return defaults.map((chip): UserPowerUpInstance => {
      const row = byType.get(chip.powerUpId);
      if (!row) return chip;

      const status =
        row.status === "available"
          ? "available"
          : row.status === "used"
            ? "consumed"
            : "expired";

      return {
        ...chip,
        instanceId: row.id,
        unlocked: row.status === "available" || row.status === "used",
        status,
        armedMatchId: row.applied_fixture_id,
        earnedAt: row.earned_at,
        progressHint:
          row.status === "available" ? undefined : chip.progressHint,
      };
    });
  }, [powerUpSport, sportSeasonId, powerupRows]);

  /** Chip selected and waiting for a fixture tap. */
  const [assigningPowerUpId, setAssigningPowerUpId] = useState<PowerUpId | null>(null);
  /** matchId → user_powerups.id (uuid) */
  const [armedInstanceByMatch, setArmedInstanceByMatch] = useState<
    Record<string, string>
  >({});

  const isAssigningPowerUp = assigningPowerUpId !== null;

  const hasOpenFixtures = useMemo(
    () =>
      sortedActiveMatches.some((m) => {
        const started = m.status === "live" || new Date() > new Date(m.matchDate);
        const submitted = predictions[m.id]?.submitted;
        return !started && !submitted;
      }),
    [sortedActiveMatches, predictions],
  );

  const [pendingLock, setPendingLock] = useState<{
    matchId: string;
    powerupInstanceId: string;
    powerUpId: PowerUpId;
    fixtureLabel: string;
  } | null>(null);

  const [plainLockConfirm, setPlainLockConfirm] = useState<{
    matchId: string;
    fixtureLabel: string;
  } | null>(null);

  const [historyOpen, setHistoryOpen] = useState(false);

  const { historyMatches, upcomingMatches } = useMemo(() => {
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const history: Match[] = [];
    const upcoming: Match[] = [];

    for (const m of sortedActiveMatches) {
      const t = new Date(m.matchDate).getTime();
      if (m.status === "completed") {
        if (t >= weekAgo) history.push(m);
        continue;
      }
      if (m.status === "live") {
        upcoming.push(m);
        continue;
      }
      if (t < now) {
        if (t >= weekAgo) history.push(m);
        continue;
      }
      upcoming.push(m);
    }

    // Date → competition → kick-off (supports date + competition sub-headers).
    upcoming.sort((a, b) => {
      const dayA = dateGroupKey(a.matchDate);
      const dayB = dateGroupKey(b.matchDate);
      if (dayA !== dayB) {
        return (
          new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime()
        );
      }
      const compCmp = competitionGroupLabel(a).localeCompare(
        competitionGroupLabel(b),
      );
      if (compCmp !== 0) return compCmp;
      const tDiff =
        new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime();
      if (tDiff !== 0) return tDiff;
      return formatTeamName(a.homeTeam).localeCompare(
        formatTeamName(b.homeTeam),
      );
    });

    history.sort(
      (a, b) =>
        new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime(),
    );

    return { historyMatches: history, upcomingMatches: upcoming };
  }, [sortedActiveMatches]);

  const [compFilterIdsInternal] = usePersistedCompetitionFilter();
  const nationFilterIds = competitionFilterIdsProp ?? compFilterIdsInternal;
  const filteredUpcomingMatches = useMemo(() => {
    if (nationFilterIds.length === 0) return upcomingMatches;
    return upcomingMatches.filter((m) =>
      matchPassesNationFilter(m.competitionId, nationFilterIds),
    );
  }, [upcomingMatches, nationFilterIds]);

  const feedListRef = useRef<HTMLDivElement | null>(null);
  const [feedScrollMargin, setFeedScrollMargin] = useState(0);
  useLayoutEffect(() => {
    if (feedListRef.current) {
      setFeedScrollMargin(feedListRef.current.offsetTop);
    }
  }, [filteredUpcomingMatches.length, historyOpen, historyMatches.length]);

  const feedVirtualizer = useWindowVirtualizer({
    count: filteredUpcomingMatches.length,
    estimateSize: () => 360,
    overscan: 12,
    scrollMargin: feedScrollMargin,
  });

  const { data: consensusByMatch = {} } = useQuery({
    queryKey: [
      "matchConsensus",
      sortedActiveMatches.map((m) => m.id).join(","),
    ],
    enabled: sortedActiveMatches.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const entries = await Promise.all(
        sortedActiveMatches.slice(0, 40).map(async (m) => {
          const c = await dbFetchMatchConsensus(m.id);
          return [m.id, c] as const;
        }),
      );
      return Object.fromEntries(entries) as Record<string, MatchConsensus>;
    },
  });

  const assignedPowerUpIds = useMemo(() => {
    const ids: PowerUpId[] = [];
    for (const instanceId of Object.values(armedInstanceByMatch)) {
      const chip = wallet.find((w) => w.instanceId === instanceId);
      if (chip) ids.push(chip.powerUpId);
    }
    return ids;
  }, [armedInstanceByMatch, wallet]);

  /** Sentinel for sticky pill — competitions + main Power-Ups bar. */
  const [topControlsEl, setTopControlsEl] = useState<HTMLElement | null>(null);
  const isScrolledPastTop = useScrollObserver(topControlsEl);

  const handlePowerUpSelect = useCallback(
    (powerUpId: PowerUpId) => {
      if (!hasOpenFixtures) return;
      const instance = wallet.find(
        (w) =>
          w.powerUpId === powerUpId &&
          w.status === "available" &&
          w.unlocked,
      );
      if (!instance) return;

      const assignedMatchId = Object.entries(armedInstanceByMatch).find(
        ([, iid]) => iid === instance.instanceId,
      )?.[0];
      if (assignedMatchId) {
        setArmedInstanceByMatch((prev) => {
          const next = { ...prev };
          delete next[assignedMatchId];
          return next;
        });
        setAssigningPowerUpId(null);
        return;
      }

      setAssigningPowerUpId((cur) => (cur === powerUpId ? null : powerUpId));
    },
    [armedInstanceByMatch, hasOpenFixtures, wallet],
  );

  const assignPowerUpToMatch = useCallback(
    (matchId: string) => {
      if (!assigningPowerUpId) return;
      const instance = wallet.find(
        (w) =>
          w.powerUpId === assigningPowerUpId &&
          w.status === "available" &&
          w.unlocked,
      );
      if (!instance) {
        setAssigningPowerUpId(null);
        return;
      }

      setArmedInstanceByMatch((prev) => {
        const next: Record<string, string> = {};
        // One chip can only arm one fixture — drop prior bindings for this instance.
        for (const [mid, iid] of Object.entries(prev)) {
          if (iid !== instance.instanceId) next[mid] = iid;
        }
        // Toggle off if tapping the same fixture again.
        if (prev[matchId] === instance.instanceId) {
          return next;
        }
        next[matchId] = instance.instanceId;
        return next;
      });
      setAssigningPowerUpId(null);
    },
    [assigningPowerUpId, wallet],
  );

  return (
    <>
      <AnimatePresence>
        {introSport && (
          <SportIntroModal sport={introSport} onDismiss={dismissIntro} />
        )}
      </AnimatePresence>

      {selectedSport && (unifiedFeed || selectedCompId) && (
        <StickyActionPill
          visible={isScrolledPastTop}
          sportType={powerUpSport}
          instances={wallet}
          assigningPowerUpId={assigningPowerUpId}
          assignedPowerUpIds={assignedPowerUpIds}
          hasOpenFixtures={hasOpenFixtures}
          onSelectPowerUp={handlePowerUpSelect}
        />
      )}

      {selectedSport && (
            <div
              id="tour-match-predictor"
              className="bg-slate-900/60 rounded-3xl border border-slate-800 shadow-xl p-4 sm:p-6 w-full overflow-visible"
            >
              <div ref={setTopControlsEl}>
              {!unifiedFeed && (
                <>
              {/* Leagues filtering tab */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5 mb-5">
                <div>
                  <h3 className="text-xl font-bold font-display text-white">
                    {selectedSport === SportType.FOOTBALL
                      ? "Football Leagues"
                      : "Rugby Leagues"}
                  </h3>
                </div>

                <div className="text-xs text-slate-400 flex items-center gap-2">
                  <span>Total Competitions:</span>
                  <span
                    className={`px-2 py-0.5 rounded-sm font-mono text-xs font-semibold ${
                      selectedSport === SportType.FOOTBALL
                        ? "bg-blue-500/10 text-blue-300"
                        : "bg-amber-500/10 text-amber-300"
                    }`}
                  >
                    {filteredCompetitions.length}
                  </span>
                </div>
              </div>

              {filteredCompetitions.length === 0 ? (
                <div className="rounded-2xl border border-slate-800/80 bg-slate-950/40 px-6 py-14 text-center space-y-3">
                  <p className="text-sm font-display font-semibold text-slate-200">
                    No fixtures open for this game-week yet
                  </p>
                  <p className="text-xs text-slate-500 font-sans max-w-sm mx-auto leading-relaxed">
                    Your leagues are unlocked — predictions will appear here
                    when upcoming{" "}
                    {selectedSport === SportType.FOOTBALL ? "football" : "rugby"}{" "}
                    fixtures are synced. Check back closer to kick-off.
                  </p>
                </div>
              ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {filteredCompetitions.map((comp) => {
                  const count = allMatches.filter(
                    (m) => m.competitionId === comp.id && m.status !== "completed",
                  ).length;
                  const isSelected = selectedCompId === comp.id;

                  return (
                    <button
                      id={`comp-btn-${comp.id}`}
                      key={comp.id}
                      type="button"
                      onClick={() => setSelectedCompId(comp.id)}
                      className={`w-full text-left p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? "bg-slate-950 border-emerald-500 text-white shadow-md"
                          : "bg-slate-950/40 border-slate-800/50 hover:border-slate-700 hover:bg-slate-950/80 text-slate-300"
                      }`}
                    >
                      <div>
                        <h4 className="text-xs font-semibold font-display tracking-tight text-white">
                          {comp.name}
                        </h4>
                        <span className="text-[10px] text-slate-500 font-mono">
                          Live schedule
                        </span>
                      </div>

                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded-sm ${
                          count > 0
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-slate-800 text-slate-500"
                        }`}
                      >
                        {count > 0 ? `${count} Fixture${count === 1 ? "" : "s"}` : "Scheduled"}
                      </span>
                    </button>
                  );
                })}
              </div>
              )}

              {filteredCompetitions.length > 0 && !selectedCompId && (
                <div className="text-center py-10 text-slate-500 font-sans text-xs">
                  Select one of the competitions above to load action items
                  and configure score predictions.
                </div>
              )}
                </>
              )}

              {(unifiedFeed || (selectedCompId && filteredCompetitions.length > 0)) && (
                <div className={unifiedFeed ? "" : "mt-6 pt-5 border-t border-slate-800"}>
                  <PowerUpSelector
                    sportType={powerUpSport}
                    instances={wallet}
                    assigningPowerUpId={assigningPowerUpId}
                    assignedPowerUpIds={assignedPowerUpIds}
                    hasOpenFixtures={hasOpenFixtures}
                    onSelect={handlePowerUpSelect}
                  />
                  {unifiedFeed && feedSportFilter === "all" && (
                    <p className="mt-1.5 text-[9px] text-slate-600 font-mono px-0.5">
                      Power-Ups shown for{" "}
                      {selectedSport === SportType.RUGBY ? "Rugby" : "Football"}{" "}
                      — filter by sport to switch the chip wallet.
                    </p>
                  )}
                </div>
              )}
              </div>

              {(unifiedFeed || (selectedCompId && filteredCompetitions.length > 0)) && (
                <div className="mt-4 space-y-4">
                  {isAssigningPowerUp && (
                    <div
                      role="status"
                      className="sticky top-2 z-20 rounded-xl border border-violet-500/40 bg-violet-950/90 px-3 py-2.5 text-center shadow-lg shadow-violet-950/40 backdrop-blur-md"
                    >
                      <p className="text-[11px] font-semibold text-violet-100 font-sans leading-snug">
                        Select the fixture you'd like to boost.
                      </p>
                      <button
                        type="button"
                        onClick={() => setAssigningPowerUpId(null)}
                        className="mt-1.5 text-[9px] font-mono uppercase tracking-wider text-violet-300/80 hover:text-white cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {upcomingMatches.length === 0 && historyMatches.length === 0 ? (
                    <div className="rounded-xl border border-slate-800/70 bg-slate-950/30 px-5 py-10 text-center space-y-2">
                      <p className="text-sm font-display font-semibold text-slate-200">
                        {unifiedFeed
                          ? "No fixtures match these filters"
                          : "No open fixtures in this competition"}
                      </p>
                      <p className="text-xs text-slate-500 font-sans">
                        {unifiedFeed
                          ? "Try All sports, or turn off “Only show unmade picks”."
                          : "Pick another competition above, or check back when the next game-week is synced."}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 w-full overflow-visible">
                      {historyMatches.length > 0 && (
                        <div className="rounded-xl border border-slate-800 bg-slate-950/50 overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setHistoryOpen((o) => !o)}
                            className="w-full flex items-center justify-between gap-2 px-3.5 py-3 text-left cursor-pointer hover:bg-slate-900/60 transition-colors"
                          >
                            <span className="inline-flex items-center gap-2 text-[11px] font-mono font-bold uppercase tracking-wider text-slate-300">
                              <History className="h-3.5 w-3.5 text-slate-500" />
                              Game History
                              <span className="text-slate-600 normal-case tracking-normal font-sans font-normal">
                                ({historyMatches.length})
                              </span>
                            </span>
                            <ChevronDown
                              className={`h-4 w-4 text-slate-500 transition-transform ${
                                historyOpen ? "rotate-180" : ""
                              }`}
                            />
                          </button>
                          {historyOpen && (
                            <div className="border-t border-slate-800/80 divide-y divide-slate-800/60">
                              {historyMatches.map((match) => {
                                const pred = predictions[match.id];
                                const finalHome =
                                  match.homeScore ?? match.provisionalHomeScore;
                                const finalAway =
                                  match.awayScore ?? match.provisionalAwayScore;
                                const historyPowerUp =
                                  pred?.appliedPowerupId
                                    ? wallet.find(
                                        (w) =>
                                          w.instanceId === pred.appliedPowerupId,
                                      )?.powerUpId
                                    : undefined;
                                const points =
                                  pred?.submitted &&
                                  finalHome != null &&
                                  finalAway != null
                                    ? settlePredictionWithPowerUp(
                                        match.sport,
                                        pred.home,
                                        pred.away,
                                        finalHome,
                                        finalAway,
                                        historyPowerUp ?? null,
                                      ).earnedPoints
                                    : pred?.provisionalPoints;
                                return (
                                  <div
                                    key={match.id}
                                    className="px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <p className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">
                                        {dateGroupLabel(match.matchDate)} ·{" "}
                                        {sportGroupLabel(match)}
                                        {match.competitionId ||
                                        match.competitionName ? (
                                          <>
                                            {" · "}
                                            <CompetitionFlag
                                              competitionId={match.competitionId}
                                              competitionName={
                                                match.competitionName
                                              }
                                              className="inline-flex"
                                              titleClassName="uppercase tracking-wider"
                                            />
                                          </>
                                        ) : null}
                                      </p>
                                      <p className="text-xs font-display font-bold text-slate-200 whitespace-normal leading-tight">
                                        {formatTeamName(match.homeTeam)}{" "}
                                        <span className="text-slate-500 font-mono">
                                          {finalHome ?? "–"}–{finalAway ?? "–"}
                                        </span>{" "}
                                        {formatTeamName(match.awayTeam)}
                                      </p>
                                    </div>
                                    <div className="text-[10px] font-mono text-slate-400 sm:text-right">
                                      {pred?.submitted ? (
                                        <span>
                                          Your pick {pred.home}–{pred.away}
                                          {points != null && (
                                            <span className="ml-2 text-emerald-400 font-bold">
                                              {points > 0 ? `+${points}` : points}{" "}
                                              pts
                                            </span>
                                          )}
                                        </span>
                                      ) : (
                                        <span className="text-slate-600">No pick</span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {filteredUpcomingMatches.length === 0 &&
                      upcomingMatches.length > 0 ? (
                        <div className="rounded-xl border border-slate-800/70 bg-slate-950/30 px-5 py-8 text-center space-y-2">
                          <p className="text-sm font-display font-semibold text-slate-200">
                            No fixtures for the selected competitions
                          </p>
                          <p className="text-xs text-slate-500 font-sans">
                            Clear the left filter or pick All to see every league.
                          </p>
                        </div>
                      ) : null}

                      <div
                        ref={feedListRef}
                        className="relative w-full"
                        style={{
                          height: `${feedVirtualizer.getTotalSize()}px`,
                        }}
                      >
                      {feedVirtualizer.getVirtualItems().map((virtualRow) => {
                        const index = virtualRow.index;
                        const match = filteredUpcomingMatches[index];
                        if (!match) return null;
                        const dayKey = dateGroupKey(match.matchDate);
                        const compKey = competitionGroupKey(match);
                        const prevMatch =
                          index > 0
                            ? filteredUpcomingMatches[index - 1]
                            : null;
                        const prevDayKey = prevMatch
                          ? dateGroupKey(prevMatch.matchDate)
                          : null;
                        const prevCompKey = prevMatch
                          ? competitionGroupKey(prevMatch)
                          : null;
                        const showDateHeader = dayKey !== prevDayKey;
                        const showCompetitionHeader =
                          showDateHeader || compKey !== prevCompKey;

                        const savedPred = predictions[match.id] || {
                          home: 0,
                          away: 0,
                          submitted: false,
                          provisionalPoints: 0,
                        };
                        const hasPick = Object.prototype.hasOwnProperty.call(
                          predictions,
                          match.id,
                        );
                        const isSubmitted = savedPred.submitted;
                        const homeLeading = (savedPred.home || 0) > (savedPred.away || 0);
                        const awayLeading = (savedPred.away || 0) > (savedPred.home || 0);
                        const isDrawPick =
                          hasPick &&
                          (savedPred.home || 0) === (savedPred.away || 0);
                        const showActiveGreen = hasPick || isSubmitted;
                        const isLive = match.status === "live";
                        const isMatchStarted =
                          isLive || new Date() > new Date(match.matchDate);
                        const isLocked = isSubmitted || isMatchStarted;

                        // As It Stands: prefer live-computed points from provisional
                        // scores; fall back to the DB provisional_points field.
                        const liveHome = match.provisionalHomeScore;
                        const liveAway = match.provisionalAwayScore;
                        const armedInstanceId = armedInstanceByMatch[match.id];
                        const poweredChip =
                          (armedInstanceId
                            ? wallet.find((w) => w.instanceId === armedInstanceId)
                            : undefined) ||
                          (savedPred.appliedPowerupId
                            ? wallet.find(
                                (w) => w.instanceId === savedPred.appliedPowerupId,
                              )
                            : undefined);
                        const asItStandsPoints =
                          isLive &&
                          isSubmitted &&
                          liveHome != null &&
                          liveAway != null
                            ? settlePredictionWithPowerUp(
                                match.sport,
                                savedPred.home,
                                savedPred.away,
                                liveHome,
                                liveAway,
                                poweredChip?.powerUpId ?? null,
                              ).earnedPoints
                            : savedPred.provisionalPoints ?? 0;

                        const matchStatus = getMatchStatusDisplay(match);
                        const assignedInstanceId =
                          armedInstanceByMatch[match.id] ?? null;
                        const assignedChip = assignedInstanceId
                          ? wallet.find((w) => w.instanceId === assignedInstanceId)
                          : undefined;
                        const assignedPowerUpId = assignedChip?.powerUpId ?? null;
                        const hasPowerUpAssigned = Boolean(assignedPowerUpId);
                        const ringColor = assignedPowerUpId
                          ? POWERUP_RING_COLOR[assignedPowerUpId]
                          : undefined;

                        const lockControl = !isEmailVerified ? (
                          <div
                            className="w-full h-6 sm:h-9 bg-slate-800 text-slate-500 font-bold font-display uppercase text-[9px] sm:text-[10px] rounded-md sm:rounded-lg flex items-center justify-center gap-1 opacity-50 cursor-not-allowed"
                            title="Please verify your email to submit predictions."
                          >
                            <ShieldAlert className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Verify
                          </div>
                        ) : isLive && isSubmitted ? (
                          <div className="w-full h-6 sm:h-9 flex flex-col items-center justify-center text-[10px] sm:text-xs font-mono bg-amber-500/10 border border-amber-500/30 rounded-md sm:rounded-lg">
                            <span className="text-[7px] sm:text-[8px] uppercase tracking-widest text-amber-500/80 leading-none">
                              Live
                            </span>
                            <span className="font-display font-black text-amber-300 text-[10px] sm:text-xs leading-none">
                              {asItStandsPoints > 0
                                ? `+${asItStandsPoints}`
                                : asItStandsPoints}{" "}
                              pts
                            </span>
                          </div>
                        ) : !isMatchStarted || isSubmitted ? (
                          <LockGuessButton
                            id={`submit-pred-btn-${match.id}`}
                            className="w-full"
                            submitted={isSubmitted}
                            onClick={() => {
                              const fixtureLabel = `${formatTeamName(match.homeTeam)} v ${formatTeamName(match.awayTeam)}`;
                              const powerupId =
                                armedInstanceByMatch[match.id] ?? null;
                              if (powerupId) {
                                const chip = wallet.find(
                                  (w) => w.instanceId === powerupId,
                                );
                                if (chip) {
                                  setPendingLock({
                                    matchId: match.id,
                                    powerupInstanceId: powerupId,
                                    powerUpId: chip.powerUpId,
                                    fixtureLabel,
                                  });
                                  return;
                                }
                              }
                              if (shouldSkipLockConfirm()) {
                                onSubmitPrediction(match.id, null);
                                return;
                              }
                              setPlainLockConfirm({
                                matchId: match.id,
                                fixtureLabel,
                              });
                            }}
                          />
                        ) : null;

                        const pickState: "unpicked" | "saved" | "locked" =
                          isSubmitted
                            ? "locked"
                            : hasPick
                              ? "saved"
                              : "unpicked";
                        const consensus = consensusByMatch[match.id];

                        return (
                          <div
                            key={match.id}
                            data-index={virtualRow.index}
                            ref={feedVirtualizer.measureElement}
                            className="absolute top-0 left-0 w-full pb-3"
                            style={{
                              transform: `translateY(${
                                virtualRow.start -
                                feedVirtualizer.options.scrollMargin
                              }px)`,
                            }}
                          >
                            {showDateHeader && (
                              <div
                                className={`text-center mb-3 ${
                                  index === 0 ? "mt-2" : "mt-8"
                                }`}
                              >
                                <span className="inline-block text-slate-200 text-[11px] font-semibold px-3 py-1 uppercase tracking-wider font-mono">
                                  {dateGroupLabel(match.matchDate)}
                                </span>
                              </div>
                            )}
                            {showCompetitionHeader && (
                              <div
                                className={`mb-2 ${
                                  showDateHeader ? "mt-1" : "mt-5"
                                }`}
                              >
                                <CompetitionSubHeader
                                  competitionId={match.competitionId}
                                  competitionName={match.competitionName}
                                />
                              </div>
                            )}
                            <div
                              role={isAssigningPowerUp && !isLocked ? "button" : undefined}
                              tabIndex={
                                isAssigningPowerUp && !isLocked ? 0 : undefined
                              }
                              onClick={(e) => {
                                if (!isAssigningPowerUp) return;
                                // Closed / locked fixtures cannot receive a Power-Up.
                                if (isLocked) {
                                  setAssigningPowerUpId(null);
                                  return;
                                }
                                const el = e.target as HTMLElement;
                                if (
                                  el.closest(
                                    "button, input, select, textarea, a, [role='spinbutton']",
                                  )
                                ) {
                                  return;
                                }
                                assignPowerUpToMatch(match.id);
                              }}
                              onKeyDown={(e) => {
                                if (
                                  isAssigningPowerUp &&
                                  !isLocked &&
                                  (e.key === "Enter" || e.key === " ")
                                ) {
                                  e.preventDefault();
                                  assignPowerUpToMatch(match.id);
                                }
                              }}
                              style={
                                hasPowerUpAssigned && ringColor
                                  ? ({
                                      "--powerup-ring-color": ringColor,
                                    } as React.CSSProperties)
                                  : undefined
                              }
                              className={`relative overflow-hidden pl-4 pr-2.5 pt-2.5 pb-5 sm:pl-5 sm:pr-4 sm:pt-3 sm:pb-5 rounded-xl border transition-all w-full ${
                                hasPowerUpAssigned ? "powerup-assigned-ring " : ""
                              }${
                                isLive
                                  ? "border-rose-500/40 bg-slate-900 shadow-[0_0_24px_rgba(244,63,94,0.08)]"
                                  : isAssigningPowerUp && !isLocked
                                  ? "border-violet-500/60 bg-slate-900 ring-1 ring-violet-400/40 cursor-pointer"
                                  : hasPowerUpAssigned
                                  ? "bg-slate-900"
                                  : pickState === "saved"
                                  ? "border-sky-500/50 bg-slate-900 shadow-[0_0_16px_rgba(14,165,233,0.1)]"
                                  : pickState === "unpicked" && !isMatchStarted
                                  ? "border-rose-500/35 bg-slate-900/50"
                                  : showActiveGreen
                                  ? "border-emerald-500 bg-slate-900 shadow-[0_0_20px_rgba(16,185,129,0.12)]"
                                  : match.matchTag
                                  ? "border-amber-500/30 bg-slate-900"
                                  : isLocked
                                  ? "bg-slate-900 border-blue-900/30"
                                  : "bg-slate-900/40 border-slate-800/40"
                              }`}
                            >
                              {hasPowerUpAssigned && ringColor && (
                                <PowerUpPerimeterBeam color={ringColor} />
                              )}

                              <SportColorStrip sport={String(match.sport)} />

                              {/* Bottom-corner meta: kick-off left, status right — shared size. */}
                              <div className="absolute bottom-2 left-3 z-[1] pointer-events-none flex items-center">
                                <CardKickoffTime matchDate={match.matchDate} />
                              </div>
                              {!isMatchStarted ? (
                                <span
                                  className={`absolute bottom-2 right-3 z-[2] inline-flex items-center gap-1 rounded-full px-2 py-0.5 border ${CARD_CORNER_META_CLASS} ${
                                    pickState === "locked"
                                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                                      : pickState === "saved"
                                        ? "border-sky-500/40 bg-sky-500/10 text-sky-300"
                                        : "border-rose-500/40 bg-rose-500/10 text-rose-300"
                                  }`}
                                >
                                  {pickState === "locked" && (
                                    <LockIcon className="h-2.5 w-2.5" />
                                  )}
                                  {pickState === "locked"
                                    ? "Locked"
                                    : pickState === "saved"
                                      ? "Saved"
                                      : "Unpicked"}
                                </span>
                              ) : null}

                              {/* HIGH STAKES TAG: premium gold/neon badge with a subtle pulse */}
                              {match.matchTag && (
                                <div className="absolute -top-2 left-4 z-10">
                                  <span className="relative inline-flex items-center gap-1 rounded-full border border-amber-400/60 bg-slate-950/90 px-2 py-0.5 text-[8px] font-bold font-mono uppercase tracking-widest text-amber-300">
                                    <Sparkles className="relative h-2.5 w-2.5" />
                                    <span className="relative">{match.matchTag}</span>
                                  </span>
                                </div>
                              )}

                              {isLive && (
                                <div className="mb-2 flex flex-wrap items-center justify-center gap-2 text-center">
                                  <span className="inline-flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/40 text-rose-300 text-[9px] font-mono font-bold px-2.5 py-0.5 rounded-full uppercase tracking-widest">
                                    <span className="relative flex h-1.5 w-1.5">
                                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-60" />
                                      <span className="relative inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
                                    </span>
                                    Live
                                    {match.matchMinute && (
                                      <span className="text-rose-200/90">
                                        {match.matchMinute}
                                      </span>
                                    )}
                                  </span>
                                  <span className="font-display font-black text-lg tracking-widest text-white tabular-nums">
                                    {liveHome ?? "–"}
                                    <span className="mx-1 text-slate-500">–</span>
                                    {liveAway ?? "–"}
                                  </span>
                                </div>
                              )}

                              {isMatchStarted && !isLive && (
                                <div className="mb-2 flex justify-center">
                                  <span className="inline-flex items-center rounded-full border border-slate-600/80 bg-slate-950/80 px-2.5 py-0.5 text-[9px] font-semibold font-mono uppercase tracking-wide text-slate-300">
                                    {isSubmitted
                                      ? "Prediction locked"
                                      : "Predictions closed"}
                                  </span>
                                </div>
                              )}

                              {/* Prediction shell: full-width 3-col Home | VS | Away stays dead-centred. */}
                              <div className="relative w-full">
                              {match.sport === "football" ? (
                                <div className="w-full grid grid-cols-3 items-start gap-2 sm:gap-3 min-w-0">
                                  {/* Home Team */}
                                  <div className="min-w-0 flex flex-col items-center text-center">
                                    <div
                                      className={`flex items-center justify-center gap-1 bg-slate-950 px-1.5 py-1 rounded-xl border transition-all ${
                                        isLocked
                                          ? "border-slate-700/80 opacity-90"
                                          : "border-slate-800 focus-within:border-emerald-500/50"
                                      }`}
                                    >
                                      {!isLocked && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const val = Math.max(
                                            0,
                                            (savedPred.home || 0) - 1,
                                          );
                                          onScoreChange(
                                            match.id,
                                            "home",
                                            val.toString(),
                                          );
                                        }}
                                        className="relative p-1 rounded-sm bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-all flex items-center justify-center cursor-pointer overflow-hidden group select-none"
                                      >
                                        <div className="absolute inset-[-100%] z-0 group-hover:animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#00000000_50%,#10b981_100%)] opacity-0 group-hover:opacity-100" />
                                        <div className="absolute inset-[1px] bg-slate-900 rounded-sm z-0" />
                                        <Minus className="w-2.5 h-2.5 relative z-10" />
                                      </button>
                                      )}

                                      <input
                                        id={`pred-home-val-${match.id}`}
                                        type="number"
                                        min={0}
                                        max={99}
                                        disabled={isLocked}
                                        readOnly={isLocked}
                                        value={savedPred.home}
                                        onChange={(e) =>
                                          onScoreChange(
                                            match.id,
                                            "home",
                                            e.target.value,
                                          )
                                        }
                                        className={`w-8 text-center bg-transparent border-0 font-display font-black text-white text-base focus:ring-0 outline-hidden p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                                          isLocked
                                            ? "pointer-events-none cursor-default"
                                            : "pointer-events-auto"
                                        }`}
                                      />

                                      {!isLocked && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const val = (savedPred.home || 0) + 1;
                                          onScoreChange(
                                            match.id,
                                            "home",
                                            val.toString(),
                                          );
                                        }}
                                        className="relative p-1 rounded-sm bg-slate-900 border border-slate-800 text-slate-400 hover:text-emerald-400 transition-all flex items-center justify-center cursor-pointer overflow-hidden group select-none"
                                      >
                                        <div className="absolute inset-[-100%] z-0 group-hover:animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#00000000_50%,#10b981_100%)] opacity-0 group-hover:opacity-100" />
                                        <div className="absolute inset-[1px] bg-slate-900 rounded-sm z-0" />
                                        <Plus className="w-2.5 h-2.5 relative z-10" />
                                      </button>
                                      )}
                                    </div>
                                    <h5
                                      className={`mt-1 ${TEAM_NAME_CLASS} ${
                                        showActiveGreen && homeLeading
                                          ? "text-emerald-400"
                                          : showActiveGreen && isDrawPick
                                            ? "text-emerald-300/80"
                                            : "text-white"
                                      }`}
                                      title={match.homeTeam}
                                    >
                                      {formatTeamName(match.homeTeam)}
                                    </h5>
                                  </div>

                                  <div className="min-w-0 flex flex-col items-center justify-center text-center gap-1 px-1 pt-2">
                                    <span
                                      className={`${matchStatus.className} whitespace-nowrap`}
                                    >
                                      {matchStatus.label}
                                    </span>
                                    <span className="font-mono font-bold text-slate-600 text-[10px] uppercase tracking-widest">
                                      vs
                                    </span>
                                    {lockControl}
                                  </div>

                                  {/* Away Team */}
                                  <div className="min-w-0 flex flex-col items-center text-center">
                                    <div
                                      className={`flex items-center justify-center gap-1 bg-slate-950 px-1.5 py-1 rounded-xl border transition-all ${
                                        isLocked
                                          ? "border-slate-700/80 opacity-90"
                                          : "border-slate-800 focus-within:border-emerald-500/50"
                                      }`}
                                    >
                                      {!isLocked && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const val = Math.max(
                                            0,
                                            (savedPred.away || 0) - 1,
                                          );
                                          onScoreChange(
                                            match.id,
                                            "away",
                                            val.toString(),
                                          );
                                        }}
                                        className="relative p-1 rounded-sm bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-all flex items-center justify-center cursor-pointer overflow-hidden group select-none"
                                      >
                                        <div className="absolute inset-[-100%] z-0 group-hover:animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#00000000_50%,#10b981_100%)] opacity-0 group-hover:opacity-100" />
                                        <div className="absolute inset-[1px] bg-slate-900 rounded-sm z-0" />
                                        <Minus className="w-2.5 h-2.5 relative z-10" />
                                      </button>
                                      )}

                                      <input
                                        id={`pred-away-val-${match.id}`}
                                        type="number"
                                        min={0}
                                        max={99}
                                        disabled={isLocked}
                                        readOnly={isLocked}
                                        value={savedPred.away}
                                        onChange={(e) =>
                                          onScoreChange(
                                            match.id,
                                            "away",
                                            e.target.value,
                                          )
                                        }
                                        className={`w-8 text-center bg-transparent border-0 font-display font-black text-white text-base focus:ring-0 outline-hidden p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                                          isLocked
                                            ? "pointer-events-none cursor-default"
                                            : "pointer-events-auto"
                                        }`}
                                      />

                                      {!isLocked && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const val = (savedPred.away || 0) + 1;
                                          onScoreChange(
                                            match.id,
                                            "away",
                                            val.toString(),
                                          );
                                        }}
                                        className="relative p-1 rounded-sm bg-slate-900 border border-slate-800 text-slate-400 hover:text-emerald-400 transition-all flex items-center justify-center cursor-pointer overflow-hidden group select-none"
                                      >
                                        <div className="absolute inset-[-100%] z-0 group-hover:animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#00000000_50%,#10b981_100%)] opacity-0 group-hover:opacity-100" />
                                        <div className="absolute inset-[1px] bg-slate-900 rounded-sm z-0" />
                                        <Plus className="w-2.5 h-2.5 relative z-10" />
                                      </button>
                                      )}
                                    </div>
                                    <h5
                                      className={`mt-1 ${TEAM_NAME_CLASS} ${
                                        showActiveGreen && awayLeading
                                          ? "text-emerald-400"
                                          : showActiveGreen && isDrawPick
                                            ? "text-emerald-300/80"
                                            : "text-white"
                                      }`}
                                      title={match.awayTeam}
                                    >
                                      {formatTeamName(match.awayTeam)}
                                    </h5>
                                  </div>
                                </div>
                              ) : (
                                <div className="w-full min-w-0 space-y-2">
                                  {/* Same full-width 3-col shell as football so VS stays dead-centred. */}
                                  <div
                                    className={`w-full grid grid-cols-3 items-start gap-2 sm:gap-3 ${
                                      isLocked ? "opacity-90" : ""
                                    }`}
                                  >
                                    <div className="min-w-0 flex flex-col items-center text-center">
                                      <button
                                        type="button"
                                        disabled={isLocked}
                                        onClick={() => {
                                          const currentMargin =
                                            Math.abs(
                                              (savedPred.home || 0) -
                                                (savedPred.away || 0),
                                            ) || 1;
                                          onRugbyPredictionChange(
                                            match.id,
                                            "home",
                                            currentMargin.toString(),
                                          );
                                        }}
                                        className={`w-full flex items-center justify-center bg-slate-950 px-1.5 py-1 rounded-xl border transition-all select-none min-w-0 ${
                                          isLocked
                                            ? "cursor-default border-slate-700/80"
                                            : "cursor-pointer"
                                        } ${
                                          homeLeading
                                            ? "border-emerald-500/40 bg-emerald-500/10"
                                            : "border-slate-800 hover:border-emerald-500/40"
                                        }`}
                                      >
                                        <span
                                          className={`${TEAM_NAME_CLASS} ${
                                            homeLeading
                                              ? "text-emerald-400"
                                              : showActiveGreen && isDrawPick
                                                ? "text-emerald-300/80"
                                                : "text-white"
                                          }`}
                                          title={match.homeTeam}
                                        >
                                          {formatTeamName(match.homeTeam)}
                                        </span>
                                      </button>
                                    </div>

                                    <div className="min-w-0 flex flex-col items-center justify-center text-center gap-1 px-1 pt-2">
                                      <span
                                        className={`${matchStatus.className} whitespace-nowrap`}
                                      >
                                        {matchStatus.label}
                                      </span>
                                      <span className="font-mono font-bold text-slate-600 text-[10px] uppercase tracking-widest">
                                        vs
                                      </span>
                                      <button
                                        type="button"
                                        disabled={isLocked}
                                        onClick={() => {
                                          onRugbyPredictionChange(
                                            match.id,
                                            "draw",
                                            "0",
                                          );
                                        }}
                                        className={`w-full h-6 sm:h-9 rounded-md sm:rounded-lg border text-[9px] sm:text-[10px] font-bold font-display uppercase tracking-wide transition-all select-none ${
                                          isLocked
                                            ? "cursor-default"
                                            : "cursor-pointer"
                                        } ${
                                          isDrawPick ||
                                          ((savedPred.home || 0) ===
                                            (savedPred.away || 0) &&
                                            hasPick)
                                            ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                                            : "bg-slate-950/60 border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-300"
                                        }`}
                                      >
                                        Draw
                                      </button>
                                      {lockControl}
                                    </div>

                                    <div className="min-w-0 flex flex-col items-center text-center">
                                      <button
                                        type="button"
                                        disabled={isLocked}
                                        onClick={() => {
                                          const currentMargin =
                                            Math.abs(
                                              (savedPred.home || 0) -
                                                (savedPred.away || 0),
                                            ) || 1;
                                          onRugbyPredictionChange(
                                            match.id,
                                            "away",
                                            currentMargin.toString(),
                                          );
                                        }}
                                        className={`w-full flex items-center justify-center bg-slate-950 px-1.5 py-1 rounded-xl border transition-all select-none min-w-0 ${
                                          isLocked
                                            ? "cursor-default border-slate-700/80"
                                            : "cursor-pointer"
                                        } ${
                                          awayLeading
                                            ? "border-emerald-500/40 bg-emerald-500/10"
                                            : "border-slate-800 hover:border-emerald-500/40"
                                        }`}
                                      >
                                        <span
                                          className={`${TEAM_NAME_CLASS} ${
                                            awayLeading
                                              ? "text-emerald-400"
                                              : showActiveGreen && isDrawPick
                                                ? "text-emerald-300/80"
                                                : "text-white"
                                          }`}
                                          title={match.awayTeam}
                                        >
                                          {formatTeamName(match.awayTeam)}
                                        </span>
                                      </button>
                                    </div>
                                  </div>

                                  {/* Margin — compact, same pattern as before */}
                                  {(savedPred.home || 0) !== (savedPred.away || 0) ? (
                                    isSubmitted ? (
                                      <div className="flex flex-col items-center text-center w-full bg-slate-900/50 py-2 px-3 rounded-xl border border-emerald-500/20">
                                        <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-slate-400 mb-0.5 select-none">
                                          Your Prediction
                                        </span>
                                        <span className="font-display font-black text-emerald-400 text-xs sm:text-sm">
                                          {(savedPred.home || 0) >
                                          (savedPred.away || 0)
                                            ? formatTeamName(match.homeTeam)
                                            : formatTeamName(match.awayTeam)}{" "}
                                          by{" "}
                                          {Math.abs(
                                            (savedPred.home || 0) -
                                              (savedPred.away || 0),
                                          )}{" "}
                                          {Math.abs(
                                            (savedPred.home || 0) -
                                              (savedPred.away || 0),
                                          ) === 1
                                            ? "Point"
                                            : "Points"}
                                        </span>
                                      </div>
                                    ) : (
                                      <div className="flex flex-col items-center text-center w-full">
                                        <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-emerald-400/80 mb-1 select-none">
                                          Winning Margin (Points)
                                        </span>
                                        <select
                                          disabled={isLocked}
                                          value={Math.abs(
                                            (savedPred.home || 0) -
                                              (savedPred.away || 0),
                                          ).toString()}
                                          onChange={(e) => {
                                            const currentWinner =
                                              (savedPred.home || 0) >
                                              (savedPred.away || 0)
                                                ? "home"
                                                : "away";
                                            onRugbyPredictionChange(
                                              match.id,
                                              currentWinner,
                                              e.target.value,
                                            );
                                          }}
                                          className="w-full max-w-[200px] text-center bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl py-1.5 px-3 font-display font-bold text-white text-sm outline-hidden"
                                        >
                                          {Array.from(
                                            { length: 100 },
                                            (_, i) => i + 1,
                                          ).map((num) => (
                                            <option key={num} value={num}>
                                              {num}{" "}
                                              {num === 1 ? "Point" : "Points"}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                    )
                                  ) : (
                                    isSubmitted && (
                                      <div className="flex flex-col items-center text-center w-full bg-slate-900/50 py-2 px-3 rounded-xl border border-emerald-500/20">
                                        <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-slate-400 mb-0.5 select-none">
                                          Your Prediction
                                        </span>
                                        <span className="font-display font-black text-emerald-400 text-xs sm:text-sm">
                                          Draw
                                        </span>
                                      </div>
                                    )
                                  )}
                                </div>
                              )}
                              </div>

                            {/* Consensus: only after lock, and only with ≥20 submitted picks */}
                            {isSubmitted && (
                              <div className="mt-2.5 border-t border-slate-800/60 pt-2 overflow-hidden">
                                <div className="flex items-center justify-center gap-1.5">
                                  <Users className="h-3.5 w-3.5 text-slate-600" />
                                  <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-slate-500">
                                    Community Consensus
                                  </span>
                                </div>
                                {consensus &&
                                consensus.total >= CONSENSUS_THRESHOLD ? (
                                  <div className="mt-1.5 space-y-1">
                                    <div className="flex h-2 overflow-hidden rounded-full bg-slate-800">
                                      <div
                                        className="bg-blue-500"
                                        style={{
                                          width: `${(consensus.home / consensus.total) * 100}%`,
                                        }}
                                      />
                                      <div
                                        className="bg-slate-500"
                                        style={{
                                          width: `${(consensus.draw / consensus.total) * 100}%`,
                                        }}
                                      />
                                      <div
                                        className="bg-rose-500"
                                        style={{
                                          width: `${(consensus.away / consensus.total) * 100}%`,
                                        }}
                                      />
                                    </div>
                                    <p className="text-center text-[10px] font-mono text-slate-400">
                                      {Math.round(
                                        (consensus.home / consensus.total) * 100,
                                      )}
                                      % Home ·{" "}
                                      {Math.round(
                                        (consensus.draw / consensus.total) * 100,
                                      )}
                                      % Draw ·{" "}
                                      {Math.round(
                                        (consensus.away / consensus.total) * 100,
                                      )}
                                      % Away
                                    </p>
                                  </div>
                                ) : (
                                  <p className="mt-0.5 text-center text-[11px] text-slate-500 font-sans">
                                    Be among the first to predict this match
                                  </p>
                                )}
                              </div>
                            )}
                            </div>
                          </div>
                        );
                      })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
      )}

      {pendingLock && (
        <PowerUpLockConfirmModal
          open
          powerUpId={pendingLock.powerUpId}
          fixtureLabel={pendingLock.fixtureLabel}
          onCancel={() => setPendingLock(null)}
          onConfirm={() => {
            const { matchId, powerupInstanceId } = pendingLock;
            setPendingLock(null);
            onSubmitPrediction(matchId, powerupInstanceId);
            setArmedInstanceByMatch((prev) => {
              const next = { ...prev };
              delete next[matchId];
              return next;
            });
            void queryClient.invalidateQueries({
              queryKey: ["userPowerups", userId, powerUpSport],
            });
          }}
        />
      )}

      {plainLockConfirm && (
        <LockConfirmModal
          open
          fixtureLabel={plainLockConfirm.fixtureLabel}
          onCancel={() => setPlainLockConfirm(null)}
          onConfirm={() => {
            const { matchId } = plainLockConfirm;
            setPlainLockConfirm(null);
            onSubmitPrediction(matchId, null);
          }}
        />
      )}
    </>
  );
}
