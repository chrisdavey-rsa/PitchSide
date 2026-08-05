// ============================================================================
// contact-support — forward Account Portal support messages to admin@pitchside.pro
// ----------------------------------------------------------------------------
// Authenticated users POST { message, subject? }. Appends user_id + email and
// emails admin@pitchside.pro via Resend.
//
// Secrets:
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
//   RESEND_API_KEY, EMAIL_FROM (optional)
// ============================================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "npm:resend@4";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPPORT_TO = "admin@pitchside.pro";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey =
    Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const emailFrom =
    Deno.env.get("EMAIL_FROM") || "PitchSide Support <notifications@pitchside.pro>";

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return jsonResponse({ error: "Missing Supabase env" }, 500);
  }
  if (!resendKey) {
    return jsonResponse({ error: "Missing RESEND_API_KEY" }, 500);
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
  if (message.length > 5000) {
    return jsonResponse({ error: "message too long (max 5000)" }, 400);
  }
  const subject = String(body.subject || "PitchSide Support Request")
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
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: profile } = await admin
    .from("profiles")
    .select("email, username, first_name")
    .eq("id", user.id)
    .maybeSingle();

  const email =
    profile?.email ||
    user.email ||
    "(no email on file)";
  const username = profile?.username || "(unknown)";

  const text = [
    "PitchSide player support request",
    "--------------------------------",
    `user_id: ${user.id}`,
    `email: ${email}`,
    `username: ${username}`,
    `name: ${profile?.first_name || "(none)"}`,
    "",
    "Message:",
    message,
  ].join("\n");

  const html = `
    <div style="font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:14px;color:#111;">
      <h2 style="margin:0 0 12px;">PitchSide Support Request</h2>
      <p><strong>user_id:</strong> ${escapeHtml(user.id)}</p>
      <p><strong>email:</strong> ${escapeHtml(String(email))}</p>
      <p><strong>username:</strong> ${escapeHtml(String(username))}</p>
      <hr style="border:none;border-top:1px solid #ddd;margin:16px 0;" />
      <p style="white-space:pre-wrap;line-height:1.5;">${escapeHtml(message)}</p>
    </div>`;

  const resend = new Resend(resendKey);
  const { error } = await resend.emails.send({
    from: emailFrom,
    to: SUPPORT_TO,
    replyTo: typeof email === "string" && email.includes("@") ? email : undefined,
    subject: `[Support] ${subject}`,
    text,
    html,
  });

  if (error) {
    console.error("[contact-support] Resend error", error);
    return jsonResponse({ error: error.message || "Failed to send support email" }, 502);
  }

  return jsonResponse({ ok: true });
});
