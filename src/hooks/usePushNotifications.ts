/**
 * Web Push subscription helpers for PitchSide.
 * Requires VITE_VAPID_PUBLIC_KEY and an active /sw.js registration.
 * Syncs profiles.push_enabled when enabling / disabling.
 */

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabase";

export type PushPermissionState =
  | "unsupported"
  | "default"
  | "denied"
  | "granted"
  | "subscribed"
  | "error";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

function vapidPublicKey(): string | null {
  const meta = (import.meta as { env?: Record<string, string | undefined> }).env;
  const key = meta?.VITE_VAPID_PUBLIC_KEY?.trim();
  return key || null;
}

async function ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return null;
  }
  try {
    const existing = await navigator.serviceWorker.getRegistration("/");
    if (existing) return existing;
    return await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });
  } catch {
    return null;
  }
}

async function persistSubscription(sub: PushSubscription): Promise<void> {
  if (!supabase) throw new Error("Database not connected.");
  const json = sub.toJSON();
  const endpoint = json.endpoint;
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    throw new Error("Incomplete PushSubscription keys.");
  }

  const { error } = await supabase.rpc("upsert_push_subscription", {
    p_endpoint: endpoint,
    p_p256dh: p256dh,
    p_auth: auth,
  });
  if (error) throw error;
}

async function setPushEnabledFlag(
  userId: string | null | undefined,
  enabled: boolean,
): Promise<void> {
  if (!supabase || !userId) return;
  const { error } = await supabase
    .from("profiles")
    .update({ push_enabled: enabled })
    .eq("id", userId);
  if (error) throw error;
}

export async function subscribeToPushNotifications(
  userId?: string | null,
): Promise<PushSubscription> {
  const key = vapidPublicKey();
  if (!key) {
    throw new Error("Missing VITE_VAPID_PUBLIC_KEY.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notification permission was not granted.");
  }

  const registration = await ensureServiceWorker();
  if (!registration) {
    throw new Error("Service worker unavailable.");
  }

  await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
    });
  }

  await persistSubscription(subscription);
  await setPushEnabledFlag(userId, true);
  return subscription;
}

export async function unsubscribeFromPushNotifications(
  userId?: string | null,
): Promise<void> {
  const registration = await ensureServiceWorker();
  if (registration) {
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      if (supabase && endpoint) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
      }
    }
  }

  // Also clear any remaining rows for this user.
  if (supabase && userId) {
    await supabase.from("push_subscriptions").delete().eq("user_id", userId);
  }
  await setPushEnabledFlag(userId, false);
}

export function usePushNotifications(
  userId?: string | null,
  /** Server preference — drives the toggle even before browser sub is ready. */
  pushEnabledPref?: boolean,
) {
  const [state, setState] = useState<PushPermissionState>("default");
  const [enabled, setEnabled] = useState(!!pushEnabledPref);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEnabled(!!pushEnabledPref);
  }, [pushEnabledPref]);

  const refresh = useCallback(async () => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    if (Notification.permission === "default") {
      setState("default");
      return;
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? "subscribed" : "granted");
    } catch {
      setState(Notification.permission === "granted" ? "granted" : "default");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, userId]);

  const enable = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await subscribeToPushNotifications(userId);
      setEnabled(true);
      setState("subscribed");
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setState(
        typeof Notification !== "undefined" &&
          Notification.permission === "denied"
          ? "denied"
          : "error",
      );
      return false;
    } finally {
      setBusy(false);
      void refresh();
    }
  }, [refresh, userId]);

  const disable = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await unsubscribeFromPushNotifications(userId);
      setEnabled(false);
      setState(
        typeof Notification !== "undefined" &&
          Notification.permission === "granted"
          ? "granted"
          : "default",
      );
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState("error");
      return false;
    } finally {
      setBusy(false);
      void refresh();
    }
  }, [refresh, userId]);

  return {
    state,
    enabled: enabled || state === "subscribed",
    busy,
    error,
    enable,
    disable,
    refresh,
  };
}
