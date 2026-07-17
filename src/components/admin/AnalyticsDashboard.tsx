import React, { useCallback, useEffect, useState } from 'react';
import {
  Users,
  Activity,
  Database,
  RefreshCw,
  AlertTriangle,
  BarChart3,
  Repeat,
  ShieldAlert,
} from 'lucide-react';
import {
  AdminAnalyticsSnapshot,
  dbFetchAdminAnalytics,
} from '../../supabase';

interface AnalyticsDashboardProps {
  /** Caller must only mount this when the session user is an admin. */
  isAdmin: boolean;
}

function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: React.FC<{ className?: string }>;
  accent: string;
}) {
  return (
    <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-xl space-y-2 relative overflow-hidden">
      <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full blur-2xl opacity-30 pointer-events-none ${accent}`} />
      <h4 className="text-[10px] font-bold font-mono text-slate-500 uppercase tracking-widest flex items-center gap-2 relative">
        <Icon className="w-3.5 h-3.5" /> {label}
      </h4>
      <div className="text-3xl font-bold text-white font-mono relative">{value}</div>
      <p className="text-[9px] text-slate-500 font-mono leading-snug relative">{hint}</p>
    </div>
  );
}

function ProgressStat({
  label,
  pct,
  barClass,
  trackHint,
}: {
  label: string;
  pct: number;
  barClass: string;
  trackHint: string;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] text-slate-300 font-sans">{label}</span>
        <span className="text-sm font-mono font-bold text-white tabular-nums">{clamped.toFixed(1)}%</span>
      </div>
      <div className="h-2.5 rounded-full bg-slate-950 border border-slate-800 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${barClass}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <p className="text-[9px] text-slate-600 font-mono">{trackHint}</p>
    </div>
  );
}

/** Lightweight CSS donut — no charting library dependency. */
function SportVolumeDonut({
  football,
  rugby,
}: {
  football: number;
  rugby: number;
}) {
  const total = football + rugby;
  const fbPct = total > 0 ? (football / total) * 100 : 50;
  const gradient =
    total === 0
      ? 'conic-gradient(#334155 0% 100%)'
      : `conic-gradient(#3b82f6 0% ${fbPct}%, #f59e0b ${fbPct}% 100%)`;

  return (
    <div className="flex items-center gap-4">
      <div
        className="relative w-24 h-24 rounded-full shrink-0 shadow-inner"
        style={{ background: gradient }}
        aria-hidden
      >
        <div className="absolute inset-3 rounded-full bg-slate-900 border border-slate-800 flex flex-col items-center justify-center">
          <span className="text-[9px] font-mono text-slate-500 uppercase">Total</span>
          <span className="text-sm font-bold font-mono text-white">{total}</span>
        </div>
      </div>
      <div className="space-y-2 min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="flex items-center gap-1.5 text-slate-300">
            <span className="w-2 h-2 rounded-full bg-blue-500" /> Football
          </span>
          <span className="font-mono text-white font-bold">
            {football}
            <span className="text-slate-500 font-normal ml-1">
              ({total > 0 ? ((football / total) * 100).toFixed(0) : 0}%)
            </span>
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="flex items-center gap-1.5 text-slate-300">
            <span className="w-2 h-2 rounded-full bg-amber-500" /> Rugby
          </span>
          <span className="font-mono text-white font-bold">
            {rugby}
            <span className="text-slate-500 font-normal ml-1">
              ({total > 0 ? ((rugby / total) * 100).toFixed(0) : 0}%)
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsDashboard({ isAdmin }: AnalyticsDashboardProps) {
  const [data, setData] = useState<AdminAnalyticsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    try {
      setLoading(true);
      setError(null);
      const snapshot = await dbFetchAdminAnalytics();
      setData(snapshot);
    } catch (err: any) {
      setError(err?.message || 'Failed to load analytics');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 h-48 text-rose-300 bg-slate-900/50 rounded-xl border border-rose-500/20 px-6 text-center">
        <ShieldAlert className="w-6 h-6 text-rose-400" />
        <p className="text-sm font-semibold">Admin access required</p>
        <p className="text-[11px] text-slate-500 font-mono">
          Analytics &amp; Insights is restricted to administrator accounts.
        </p>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="flex justify-center items-center h-48 text-slate-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading engagement analytics...
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 h-48 text-rose-400 bg-slate-900/50 rounded-xl border border-rose-500/20">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" /> {error}
        </div>
        <button
          type="button"
          onClick={load}
          className="text-[10px] font-mono uppercase tracking-wider text-slate-300 hover:text-white border border-slate-700 px-3 py-1.5 rounded-lg cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { crossPollination: xp, predictionsBySport } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h4 className="text-xs font-bold text-slate-300 font-mono uppercase tracking-wider flex items-center gap-1.5 mb-1">
            <BarChart3 className="w-4 h-4 text-cyan-400" /> Analytics &amp; Insights
          </h4>
          <p className="text-[10px] text-slate-500 font-sans max-w-xl">
            Engagement and cross-sport behaviour for monetization planning. Preferred sport
            (signup) is crossed with actual prediction sports.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="text-[10px] font-mono uppercase tracking-wider text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500 px-3 py-1.5 rounded-lg cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Top row — high-level metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          label="Total Registered Players"
          value={data.totalRegisteredPlayers}
          hint="Active profiles (excludes freed accounts)"
          icon={Users}
          accent="bg-blue-500"
        />
        <MetricCard
          label="Weekly Active Predictors"
          value={data.weeklyActivePredictors}
          hint="Unique users with a prediction touch in the last 7 days"
          icon={Activity}
          accent="bg-emerald-500"
        />
        <MetricCard
          label="Total Predictions"
          value={data.totalPredictions}
          hint={`${predictionsBySport.football} football · ${predictionsBySport.rugby} rugby`}
          icon={Database}
          accent="bg-purple-500"
        />
      </div>

      {/* Middle — volume + cross-pollination */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 space-y-4">
          <div>
            <h5 className="text-[10px] font-bold font-mono text-slate-400 uppercase tracking-widest mb-1">
              Prediction Volume by Sport
            </h5>
            <p className="text-[10px] text-slate-500 font-sans">
              All-time prediction rows tagged football vs rugby.
            </p>
          </div>
          <SportVolumeDonut
            football={predictionsBySport.football}
            rugby={predictionsBySport.rugby}
          />
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Repeat className="w-4 h-4 text-cyan-400" />
            <div>
              <h5 className="text-[10px] font-bold font-mono text-slate-400 uppercase tracking-widest">
                Cross-Pollination
              </h5>
              <p className="text-[10px] text-slate-500 font-sans">
                Share of each preferred-sport cohort that has predicted on each sport.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-lg border border-blue-500/20 bg-blue-950/20 p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-300">
                  Football Primary
                </span>
                <span className="text-[9px] font-mono text-slate-500">
                  n={xp.footballPrimary.cohortSize}
                </span>
              </div>
              <ProgressStat
                label="Predicting on Football"
                pct={xp.footballPrimary.pctPredictingFootball}
                barClass="bg-linear-to-r from-blue-600 to-blue-400"
                trackHint="Same-sport retention"
              />
              <ProgressStat
                label="Predicting on Rugby"
                pct={xp.footballPrimary.pctPredictingRugby}
                barClass="bg-linear-to-r from-amber-600 to-amber-400"
                trackHint="Cross-sport expansion"
              />
            </div>

            <div className="rounded-lg border border-amber-500/20 bg-amber-950/15 p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-300">
                  Rugby Primary
                </span>
                <span className="text-[9px] font-mono text-slate-500">
                  n={xp.rugbyPrimary.cohortSize}
                </span>
              </div>
              <ProgressStat
                label="Predicting on Rugby"
                pct={xp.rugbyPrimary.pctPredictingRugby}
                barClass="bg-linear-to-r from-amber-600 to-amber-400"
                trackHint="Same-sport retention"
              />
              <ProgressStat
                label="Predicting on Football"
                pct={xp.rugbyPrimary.pctPredictingFootball}
                barClass="bg-linear-to-r from-blue-600 to-blue-400"
                trackHint="Cross-sport expansion"
              />
            </div>
          </div>
        </div>
      </div>

      <p className="text-[9px] text-slate-600 font-mono text-center">
        Snapshot · {new Date(data.generatedAt).toLocaleString()} · Weekly window uses{' '}
        <span className="text-slate-500">predictions.created_at</span> (last-touch on upsert)
      </p>
    </div>
  );
}
