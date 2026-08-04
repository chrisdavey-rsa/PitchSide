import React, { useMemo } from "react";
import { Activity, Crosshair, Percent, Trophy } from "lucide-react";
import { UserProfile, League, SportType } from "../../types";
import { getAvailableSeasons } from "../../seasons";
import {
  useMatchesQuery,
  usePredictionsQuery,
} from "../../hooks/usePitchsideQueries";
import { calculatePoints } from "../../utils";
import type { PredictionEntry } from "../../supabase";
import { formatAccuracyPercent } from "../../lib/formatAccuracy";

interface HistoricScoresProps {
  user: UserProfile;
  registeredUsers: UserProfile[];
  realLeagues: League[];
  selectedSeason: string;
  setSelectedSeason: (season: string) => void;
  selectedHistoricLeague: string;
  setSelectedHistoricLeague: (league: string) => void;
}

type HistoryRow = {
  matchId: string;
  fixture: string;
  prediction: string;
  result: string;
  points: number | null;
  status: "active" | "settled" | "pending";
  matchDate: string;
};

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

function formatPct(hits: number, total: number): string {
  if (total <= 0) return "—";
  return formatAccuracyPercent((hits / total) * 100);
}

export const HistoricScores: React.FC<HistoricScoresProps> = ({
  user,
  selectedSeason,
  setSelectedSeason,
}) => {
  const seasons = getAvailableSeasons();
  const multiSeason = seasons.length > 1;
  const { data: matches = [] } = useMatchesQuery();
  const { data: predictionsData } = usePredictionsQuery(user.id);
  const predictions: Record<string, PredictionEntry> = predictionsData ?? {};

  const historyRows = useMemo<HistoryRow[]>(() => {
    const rows: HistoryRow[] = [];

    for (const [matchId, pred] of Object.entries(predictions) as Array<
      [string, PredictionEntry]
    >) {
      if (!pred.submitted) continue;
      const match = matches.find((m) => m.id === matchId);
      if (!match) continue;
      if (match.season && match.season !== selectedSeason) continue;

      const hasResult =
        match.status === "completed" &&
        typeof match.homeScore === "number" &&
        typeof match.awayScore === "number";

      const points = hasResult
        ? calculatePoints(
            match.sport as SportType,
            pred.home,
            pred.away,
            match.homeScore as number,
            match.awayScore as number,
          )
        : null;

      rows.push({
        matchId,
        fixture: `${match.homeTeam} v ${match.awayTeam}`,
        prediction: `${pred.home}–${pred.away}`,
        result: hasResult
          ? `${match.homeScore}–${match.awayScore}`
          : match.status === "live"
            ? "Live"
            : "Pending",
        points,
        status: hasResult
          ? "settled"
          : match.status === "live" || match.status === "upcoming"
            ? "active"
            : "pending",
        matchDate: match.matchDate,
      });
    }

    return rows.sort(
      (a, b) =>
        new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime(),
    );
  }, [matches, predictions, selectedSeason]);

  const hud = useMemo(() => {
    const weekStart = startOfWeek(new Date());
    const thisWeek = historyRows.filter((r) => {
      const d = new Date(r.matchDate);
      return d >= weekStart;
    });
    const thisWeekActive = thisWeek.filter((r) => r.status === "active").length;

    const seasonSettled = historyRows.filter((r) => r.points !== null);
    const seasonHits = seasonSettled.filter((r) => (r.points ?? 0) > 0).length;

    let allTimeTotal = 0;
    let allTimeHits = 0;
    for (const [matchId, pred] of Object.entries(predictions) as Array<
      [string, PredictionEntry]
    >) {
      if (!pred.submitted) continue;
      const match = matches.find((m) => m.id === matchId);
      if (
        !match ||
        match.status !== "completed" ||
        typeof match.homeScore !== "number" ||
        typeof match.awayScore !== "number"
      ) {
        continue;
      }
      allTimeTotal += 1;
      const pts = calculatePoints(
        match.sport as SportType,
        pred.home,
        pred.away,
        match.homeScore,
        match.awayScore,
      );
      if (pts > 0) allTimeHits += 1;
    }

    return {
      thisWeekLabel:
        thisWeek.length === 0
          ? "—"
          : `${thisWeekActive} active / ${thisWeek.length}`,
      seasonAccuracy: formatPct(seasonHits, seasonSettled.length),
      allTimeAccuracy: formatPct(allTimeHits, allTimeTotal),
    };
  }, [historyRows, matches, predictions]);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Performance HUD */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400" />
          <h5 className="text-xs font-bold font-display text-white uppercase tracking-wide">
            Performance HUD
          </h5>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-3.5 py-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Crosshair className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500">
                This Week&apos;s Predictions
              </span>
            </div>
            <p className="text-sm font-bold font-display text-white tabular-nums">
              {hud.thisWeekLabel}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">Active status</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-3.5 py-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Percent className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500">
                Season Accuracy
              </span>
            </div>
            <p className="text-sm font-bold font-display text-white tabular-nums">
              {hud.seasonAccuracy}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Scoring predictions · {selectedSeason}
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-3.5 py-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Trophy className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500">
                All-Time Accuracy
              </span>
            </div>
            <p className="text-sm font-bold font-display text-white tabular-nums">
              {hud.allTimeAccuracy}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">Career hit rate</p>
          </div>
        </div>
      </div>

      <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800 flex flex-col gap-2.5">
        <span className="text-[10px] font-bold text-slate-400 font-mono uppercase tracking-widest text-center block">
          {multiSeason ? "Seasons" : "Season"}
        </span>
        <div
          role="tablist"
          aria-label="Prediction history seasons"
          data-no-swipe="true"
          className={`flex flex-row gap-2 overflow-x-auto ${multiSeason ? "flex-wrap sm:flex-nowrap" : ""}`}
        >
          {seasons.map((season) => {
            const isActive = selectedSeason === season;
            return (
              <button
                key={season}
                id={`acc-season-tab-${season}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setSelectedSeason(season)}
                className={`flex-1 min-w-[4.5rem] py-2 px-3 rounded-lg text-xs font-semibold font-mono border transition-colors cursor-pointer ${
                  isActive
                    ? "bg-transparent border-slate-400 text-white ring-1 ring-slate-500/60"
                    : "bg-transparent border-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-200"
                }`}
              >
                {season}
              </button>
            );
          })}
        </div>
      </div>

      {/* Prediction History rows */}
      <div className="rounded-2xl border border-slate-800 overflow-hidden">
        <div className="px-3.5 py-2.5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between gap-2">
          <h5 className="text-xs font-bold font-display text-white uppercase tracking-wide">
            Prediction History
          </h5>
          <span className="text-[10px] font-mono text-slate-500">
            {historyRows.length} row{historyRows.length === 1 ? "" : "s"}
          </span>
        </div>

        {historyRows.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-slate-500 font-sans">
            No locked predictions for {selectedSeason} yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            <div className="hidden sm:grid grid-cols-[minmax(0,2fr)_1fr_1fr_0.75fr] gap-2 px-3.5 py-2 text-[9px] font-mono uppercase tracking-widest text-slate-500 bg-slate-950/40">
              <span>Match Fixture</span>
              <span>Your Prediction</span>
              <span>Actual Result</span>
              <span className="text-right">Points</span>
            </div>
            {historyRows.map((row) => (
              <div
                key={row.matchId}
                className="grid grid-cols-1 sm:grid-cols-[minmax(0,2fr)_1fr_1fr_0.75fr] gap-1.5 sm:gap-2 px-3.5 py-3 text-xs hover:bg-slate-900/40 transition-colors"
              >
                <div className="min-w-0">
                  <span className="sm:hidden text-[9px] font-mono uppercase tracking-widest text-slate-600 block mb-0.5">
                    Fixture
                  </span>
                  <p className="font-semibold text-slate-100 truncate">{row.fixture}</p>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                    {new Date(row.matchDate).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <div>
                  <span className="sm:hidden text-[9px] font-mono uppercase tracking-widest text-slate-600 block mb-0.5">
                    Prediction
                  </span>
                  <p className="font-mono text-slate-200 tabular-nums">{row.prediction}</p>
                </div>
                <div>
                  <span className="sm:hidden text-[9px] font-mono uppercase tracking-widest text-slate-600 block mb-0.5">
                    Result
                  </span>
                  <p className="font-mono text-slate-300 tabular-nums">{row.result}</p>
                </div>
                <div className="sm:text-right">
                  <span className="sm:hidden text-[9px] font-mono uppercase tracking-widest text-slate-600 block mb-0.5">
                    Points
                  </span>
                  <p
                    className={`font-bold font-display tabular-nums ${
                      row.points === null
                        ? "text-slate-500"
                        : row.points > 0
                          ? "text-emerald-400"
                          : "text-slate-400"
                    }`}
                  >
                    {row.points === null ? "—" : row.points}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
