/**
 * Default tournament subscriptions from nationality + selected sports.
 */

import type { GolfCoverageTier } from "../constants/golfCoverage";
import { GOLF_LEAGUE_ID_BY_TIER } from "../constants/golfCoverage";

const SH_RUGBY_NATIONS = new Set(["ZA", "NZ", "AU", "AR"]);

/** Map common country names / demonyms → ISO-ish codes used for rugby defaults. */
export const NATION_NAME_TO_ISO: Record<string, string> = {
  "south africa": "ZA",
  "new zealand": "NZ",
  australia: "AU",
  argentina: "AR",
  england: "GB",
  "united kingdom": "GB",
  scotland: "GB",
  wales: "GB",
  ireland: "IE",
  france: "FR",
  italy: "IT",
  spain: "ES",
  germany: "DE",
  "united states": "US",
  usa: "US",
};

export function preferredNationFromLabel(
  nationality: string | null | undefined,
): string | null {
  const raw = (nationality || "").trim();
  if (!raw) return null;
  if (/^[A-Za-z]{2}$/.test(raw)) return raw.toUpperCase();
  return NATION_NAME_TO_ISO[raw.toLowerCase()] ?? null;
}

export function defaultSubscribedLeagues(opts: {
  preferredNation?: string | null;
  selectedSports?: Array<"football" | "rugby" | "golf" | "formula1"> | null;
}): string[] {
  const sports = opts.selectedSports ?? [];
  const hasAny = sports.length > 0;
  const hasFootball = !hasAny || sports.includes("football");
  const hasRugby = !hasAny || sports.includes("rugby");
  const hasGolf = sports.includes("golf");
  const nation = (opts.preferredNation || "").toUpperCase();

  const leagues: string[] = [];
  if (hasFootball) leagues.push("f-epl");
  if (hasRugby) {
    if (SH_RUGBY_NATIONS.has(nation)) {
      leagues.push("r-championship", "r-nations");
    } else {
      leagues.push("r-sixnations");
    }
  }
  if (hasGolf) leagues.push(GOLF_LEAGUE_ID_BY_TIER.MAJORS_ONLY);
  return [...new Set(leagues)];
}

export function defaultGolfCoverageTier(
  selectedSports?: Array<"football" | "rugby" | "golf" | "formula1"> | null,
): GolfCoverageTier {
  if (selectedSports?.includes("golf")) return "MAJORS_ONLY";
  return "MAJORS_ONLY";
}
