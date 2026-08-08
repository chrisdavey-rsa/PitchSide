/**
 * Match-card chrome: sport colour strip + kick-off meta.
 * Competition context lives in feed sub-headers (not in-card).
 */
import React from "react";
import { Ticket } from "lucide-react";
import CompetitionFlag from "./CompetitionFlag";
import type { SportKey } from "../../sports/emerging/types";
import { getCompetitionTitle } from "../../constants/competitions";
import { displayTeamName } from "../../lib/teamNames";
import { isLiveMatch } from "../../lib/matchStatus";
import { formatLiveMatchClock } from "../../lib/matchClock";
import type { Match } from "../../types";

/** Known Community Shield / Golden Ticket competition id. */
const GOLDEN_TICKET_COMPETITION_ID = "f-shield";

/** True when the fixture awards / is branded as a Golden Ticket marquee. */
export function isGoldenTicketMatch(
  match: Pick<Match, "id" | "competitionId" | "isGoldenTicket" | "matchTag">,
): boolean {
  if (match.isGoldenTicket === true) return true;
  if (match.competitionId === GOLDEN_TICKET_COMPETITION_ID) return true;
  if (match.id === "f-communityshield") return true;
  const tag = String(match.matchTag || "").toLowerCase();
  return tag.includes("golden ticket") || tag.includes("golden-ticket");
}

/** Extra card chrome classes for Golden Ticket fixtures. */
export const GOLDEN_TICKET_CARD_CLASS =
  "border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.2)] bg-slate-900";

/** F1 checkered strip (user-specified repeating gradients). */
const F1_CHECKERED: React.CSSProperties = {
  backgroundImage:
    "repeating-linear-gradient(45deg, #000 25%, transparent 25%, transparent 75%, #000 75%, #000), repeating-linear-gradient(45deg, #000 25%, #fff 25%, #fff 75%, #000 75%, #000)",
  backgroundPosition: "0 0, 4px 4px",
  backgroundSize: "8px 8px",
  backgroundColor: "#fff",
};

/** Shared team-name styling — wraps to a second line instead of clipping. */
export const TEAM_NAME_CLASS =
  "whitespace-normal text-center leading-tight break-words font-extrabold font-display text-[11px] sm:text-sm tracking-tight w-full max-w-full px-0.5";

export function formatTeamName(name: string | null | undefined): string {
  return displayTeamName(name);
}

function normalizeSport(sport: string | null | undefined): SportKey | string {
  const s = String(sport || "football").toLowerCase();
  if (s === "f1" || s === "formula_1") return "formula1";
  return s;
}

/** Absolute left sport colour strip on fixture cards. */
export function SportColorStrip({
  sport,
  isGoldenTicket = false,
}: {
  sport: string | null | undefined;
  /** When true, use the gold accent bar (ticket icon is rendered separately). */
  isGoldenTicket?: boolean;
}) {
  if (isGoldenTicket) {
    return (
      <span
        aria-hidden
        className="absolute left-0 top-0 bottom-0 w-2 rounded-l-md z-[1] bg-gradient-to-b from-yellow-400 via-amber-500 to-yellow-700 shadow-[0_0_12px_rgba(234,179,8,0.45)]"
      />
    );
  }

  const key = normalizeSport(sport);

  if (key === "formula1") {
    return (
      <span
        aria-hidden
        className="absolute left-0 top-0 bottom-0 w-2 rounded-l-md z-[1]"
        style={F1_CHECKERED}
      />
    );
  }

  const tone =
    key === "rugby"
      ? "bg-orange-500"
      : key === "golf"
        ? "bg-white border-r border-slate-300/40"
        : "bg-blue-500";

  return (
    <span
      aria-hidden
      className={`absolute left-0 top-0 bottom-0 w-2 rounded-l-md z-[1] ${tone}`}
    />
  );
}

/**
 * Golden Ticket mark — place inside the Home team name row (`relative`) so it
 * shares that row’s vertical center without shifting the centred grid.
 */
export function GoldenTicketCardIcon({
  className = "",
}: {
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute top-1/2 z-[2] -translate-y-1/2 -rotate-12 ${className}`}
      title="Golden Ticket fixture"
    >
      <Ticket
        className="h-6 w-6 text-[#FFD700] drop-shadow-[0_0_8px_rgba(253,224,71,0.85)]"
        strokeWidth={2.2}
        absoluteStrokeWidth
      />
    </span>
  );
}

type MetaProps = {
  competitionId?: string | null;
  competitionName?: string | null;
  className?: string;
};

/**
 * Competition sub-header row for the feed (date → competition → fixtures).
 */
export function CompetitionSubHeader({
  competitionId,
  competitionName,
  className = "",
}: MetaProps) {
  if (!competitionId && !competitionName) return null;
  const title = getCompetitionTitle(competitionId, competitionName);
  return (
    <div
      className={`flex items-center gap-2 px-1 ${className}`}
      title={title}
    >
      <CompetitionFlag
        competitionId={competitionId}
        competitionName={competitionName}
        showTitle={false}
        size={14}
      />
      <span className="text-[10px] sm:text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-400 truncate">
        {title}
      </span>
    </div>
  );
}

/** @deprecated Competition meta is rendered as feed sub-headers. */
export function CardCompetitionMeta({
  competitionId,
  competitionName,
  className = "",
}: MetaProps) {
  return (
    <CompetitionSubHeader
      competitionId={competitionId}
      competitionName={competitionName}
      className={className}
    />
  );
}

/** Shared size for kick-off + Locked/Unpicked bottom-corner metadata. */
export const CARD_CORNER_META_CLASS =
  "font-mono text-[10px] font-bold uppercase tracking-wider leading-none";

/** Centre-column status for upcoming / live / same-day finished fixtures. */
export function MatchCentreStatusLabel({
  match,
}: {
  match: Pick<Match, "status">;
}) {
  if (isLiveMatch(match)) {
    return (
      <span className="inline-flex items-center justify-center gap-1.5 text-rose-400 font-mono text-[10px] uppercase tracking-widest font-bold">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
        </span>
        IN PLAY
      </span>
    );
  }
  if (match.status === "completed") {
    return (
      <span className="text-emerald-400 font-mono text-[10px] uppercase tracking-widest font-bold">
        Full time
      </span>
    );
  }
  return (
    <span className="text-slate-400 font-mono text-[10px] uppercase tracking-widest font-bold">
      To be played
    </span>
  );
}

/** Live score + clock for the centre column between team names. */
export function MatchLiveScoreCentre({
  homeScore,
  awayScore,
  matchMinute,
  status,
}: {
  homeScore?: number | null;
  awayScore?: number | null;
  matchMinute?: string | null;
  /** Domain or provider status (HT / FT / live / …). */
  status?: string | null;
}) {
  const clock = formatLiveMatchClock({ status, matchMinute });
  const isTerminalClock =
    clock === "FT" || clock === "AET" || clock === "PEN" || clock === "HT";

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="font-display font-black text-xl sm:text-2xl tracking-widest text-white tabular-nums leading-none">
        {homeScore != null ? homeScore : "–"}
        <span className="mx-1.5 text-slate-500">–</span>
        {awayScore != null ? awayScore : "–"}
      </span>
      {clock ? (
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] sm:text-xs font-mono font-bold tracking-wide tabular-nums ${
            isTerminalClock
              ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-300"
              : "border-rose-500/35 bg-rose-500/10 text-rose-300"
          }`}
        >
          {!isTerminalClock ? (
            <span className="relative flex h-1.5 w-1.5" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-50" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-500" />
            </span>
          ) : null}
          {clock}
        </span>
      ) : null}
    </div>
  );
}

/** Kick-off time — bottom-left of the card, clear of team names / inputs. */
export function CardKickoffTime({
  matchDate,
  className = "",
}: {
  matchDate: string;
  className?: string;
}) {
  const label = new Date(matchDate).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <span
      className={`${CARD_CORNER_META_CLASS} tabular-nums text-slate-400 tracking-wide ${className}`}
    >
      {label}
    </span>
  );
}

/** @deprecated Prefer CompetitionSubHeader */
export function CompetitionHeaderLabel({
  competitionId,
  competitionName,
  className = "",
}: MetaProps & { sport?: SportKey }) {
  return (
    <CompetitionSubHeader
      competitionId={competitionId}
      competitionName={competitionName}
      className={className}
    />
  );
}

export function CompetitionTitleRow({
  competitionId,
  competitionName,
  className = "",
}: MetaProps) {
  if (!competitionId && !competitionName) return null;
  return (
    <span className={`truncate ${className}`}>
      {getCompetitionTitle(competitionId, competitionName)}
    </span>
  );
}

export { CompetitionFlag };
