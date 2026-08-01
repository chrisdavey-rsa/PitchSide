import React, { useEffect, useState } from "react";
import { Activity, AlertTriangle, RefreshCw } from "lucide-react";
import { supabase } from "../../supabase";

type MetricRow = {
  service_name: string;
  status: "STABLE" | "ERROR" | string;
  last_sync_time: string | null;
  api_quota_remaining: number | null;
  error_message: string | null;
};

function formatRelative(iso: string | null): string {
  if (!iso) return "Never";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "Unknown";
  const diffSec = Math.round((Date.now() - t) / 1000);
  if (diffSec < 45) return "Just now";
  if (diffSec < 3600) {
    const m = Math.max(1, Math.round(diffSec / 60));
    return `${m} min${m === 1 ? "" : "s"} ago`;
  }
  if (diffSec < 86400) {
    const h = Math.round(diffSec / 3600);
    return `${h} hour${h === 1 ? "" : "s"} ago`;
  }
  const d = Math.round(diffSec / 86400);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

function quotaClass(remaining: number | null): string {
  if (remaining == null) return "text-slate-400";
  if (remaining < 500) return "text-rose-400";
  if (remaining < 1000) return "text-amber-300";
  return "text-emerald-300";
}

export default function ApiStatusWidget() {
  const [rows, setRows] = useState<MetricRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const { data, error: qErr } = await supabase
        .from("system_metrics")
        .select(
          "service_name, status, last_sync_time, api_quota_remaining, error_message",
        )
        .order("service_name", { ascending: true });
      if (qErr) throw qErr;
      setRows((data as MetricRow[]) || []);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load API metrics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 sm:p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-xs font-bold text-slate-200 font-mono uppercase tracking-wider flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-emerald-400" />
            API Health
          </h4>
          <p className="text-[10px] text-slate-500 font-sans mt-0.5">
            Live sync status from Edge Functions · refreshes every minute
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 cursor-pointer"
          aria-label="Refresh API metrics"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error ? (
        <div className="flex items-center gap-2 text-xs text-rose-300 bg-rose-950/30 border border-rose-500/20 rounded-lg px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          {error}
        </div>
      ) : null}

      {loading && rows.length === 0 ? (
        <div className="text-xs text-slate-500 font-mono py-4 text-center">
          Loading metrics…
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {rows.map((row) => {
            const stable = row.status === "STABLE";
            return (
              <div
                key={row.service_name}
                className="rounded-lg border border-slate-800/80 bg-slate-900/50 px-3.5 py-3 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-white font-display truncate">
                    {row.service_name}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-300">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        stable
                          ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]"
                          : "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.7)]"
                      }`}
                    />
                    {stable ? "Stable" : "Error"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 text-[10px] font-mono">
                  <span className="text-slate-500">
                    Last sync ·{" "}
                    <span className="text-slate-300">
                      {formatRelative(row.last_sync_time)}
                    </span>
                  </span>
                  <span className={quotaClass(row.api_quota_remaining)}>
                    Quota{" "}
                    {row.api_quota_remaining != null
                      ? row.api_quota_remaining.toLocaleString()
                      : "—"}
                  </span>
                </div>
                {!stable && row.error_message ? (
                  <p className="text-[10px] text-rose-300/90 font-sans leading-snug line-clamp-2">
                    {row.error_message}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
