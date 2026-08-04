// ============================================================================
// weekly-fixture-email — tailored Monday digest (max 5 high-value fixtures)
// ----------------------------------------------------------------------------
// Invoked weekly by pg_cron (Monday 08:00 UTC). For each user with
// email_enabled = true, filters fixtures with the same cup/UEFA rules as the
// app feed, sorts favorite_teams first, caps at 5, then sends HTML via Resend.
//
// Secrets (Deno.env):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto)
//   RESEND_API_KEY
//   EMAIL_FROM (optional — default PitchSide <notifications@pitchside.pro>)
//   PUBLIC_SITE_URL (CTA + logo host — default https://pitchside.pro)
// ============================================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "npm:resend@4";
import {
  extractRoundNumber,
  isKnockoutOrBeyond,
  isLeaguePhase,
  isQualifyingRound,
  shouldIngestFixture,
} from "../_shared/fixtureIngestion.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BG = "#0B0F19";
const CARD = "#111827";
const TEXT = "#F3F4F6";
const MUTED = "#9CA3AF";
const NEON = "#00FF87";
const DEFAULT_SITE = "https://pitchside.pro";
const LOGO_PATH = "/icon-512.png";
const MAX_DIGEST_MATCHES = 5;

/** Domestic cups: exclude rounds before Round 3 (digest high-value cut). */
const CUP_FROM_R3 = new Set(["f-facup", "f-eflcup"]);
const UEFA_COMPS = new Set(["f-ucl", "f-uel"]);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

type MatchRow = {
  id: string;
  competition_id: string | null;
  home_team: string | null;
  away_team: string | null;
  kickoff_time: string;
  competition_name: string | null;
  round_name: string | null;
  sport: string | null;
};

type ProfileRow = {
  id: string;
  email: string | null;
  username: string | null;
  first_name: string | null;
  favorite_teams: string[] | null;
  supported_team: string | null;
  email_enabled: boolean | null;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeTeam(name: string | null | undefined): string {
  return String(name || "")
    .trim()
    .toLowerCase();
}

function featuresFavorite(match: MatchRow, favorites: Set<string>): boolean {
  if (favorites.size === 0) return false;
  return (
    favorites.has(normalizeTeam(match.home_team)) ||
    favorites.has(normalizeTeam(match.away_team))
  );
}

/**
 * High-value digest filter:
 * - UEFA UCL/UEL: drop qualifying; keep League Phase / Knockouts (same as feed).
 * - FA Cup / EFL Cup: Round 3+ (or named late knockouts).
 * - Everything else: shared shouldIngestFixture rules.
 */
export function isDigestEligibleFixture(match: MatchRow): boolean {
  const competitionId = match.competition_id;
  const roundName = match.round_name;

  if (competitionId && CUP_FROM_R3.has(competitionId)) {
    if (isKnockoutOrBeyond(roundName)) return true;
    const n = extractRoundNumber(roundName);
    if (n == null) return false;
    return n >= 3;
  }

  if (competitionId && UEFA_COMPS.has(competitionId)) {
    if (isQualifyingRound(roundName)) return false;
    if (isKnockoutOrBeyond(roundName)) return true;
    if (isLeaguePhase(roundName)) {
      return shouldIngestFixture({
        competitionId,
        roundName,
        homeTeam: match.home_team,
        awayTeam: match.away_team,
      });
    }
    return false;
  }

  return shouldIngestFixture({
    competitionId,
    roundName,
    homeTeam: match.home_team,
    awayTeam: match.away_team,
  });
}

function sortMatchesForUser(
  matches: MatchRow[],
  favorites: Set<string>,
): MatchRow[] {
  return [...matches].sort((a, b) => {
    const aFav = featuresFavorite(a, favorites) ? 0 : 1;
    const bFav = featuresFavorite(b, favorites) ? 0 : 1;
    if (aFav !== bFav) return aFav - bFav;
    return (
      new Date(a.kickoff_time).getTime() - new Date(b.kickoff_time).getTime()
    );
  });
}

function formatKickoff(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
      timeZoneName: "short",
    });
  } catch {
    return iso;
  }
}

function siteOrigin(): string {
  const raw =
    Deno.env.get("PUBLIC_SITE_URL") ||
    Deno.env.get("APP_ORIGIN") ||
    DEFAULT_SITE;
  return raw.replace(/\/+$/, "");
}

function logoUrl(origin: string): string {
  return `${origin}${LOGO_PATH}`;
}

/** Responsive, inline-styled digest matching PitchSide dark mode. */
export function generateEmailHtml(
  matches: MatchRow[],
  favoriteTeams: string[],
  opts?: { displayName?: string; siteUrl?: string },
): string {
  const favorites = new Set(
    favoriteTeams.map(normalizeTeam).filter(Boolean),
  );
  const displayName = opts?.displayName || "Predictor";
  const siteUrl = (opts?.siteUrl || DEFAULT_SITE).replace(/\/+$/, "");
  const predictionsUrl = `${siteUrl}/`;
  const logoSrc = logoUrl(siteUrl);

  const cards = matches
    .map((m) => {
      const pinned = featuresFavorite(m, favorites);
      const border = pinned ? NEON : "#1F2937";
      const badge = pinned
        ? `<span style="display:inline-block;margin-left:8px;padding:2px 8px;border-radius:999px;background:rgba(0,255,135,0.12);color:${NEON};font-size:10px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;">Favorites</span>`
        : "";
      return `
      <tr>
        <td style="padding:0 0 12px 0;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${CARD};border:1px solid ${border};border-radius:14px;">
            <tr>
              <td style="padding:16px 18px;">
                <div style="font-size:11px;color:${MUTED};text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">
                  ${escapeHtml(m.competition_name || m.sport || "Fixture")}${badge}
                </div>
                <div style="margin-top:8px;font-size:17px;font-weight:700;color:${TEXT};line-height:1.35;">
                  ${escapeHtml(m.home_team || "Home")}
                  <span style="color:${MUTED};font-weight:600;"> vs </span>
                  ${escapeHtml(m.away_team || "Away")}
                </div>
                <div style="margin-top:8px;font-size:12px;color:${MUTED};font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">
                  ${escapeHtml(formatKickoff(m.kickoff_time))}
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>`;
    })
    .join("");

  const empty = `
    <tr>
      <td style="padding:20px;border:1px dashed #1F2937;border-radius:14px;color:${MUTED};font-size:14px;text-align:center;">
        No upcoming fixtures this week.
      </td>
    </tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Your Weekly Fixtures</title>
</head>
<body style="margin:0;padding:0;background:${BG};color:${TEXT};font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${BG};padding:28px 14px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;width:100%;">
          <tr>
            <td align="center" style="padding:8px 0 20px;">
              <img
                src="${escapeHtml(logoSrc)}"
                alt="PitchSide"
                width="150"
                style="display:block;margin:0 auto;max-width:150px;width:100%;height:auto;border:0;outline:none;text-decoration:none;"
              />
            </td>
          </tr>
          <tr>
            <td style="padding:0 4px 18px;">
              <h1 style="margin:0;font-size:22px;line-height:1.3;font-weight:700;color:${TEXT};">
                Hi ${escapeHtml(displayName)}
              </h1>
              <p style="margin:10px 0 0;font-size:15px;line-height:1.55;color:${MUTED};">
                Here are your upcoming fixtures for the week.
              </p>
            </td>
          </tr>
          <tr>
            <td>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                ${cards || empty}
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:8px 0 22px;">
              <a href="${escapeHtml(predictionsUrl)}"
                 style="display:inline-block;background:${NEON};color:#04140C;text-decoration:none;font-weight:800;font-size:13px;letter-spacing:0.04em;text-transform:uppercase;padding:12px 20px;border-radius:10px;">
                Open Predictions
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 8px 0;border-top:1px solid #1F2937;">
              <p style="margin:14px 0 0;font-size:11px;line-height:1.5;color:#6B7280;text-align:center;">
                You are receiving this because you opted into weekly emails. Manage your preferences in the PitchSide Account Portal.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const emailFrom =
    Deno.env.get("EMAIL_FROM") || "PitchSide <notifications@pitchside.pro>";
  const publicSiteUrl = siteOrigin();

  if (!supabaseUrl || !serviceKey) {
    return jsonResponse({ error: "Missing Supabase env" }, 500);
  }
  if (!resendKey) {
    return jsonResponse({ error: "Missing RESEND_API_KEY" }, 500);
  }

  const resend = new Resend(resendKey);
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const now = Date.now();
  const weekEnd = new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();
  const nowIso = new Date(now).toISOString();

  const { data: matches, error: matchErr } = await supabase
    .from("matches")
    .select(
      "id, competition_id, home_team, away_team, kickoff_time, competition_name, round_name, sport",
    )
    .eq("status", "upcoming")
    .gte("kickoff_time", nowIso)
    .lte("kickoff_time", weekEnd)
    .or("is_visible.is.null,is_visible.eq.true")
    .order("kickoff_time", { ascending: true });

  if (matchErr) {
    return jsonResponse({ error: matchErr.message }, 500);
  }

  const rawFixtures = (matches || []) as MatchRow[];
  const curatedFixtures = rawFixtures.filter(isDigestEligibleFixture);

  const { data: profiles, error: profileErr } = await supabase
    .from("profiles")
    .select(
      "id, email, username, first_name, favorite_teams, supported_team, email_enabled",
    )
    .eq("email_enabled", true)
    .not("email", "is", null);

  if (profileErr) {
    return jsonResponse({ error: profileErr.message }, 500);
  }

  const users = ((profiles || []) as ProfileRow[]).filter(
    (p) => p.email && p.email.includes("@"),
  );

  let sent = 0;
  const errors: string[] = [];

  for (const user of users) {
    const favorites = [
      ...(user.favorite_teams || []),
      ...(user.supported_team ? [user.supported_team] : []),
    ];
    const favoriteLookup = new Set(
      favorites.map(normalizeTeam).filter(Boolean),
    );
    const sorted = sortMatchesForUser(curatedFixtures, favoriteLookup);
    const limitedMatches = sorted.slice(0, MAX_DIGEST_MATCHES);

    const displayName =
      (user.first_name && user.first_name.trim()) ||
      (user.username && user.username.trim()) ||
      "Predictor";

    const emailHtml = generateEmailHtml(limitedMatches, favorites, {
      displayName,
      siteUrl: publicSiteUrl,
    });

    try {
      const { error } = await resend.emails.send({
        from: emailFrom,
        to: user.email!,
        subject: "Your Weekly Fixtures",
        html: emailHtml,
      });
      if (error) {
        errors.push(`${user.id}:${error.message || String(error)}`);
      } else {
        sent += 1;
      }
    } catch (err) {
      errors.push(
        `${user.id}:${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return jsonResponse({
    ok: true,
    fixturesRaw: rawFixtures.length,
    fixturesCurated: curatedFixtures.length,
    fixturesPerEmail: MAX_DIGEST_MATCHES,
    recipients: users.length,
    sent,
    siteUrl: publicSiteUrl,
    errors: errors.slice(0, 20),
  });
});
