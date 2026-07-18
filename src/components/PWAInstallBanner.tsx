import React, { useCallback, useEffect, useState } from "react";
import { Download, X } from "lucide-react";

const DISMISS_KEY = "pwa-install-banner-dismissed";
const SHOW_DELAY_MS = 3000;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandaloneMode(): boolean {
  if (typeof window === "undefined") return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    nav.standalone === true
  );
}

function isIOSDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isMobileViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 768px)").matches;
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

export default function PWAInstallBanner() {
  const [hydrated, setHydrated] = useState(false);
  const [eligible, setEligible] = useState(false);
  const [visible, setVisible] = useState(false);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const isIOS = isIOSDevice();

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    if (localStorage.getItem(DISMISS_KEY) === "true") return;
    if (isStandaloneMode()) return;
    if (!isMobileViewport()) return;

    setEligible(true);

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const onAppInstalled = () => {
      setDeferredPrompt(null);
      setVisible(false);
      setEligible(false);
      localStorage.setItem(DISMISS_KEY, "true");
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    const timer = window.setTimeout(() => {
      setVisible(true);
    }, SHOW_DELAY_MS);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
      window.clearTimeout(timer);
    };
  }, [hydrated]);

  const dismiss = useCallback(() => {
    setVisible(false);
    localStorage.setItem(DISMISS_KEY, "true");
    setEligible(false);
    setDeferredPrompt(null);
  }, []);

  const handleInstallClick = useCallback(async () => {
    if (isIOS || !deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);

    if (outcome === "accepted") {
      dismiss();
    }
  }, [deferredPrompt, dismiss, isIOS]);

  if (!hydrated || !eligible) return null;

  const canNativeInstall = !isIOS && !!deferredPrompt;

  return (
    <div
      className="md:hidden fixed top-0 inset-x-0 z-[60] px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pointer-events-none"
      role="region"
      aria-label="Install PitchSide app"
      aria-hidden={!visible}
    >
      <div
        className={`relative pointer-events-auto mx-auto max-w-lg rounded-xl border border-slate-700/80 bg-slate-900/95 backdrop-blur-md shadow-2xl shadow-black/40 transition-transform duration-500 ease-out ${
          visible ? "translate-y-0" : "-translate-y-[calc(100%+1rem)]"
        }`}
      >
        <div className="px-4 py-3 pr-10 space-y-3">
          <p className="text-sm font-medium text-slate-100 leading-snug">
            Save PitchSide to your home screen for a better gameplay experience.
          </p>

          {isIOS ? (
            <p className="text-xs text-slate-400 leading-relaxed border-t border-slate-800/80 pt-2.5">
              Tap the Share icon <IOSShareIcon /> in Safari, then select{" "}
              <span className="text-slate-200 font-semibold">Add to Home Screen</span>.
            </p>
          ) : (
            <button
              type="button"
              onClick={handleInstallClick}
              disabled={!canNativeInstall}
              className={`inline-flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                canNativeInstall
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                  : "bg-slate-800 text-slate-500 cursor-not-allowed"
              }`}
            >
              <Download className="w-4 h-4" />
              Install
            </button>
          )}

          {!isIOS && !canNativeInstall && (
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Install will activate when your browser is ready to add PitchSide.
            </p>
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
