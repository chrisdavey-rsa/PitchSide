import React, { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

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
  const [iosExpanded, setIosExpanded] = useState(false);
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);

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
      deferredPromptRef.current = event as BeforeInstallPromptEvent;
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);

    const timer = window.setTimeout(() => {
      setVisible(true);
    }, SHOW_DELAY_MS);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.clearTimeout(timer);
    };
  }, [hydrated]);

  const dismiss = useCallback(() => {
    setVisible(false);
    setIosExpanded(false);
    localStorage.setItem(DISMISS_KEY, "true");
    setEligible(false);
  }, []);

  const handleBannerClick = useCallback(async () => {
    if (isIOSDevice()) {
      setIosExpanded((prev) => !prev);
      return;
    }

    const promptEvent = deferredPromptRef.current;
    if (!promptEvent) return;

    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    deferredPromptRef.current = null;

    if (outcome === "accepted") {
      dismiss();
    }
  }, [dismiss]);

  if (!hydrated || !eligible) return null;

  const isActive = visible;

  return (
    <div
      className="md:hidden fixed top-0 inset-x-0 z-[60] px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pointer-events-none"
      role="region"
      aria-label="Install PitchSide app"
      aria-hidden={!isActive}
    >
      <div
        className={`relative pointer-events-auto mx-auto max-w-lg rounded-xl border border-slate-700/80 bg-slate-900/95 backdrop-blur-md shadow-2xl shadow-black/40 transition-transform duration-500 ease-out ${
          isActive ? "translate-y-0" : "-translate-y-[calc(100%+1rem)]"
        }`}
      >
        <button
          type="button"
          onClick={handleBannerClick}
          className="w-full text-left px-4 py-3 pr-10"
        >
          <p className="text-sm font-medium text-slate-100 leading-snug">
            Save to home screen for a better gameplay experience.
          </p>

          {iosExpanded && isIOSDevice() && (
            <p className="mt-2 text-xs text-slate-400 leading-relaxed border-t border-slate-800/80 pt-2">
              Tap the Share icon <IOSShareIcon /> below, then select{" "}
              <span className="text-slate-200 font-semibold">Add to Home Screen</span>.
            </p>
          )}
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            dismiss();
          }}
          className="absolute top-2.5 right-2.5 p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800/80 transition-colors"
          aria-label="Dismiss install banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
