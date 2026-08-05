// ============================================================================
// admin-broadcast — ad-hoc push + email to opted-in users (admin only)
// ----------------------------------------------------------------------------
// Called from the Admin Dashboard with the caller's JWT. Verifies profiles.is_admin,
// then dispatches via Web Push + Resend. All network work is collected into
// Promise arrays and awaited with Promise.all before returning (avoids EarlyDrop).
//
// Secrets:
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
//   RESEND_API_KEY, EMAIL_FROM (optional)
//   VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
//   PUBLIC_SITE_URL (optional — default https://pitchside.pro)
// ============================================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "npm:resend@4";
import webpush from "npm:web-push@3.6.7";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_SITE = "https://pitchside.pro";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function siteOrigin(): string {
  return (
    Deno.env.get("PUBLIC_SITE_URL") ||
    Deno.env.get("APP_ORIGIN") ||
    DEFAULT_SITE
  ).replace(/\/+$/, "");
}

function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err) return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

function broadcastEmailHtml(message: string): string {
  const site = siteOrigin();
  const safe = escapeHtml(message).replace(/\n/g, "<br/>");
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#0B0F19;color:#F3F4F6;font-family:Segoe UI,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0B0F19;padding:28px 14px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;">
        <tr><td align="center" style="padding:0 0 18px;">
          <img src="${escapeHtml(site)}/icon-512.png" alt="PitchSide" width="150"
            style="display:block;margin:0 auto;max-width:150px;width:100%;height:auto;border:0;"/>
        </td></tr>
        <tr><td style="padding:0 4px 16px;">
          <h1 style="margin:0;font-size:20px;color:#F3F4F6;">PitchSide Update</h1>
          <p style="margin:14px 0 0;font-size:15px;line-height:1.55;color:#D1D5DB;">${safe}</p>
        </td></tr>
        <tr><td align="center" style="padding:8px 0 12px;">
          <a href="${escapeHtml(site)}/"
            style="display:inline-block;background:#00FF87;color:#04140C;text-decoration:none;font-weight:800;font-size:13px;letter-spacing:0.04em;text-transform:uppercase;padding:12px 20px;border-radius:10px;">
            Open PitchSide
          </a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

Deno.serve(async (req) => {
  // Preflight must be handled first so browsers are not blocked.
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey =
      Deno.env.get("SUPABASE_ANON_KEY") ||
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const emailFrom =
      Deno.env.get("EMAIL_FROM") || "PitchSide <notifications@pitchside.pro>";
    const vapidSubject = Deno.env.get("VAPID_SUBJECT");
    const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");

    if (!supabaseUrl || !anonKey || !serviceKey) {
      return jsonResponse({ error: "Missing Supabase env" }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Missing Authorization bearer token" }, 401);
    }

    let body: { message?: string; subject?: string };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const message = String(body.message || "").trim();
    if (!message) {
      return jsonResponse({ error: "message is required" }, 400);
    }
    if (message.length > 4000) {
      return jsonResponse({ error: "message too long (max 4000)" }, 400);
    }
    const subject = String(body.subject || "PitchSide Update")
      .trim()
      .slice(0, 120);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser();
    if (userErr || !user) {
      return jsonResponse(
        { error: userErr?.message || "Unauthorized" },
        401,
      );
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("id, is_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (profileErr) {
      return jsonResponse({ error: profileErr.message }, 500);
    }
    if (!profile?.is_admin) {
      return jsonResponse({ error: "Forbidden — admin only" }, 403);
    }

    const { data: recipients, error: recipErr } = await admin
      .from("profiles")
      .select("id, email, push_enabled, email_enabled")
      .or("push_enabled.eq.true,email_enabled.eq.true");

    if (recipErr) {
      return jsonResponse({ error: recipErr.message }, 500);
    }

    const rows = recipients || [];
    const pushUserIds = rows.filter((r) => r.push_enabled).map((r) => r.id);
    const emailTargets = [
      ...new Set(
        rows
          .filter((r) => r.email_enabled && r.email)
          .map((r) => String(r.email).trim().toLowerCase())
          .filter(Boolean),
      ),
    ];

    /** Every outbound network dispatch — awaited via Promise.all before return. */
    const dispatchPromises: Promise<"push-ok" | "push-fail" | "email-ok" | "email-fail">[] =
      [];

    // --- Web Push dispatches ---
    if (pushUserIds.length > 0) {
      if (!vapidSubject || !vapidPublic || !vapidPrivate) {
        return jsonResponse(
          {
            error:
              "Missing VAPID_SUBJECT / VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY",
          },
          500,
        );
      }
      webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

      const { data: subs, error: subErr } = await admin
        .from("push_subscriptions")
        .select("id, user_id, endpoint, p256dh, auth")
        .in("user_id", pushUserIds);

      if (subErr) {
        return jsonResponse({ error: subErr.message }, 500);
      }

      const payload = JSON.stringify({
        title: subject,
        body: message.slice(0, 180),
        url: "/",
      });

      for (const sub of subs || []) {
        dispatchPromises.push(
          (async () => {
            try {
              await webpush.sendNotification(
                {
                  endpoint: sub.endpoint,
                  keys: { p256dh: sub.p256dh, auth: sub.auth },
                },
                payload,
              );
              return "push-ok" as const;
            } catch (err) {
              console.warn("[admin-broadcast] push failed", sub.user_id, err);
              const statusCode = (err as { statusCode?: number })?.statusCode;
              if (statusCode === 404 || statusCode === 410) {
                await admin.from("push_subscriptions").delete().eq("id", sub.id);
              }
              return "push-fail" as const;
            }
          })(),
        );
      }
    }

    // --- Resend email dispatches ---
    if (emailTargets.length > 0) {
      if (!resendKey) {
        return jsonResponse({ error: "Missing RESEND_API_KEY" }, 500);
      }
      const resend = new Resend(resendKey);
      const html = broadcastEmailHtml(message);

      for (const to of emailTargets) {
        dispatchPromises.push(
          (async () => {
            try {
              const { error } = await resend.emails.send({
                from: emailFrom,
                to,
                subject,
                html,
              });
              if (error) {
                console.warn("[admin-broadcast] email failed", to, error);
                return "email-fail" as const;
              }
              return "email-ok" as const;
            } catch (err) {
              console.warn("[admin-broadcast] email exception", to, err);
              return "email-fail" as const;
            }
          })(),
        );
      }
    }

    // Block runtime teardown until every Resend / Web Push request settles.
    const dispatchResults = await Promise.all(dispatchPromises);

    const pushSent = dispatchResults.filter((r) => r === "push-ok").length;
    const pushFailed = dispatchResults.filter((r) => r === "push-fail").length;
    const emailSent = dispatchResults.filter((r) => r === "email-ok").length;
    const emailFailed = dispatchResults.filter((r) => r === "email-fail").length;

    return jsonResponse({
      ok: true,
      adminId: user.id,
      recipientsConsidered: rows.length,
      push: {
        candidates: pushUserIds.length,
        sent: pushSent,
        failed: pushFailed,
      },
      email: {
        candidates: emailTargets.length,
        sent: emailSent,
        failed: emailFailed,
      },
    });
  } catch (error) {
    const message = errorMessage(error);
    console.error("[admin-broadcast] unhandled error:", message, error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
