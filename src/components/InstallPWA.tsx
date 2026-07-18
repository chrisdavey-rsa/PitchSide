import React, { useCallback, useEffect, useState } from "react";
import { Download, X } from "lucide-react";

const DISMISS_KEY = "pwa_banner_dismissed";
/** Migrate away from the older dismiss key used by PWAInstallBanner. */
const LEGACY_DISMISS_KEY = "pwa-install-banner-dismissed";
const IOS_SHOW_DELAY_MS = 2000;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** True for iPhone / iPod / iPad (incl. iPadOS desktop-UA mode). */
export function isIOSDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isStandaloneMode(): boolean {
  if (typeof window === "undefined") return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    nav.standalone === true
  );
}

function wasDismissed(): boolean {
  if (typeof localStorage === "undefined") return false;
  return (
    localStorage.getItem(DISMISS_KEY) === "true" ||
    localStorage.getItem(LEGACY_DISMISS_KEY) === "true"
  );
}

function IOSShareIcon() {
  return (
    <svg
      className="inline-block w-4 h-4 mx-0.5 align-text-bottom text-blue-400"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 3v12" />
      <path d="m7 8 5-5 5 5" />
      <rect x="4" y="11" width="16" height="10" rx="2" />
    </svg>
  );
}

/**
 * Unified install prompt for iOS (manual Add to Home Screen) and
 * Android / Chromium desktop (`beforeinstallprompt` + Install button).
 */
export default function InstallPWA() {
  const [hydrated, setHydrated] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [iosVisible, setIosVisible] = useState(false);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  const ios = typeof navigator !== "undefined" ? isIOSDevice() : false;

  useEffect(() => {
    setHydrated(true);
    setDismissed(wasDismissed());
  }, []);

  useEffect(() => {
    if (!hydrated || dismissed) return;
    if (isStandaloneMode()) {
      setDismissed(true);
      return;
    }

    // iOS: no beforeinstallprompt — show instructions after a short delay.
    if (ios) {
      const timer = window.setTimeout(() => setIosVisible(true), IOS_SHOW_DELAY_MS);
      return () => window.clearTimeout(timer);
    }

    // Android / Desktop Chromium: stay null until the browser offers install.
    // Listen immediately (event can fire once SW is ready / after engagement).
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const onAppInstalled = () => {
      setDeferredPrompt(null);
      localStorage.setItem(DISMISS_KEY, "true");
      setDismissed(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    // Nudge SW readiness — Chrome often gates installability on an active worker.
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.ready.catch(() => undefined);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, [hydrated, dismissed, ios]);

  const dismiss = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, "true");
    setDismissed(true);
    setDeferredPrompt(null);
    setIosVisible(false);
  }, []);

  const handleInstallClick = useCallback(async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);

    if (outcome === "accepted") {
      localStorage.setItem(DISMISS_KEY, "true");
      setDismissed(true);
    }
  }, [deferredPrompt]);

  if (!hydrated || dismissed || isStandaloneMode()) return null;

  // Android / Desktop: render nothing until beforeinstallprompt fires.
  if (!ios && !deferredPrompt) return null;

  // iOS: wait for the 2s delay.
  if (ios && !iosVisible) return null;

  return (
    <div
      className="fixed top-0 inset-x-0 z-[60] px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pointer-events-none"
      role="region"
      aria-label="Install PitchSide app"
    >
      <div className="relative pointer-events-auto mx-auto max-w-lg rounded-xl border border-slate-700/80 bg-slate-900/95 backdrop-blur-md shadow-2xl shadow-black/40">
        <div className="px-4 py-3 pr-10 space-y-3">
          <p className="text-sm font-medium text-slate-100 leading-snug">
            Save PitchSide to your home screen for a better gameplay experience.
          </p>

          {ios ? (
            <p className="text-xs text-slate-400 leading-relaxed border-t border-slate-800/80 pt-2.5">
              Tap the Share icon <IOSShareIcon /> (square with up arrow) and select{" "}
              <span className="text-slate-200 font-semibold">Add to Home Screen</span>.
            </p>
          ) : (
            <button
              type="button"
              onClick={handleInstallClick}
              className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2.5 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer transition-colors"
            >
              <Download className="w-4 h-4" />
              Install
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={dismiss}
          className="absolute top-2.5 right-2.5 p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800/80 transition-colors cursor-pointer"
          aria-label="Dismiss install banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
