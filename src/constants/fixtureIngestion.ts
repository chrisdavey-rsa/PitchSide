/**
 * Cup / UEFA / Champions Cup ingestion boundaries for sync-schedule.
 * Mirrored in supabase/functions/_shared/fixtureIngestion.ts
 */

import {
  fixtureHasPreeminentFootballSide,
  isPitchsidePickTeam,
} from "./teamMatrices";

const CUP_FROM_R4 = new Set(["f-facup", "f-eflcup"]);
const UEFA_COMPS = new Set(["f-ucl", "f-uel"]);
const HEINEKEN = "r-heineken";

function roundText(roundName: string | null | undefined): string {
  return (roundName || "").trim().toLowerCase();
}

/** Extract trailing round number when present (Round 4, 4th Round, etc.). */
export function extractRoundNumber(roundName: string | null | undefined): number | null {
  const t = roundText(roundName);
  const m =
    t.match(/round\s*(?:of\s*)?(\d+)/i) ||
    t.match(/(\d+)(?:st|nd|rd|th)?\s*round/i) ||
    t.match(/^r(?:ound)?\s*(\d+)$/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

export function isKnockoutOrBeyond(roundName: string | null | undefined): boolean {
  const t = roundText(roundName);
  if (!t) return false;
  if (
    /round of 16|1\/8|eighth|quarter|semi|final|knockout|play-?off|last\s*16|last\s*8/.test(
      t,
    )
  ) {
    return true;
  }
  const n = extractRoundNumber(roundName);
  // Some feeds label R16 as "Round 16"
  return n != null && n >= 16;
}

export function isLeaguePhase(roundName: string | null | undefined): boolean {
  const t = roundText(roundName);
  return /league phase|league stage|group stage|group\s*[a-h]|matchday/.test(t);
}

export function isQualifyingRound(roundName: string | null | undefined): boolean {
  const t = roundText(roundName);
  return /qualif|preliminary|play-?offs? for|1st qualifying|2nd qualifying|3rd qualifying/.test(
    t,
  );
}

export function shouldIngestFixture(opts: {
  competitionId: string | null | undefined;
  roundName: string | null | undefined;
  homeTeam: string | null | undefined;
  awayTeam: string | null | undefined;
  sport: "football" | "rugby";
}): boolean {
  const { competitionId, roundName, homeTeam, awayTeam, sport } = opts;
  if (!competitionId) return true;

  if (CUP_FROM_R4.has(competitionId)) {
    const n = extractRoundNumber(roundName);
    // Allow named late rounds without numbers (quarter-finals etc.)
    if (isKnockoutOrBeyond(roundName)) return true;
    if (n == null) return false;
    return n >= 4;
  }

  if (UEFA_COMPS.has(competitionId)) {
    if (isQualifyingRound(roundName)) return false;
    if (isKnockoutOrBeyond(roundName)) return true;
    if (isLeaguePhase(roundName)) {
      return fixtureHasPreeminentFootballSide(homeTeam, awayTeam);
    }
    // Unknown round labels: exclude summer noise by default
    return false;
  }

  if (competitionId === HEINEKEN) {
    // Pool Stages through Knockouts — drop pre-season friendlies only.
    const t = roundText(roundName);
    if (/friendly|pre-season/.test(t)) return false;
    return true;
  }

  void sport;
  return true;
}

export function tagPitchsidePick(opts: {
  sport: "football" | "rugby";
  homeTeam: string | null | undefined;
  awayTeam: string | null | undefined;
}): boolean {
  return isPitchsidePickTeam(opts.sport, opts.homeTeam, opts.awayTeam);
}
