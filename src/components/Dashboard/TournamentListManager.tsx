import React, { useMemo } from "react";
import { Check, Lock } from "lucide-react";
import {
  ALL_COMPETITIONS,
  getCompetitionFlagCode,
} from "../../constants/competitions";
import {
  GOLF_COVERAGE_TIERS,
  type GolfCoverageTier,
} from "../../constants/golfCoverage";
import CompetitionGlyph from "../predictions/CompetitionGlyph";
import { SportIcon } from "../../sports/emerging/sportIcons";
import { SportType } from "../../types";

export type TournamentSportGroup = "football" | "rugby" | "golf" | "formula1";

export type TournamentCatalogRow = {
  id: string;
  name: string;
  sport: TournamentSportGroup;
  flagCode: string | null;
  description?: string;
  /** When true, row cannot be toggled (Golf / F1 Coming Soon). */
  comingSoon?: boolean;
};

type TournamentListManagerProps = {
  /**
   * `manage` — show all core leagues; toggle subscribe/unsubscribe.
   * `add` — show only unsubscribed core leagues (opt-in modal).
   */
  mode: "manage" | "add";
  subscribedLeagues: readonly string[];
  /** Selected / pending ids (controlled). */
  selectedIds: readonly string[];
  onToggle: (id: string) => void;
  golfCoverageTier?: GolfCoverageTier;
  className?: string;
};

const COMING_SOON_SPORTS: TournamentSportGroup[] = ["golf", "formula1"];

function buildCatalog(): TournamentCatalogRow[] {
  const rows: TournamentCatalogRow[] = ALL_COMPETITIONS.map((c) => ({
    id: c.id,
    name: c.name,
    sport: c.sport === SportType.RUGBY ? "rugby" : "football",
    flagCode: getCompetitionFlagCode(c.id),
  }));

  for (const tier of GOLF_COVERAGE_TIERS) {
    rows.push({
      id: tier.leagueId,
      name: tier.label,
      sport: "golf",
      flagCode: "us",
      description: tier.description,
      comingSoon: true,
    });
  }

  rows.push({
    id: "f1-coming-soon",
    name: "Formula 1 Grid",
    sport: "formula1",
    flagCode: null,
    description: "Qualifying & race predictions",
    comingSoon: true,
  });

  return rows;
}

const GROUP_META: Record<
  TournamentSportGroup,
  { label: string; sportKey: "football" | "rugby" | "golf" | "formula1" }
> = {
  football: { label: "Football", sportKey: "football" },
  rugby: { label: "Rugby", sportKey: "rugby" },
  golf: { label: "Golf", sportKey: "golf" },
  formula1: { label: "F1", sportKey: "formula1" },
};

/**
 * Shared tournament opt-in / management list (Account Portal + modal).
 */
export default function TournamentListManager({
  mode,
  subscribedLeagues,
  selectedIds,
  onToggle,
  className = "",
}: TournamentListManagerProps) {
  const subscribed = useMemo(
    () => new Set(subscribedLeagues),
    [subscribedLeagues],
  );
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

  const catalog = useMemo(() => buildCatalog(), []);

  const visible = useMemo(() => {
    if (mode === "manage") {
      // Manage: all football/rugby + disabled Golf/F1 teasers.
      return catalog;
    }
    // Add modal: unsubscribed football/rugby only + disabled Golf/F1 teasers.
    return catalog.filter(
      (r) =>
        r.comingSoon ||
        (!subscribed.has(r.id) && (r.sport === "football" || r.sport === "rugby")),
    );
  }, [catalog, mode, subscribed]);

  const grouped = useMemo(() => {
    const order: TournamentSportGroup[] = [
      "football",
      "rugby",
      "golf",
      "formula1",
    ];
    return order.map((sport) => ({
      sport,
      ...GROUP_META[sport],
      rows: visible.filter((r) => r.sport === sport),
      comingSoon: COMING_SOON_SPORTS.includes(sport),
    }));
  }, [visible]);

  return (
    <div className={`space-y-5 ${className}`}>
      {grouped.map((group) => {
        if (group.rows.length === 0 && !group.comingSoon) return null;

        return (
          <section key={group.sport}>
            <div className="flex items-center gap-2 mb-2">
              <SportIcon sport={group.sportKey} className="h-3.5 w-3.5 text-slate-400" />
              <h4 className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                {group.label}
              </h4>
              {group.comingSoon ? (
                <span className="text-[8px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-800 text-slate-500 border border-slate-700">
                  Coming Soon
                </span>
              ) : null}
            </div>

            {group.comingSoon ? (
              <ul className="space-y-1.5 opacity-50 pointer-events-none cursor-not-allowed">
                {(group.rows.length > 0
                  ? group.rows
                  : [
                      {
                        id: `${group.sport}-placeholder`,
                        name:
                          group.sport === "golf"
                            ? "Golf coverage tiers"
                            : "Formula 1 Grid",
                        sport: group.sport,
                        flagCode: null as string | null,
                        description: "In development",
                        comingSoon: true,
                      },
                    ]
                ).map((row) => (
                  <li key={row.id}>
                    <div className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-800 bg-slate-950/40 text-left">
                      <Lock className="w-4 h-4 text-slate-600 shrink-0" />
                      <span className="flex-1 min-w-0">
                        <span className="block text-xs font-semibold text-slate-400 truncate">
                          {row.name}
                        </span>
                        {row.description ? (
                          <span className="block text-[10px] text-slate-600 truncate">
                            {row.description}
                          </span>
                        ) : null}
                      </span>
                      <span className="text-[8px] font-mono uppercase text-slate-600 shrink-0">
                        Soon
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="space-y-1.5">
                {group.rows.map((row) => {
                  const checked =
                    mode === "manage" ? subscribed.has(row.id) : selected.has(row.id);

                  return (
                    <li key={row.id}>
                      <button
                        type="button"
                        onClick={() => onToggle(row.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left cursor-pointer transition-colors ${
                          checked
                            ? "border-emerald-500/50 bg-emerald-500/10"
                            : "border-slate-800 bg-slate-950/50 hover:border-slate-700"
                        }`}
                      >
                        <CompetitionGlyph
                          competitionId={row.id}
                          flagCode={row.flagCode}
                          alt={row.name}
                          size={20}
                        />
                        <span className="flex-1 min-w-0">
                          <span className="block text-xs font-semibold text-white truncate">
                            {row.name}
                          </span>
                          {row.description ? (
                            <span className="block text-[10px] text-slate-500 truncate">
                              {row.description}
                            </span>
                          ) : null}
                        </span>
                        <span
                          className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                            checked
                              ? "border-emerald-400 bg-emerald-500 text-slate-950"
                              : "border-slate-600"
                          }`}
                          aria-hidden
                        >
                          {checked ? <Check className="w-3 h-3" /> : null}
                        </span>
                        <span className="sr-only">
                          {checked ? "Subscribed" : "Not subscribed"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
