import React, { useState } from "react";
import { Share2, Link2, Check } from "lucide-react";
import type { League } from "../../types";

interface InviteButtonProps {
  league: League;
  /** Optional toast hook — falls back to inline badge when omitted. */
  onToast?: (message: string) => void;
  className?: string;
}

function buildShareUrl(leagueId: string): string {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://pitchside.app";
  return `${origin}/join/${leagueId}`;
}

export default function InviteButton({
  league,
  onToast,
  className = "",
}: InviteButtonProps) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleInvite = async () => {
    if (busy) return;
    const shareUrl = buildShareUrl(league.id);
    const payload = {
      title: "Join my PitchSide league",
      text: "Come predict the scores with me on PitchSide!",
      url: shareUrl,
    };

    setBusy(true);
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share(payload);
        return;
      }

      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      onToast?.("Link copied to clipboard!");
      window.setTimeout(() => setCopied(false), 2200);
    } catch (err) {
      // User cancelled the native share sheet — not an error.
      if (err instanceof DOMException && err.name === "AbortError") return;

      try {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        onToast?.("Link copied to clipboard!");
        window.setTimeout(() => setCopied(false), 2200);
      } catch {
        onToast?.("Unable to share — copy the join code instead.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={handleInvite}
        disabled={busy}
        className="inline-flex items-center justify-center gap-2 w-full sm:w-auto text-xs font-mono font-bold uppercase tracking-wider bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/35 text-emerald-300 px-4 py-2.5 rounded-xl cursor-pointer transition-colors disabled:opacity-60"
      >
        {copied ? (
          <>
            <Check className="w-4 h-4" />
            Link copied!
          </>
        ) : (
          <>
            {typeof navigator !== "undefined" && typeof navigator.share === "function" ? (
              <Share2 className="w-4 h-4" />
            ) : (
              <Link2 className="w-4 h-4" />
            )}
            Invite friends
          </>
        )}
      </button>

      {copied && !onToast && (
        <span className="absolute left-1/2 -translate-x-1/2 top-full mt-2 whitespace-nowrap text-[10px] font-mono text-emerald-300 bg-slate-950 border border-emerald-500/30 px-2.5 py-1 rounded-lg shadow-lg">
          Link copied to clipboard!
        </span>
      )}
    </div>
  );
}
