// ============================================================================
// notify-24h-unpicked — Web Push for fixtures ~24h away with no prediction
// ----------------------------------------------------------------------------
// Invoked hourly by pg_cron. Finds upcoming matches whose kickoff is between
// 23.5h and 24.5h from now, finds users with a push subscription who have NOT
// submitted a prediction, and sends a Web Push payload.
//
// Secrets (Deno.env):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto)
//   VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
// ============================================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

type MatchRow = {
  id: string;
  home_team: string | null;
  away_team: string | null;
  kickoff_time: string;
};

type SubRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const vapidSubject = Deno.env.get("VAPID_SUBJECT");
  const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");

  if (!supabaseUrl || !serviceKey) {
    return jsonResponse({ error: "Missing Supabase env" }, 500);
  }
  if (!vapidSubject || !vapidPublic || !vapidPrivate) {
    return jsonResponse(
      { error: "Missing VAPID_SUBJECT / VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY" },
      500,
    );
  }

  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const now = Date.now();
  const windowStart = new Date(now + 23.5 * 60 * 60 * 1000).toISOString();
  const windowEnd = new Date(now + 24.5 * 60 * 60 * 1000).toISOString();

  const { data: matches, error: matchErr } = await supabase
    .from("matches")
    .select("id, home_team, away_team, kickoff_time")
    .eq("status", "upcoming")
    .gte("kickoff_time", windowStart)
    .lte("kickoff_time", windowEnd)
    .or("is_visible.is.null,is_visible.eq.true");

  if (matchErr) {
    return jsonResponse({ error: matchErr.message }, 500);
  }

  const fixtures = (matches || []) as MatchRow[];
  if (fixtures.length === 0) {
    return jsonResponse({
      ok: true,
      windowStart,
      windowEnd,
      matches: 0,
      sent: 0,
      skipped: 0,
    });
  }

  const matchIds = fixtures.map((m) => m.id);

  const { data: preds, error: predErr } = await supabase
    .from("predictions")
    .select("user_id, match_id")
    .in("match_id", matchIds)
    .eq("submitted", true);

  if (predErr) {
    return jsonResponse({ error: predErr.message }, 500);
  }

  const picked = new Set(
    (preds || []).map((p) => `${p.user_id}:${p.match_id}`),
  );

  const { data: subs, error: subErr } = await supabase
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth");

  if (subErr) {
    return jsonResponse({ error: subErr.message }, 500);
  }

  const allSubs = (subs || []) as SubRow[];
  const userIds = [...new Set(allSubs.map((s) => s.user_id))];

  let enabledUserIds = new Set<string>();
  if (userIds.length > 0) {
    const { data: enabledProfiles, error: enabledErr } = await supabase
      .from("profiles")
      .select("id")
      .in("id", userIds)
      .eq("push_enabled", true);
    if (enabledErr) {
      return jsonResponse({ error: enabledErr.message }, 500);
    }
    enabledUserIds = new Set((enabledProfiles || []).map((p) => String(p.id)));
  }

  const subscriptions = allSubs.filter((s) => enabledUserIds.has(s.user_id));
  if (subscriptions.length === 0) {
    return jsonResponse({
      ok: true,
      windowStart,
      windowEnd,
      matches: fixtures.length,
      sent: 0,
      skipped: 0,
      reason: "no_enabled_subscriptions",
    });
  }

  const { data: alreadySent } = await supabase
    .from("push_notification_log")
    .select("user_id, match_id")
    .eq("kind", "unpicked_24h")
    .in("match_id", matchIds);

  const sentSet = new Set(
    (alreadySent || []).map((r) => `${r.user_id}:${r.match_id}`),
  );

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const match of fixtures) {
    const home = match.home_team || "Home";
    const away = match.away_team || "Away";
    const title = "Match approaching";
    const body =
      `${home} vs ${away}. Lock in your prediction!`;

    for (const sub of subscriptions) {
      const key = `${sub.user_id}:${match.id}`;
      if (picked.has(key) || sentSet.has(key)) {
        skipped += 1;
        continue;
      }

      const payload = JSON.stringify({
        title,
        body,
        data: {
          url: "/?tab=predictions",
          matchId: match.id,
        },
      });

      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload,
        );

        const { error: logErr } = await supabase
          .from("push_notification_log")
          .upsert(
            {
              user_id: sub.user_id,
              match_id: match.id,
              kind: "unpicked_24h",
            },
            { onConflict: "user_id,match_id,kind", ignoreDuplicates: true },
          );
        if (logErr) {
          errors.push(`log:${logErr.message}`);
        }

        sentSet.add(key);
        sent += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        // Gone / expired subscription — drop it.
        if (/410|404|expired|unsubscribed/i.test(message)) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("id", sub.id);
        }
        errors.push(`${sub.user_id}:${match.id}:${message}`);
      }
    }
  }

  return jsonResponse({
    ok: true,
    windowStart,
    windowEnd,
    matches: fixtures.length,
    sent,
    skipped,
    errors: errors.slice(0, 20),
  });
});
