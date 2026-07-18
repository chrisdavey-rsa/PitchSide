import React, { useState } from "react";
import { Share2, Link2, Check } from "lucide-react";
import type { League } from "../../types";
import { dbGetLeaguePassword } from "../../supabase";

interface InviteButtonProps {
  league: League;
  /** Optional toast hook — falls back to inline badge when omitted. */
  onToast?: (message: string) => void;
  className?: string;
}

/** Share URL: `/join/:leagueId?code=<password>` (password fetched via member-only RPC). */
export function buildInviteShareUrl(leagueId: string, password: string): string {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://pitchside.app";
  const url = new URL(`${origin}/join/${encodeURIComponent(leagueId)}`);
  if (password) {
    url.searchParams.set("code", password);
  }
  return url.toString();
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
    setBusy(true);

    try {
      const password = await dbGetLeaguePassword(league.id);
      const shareUrl = buildInviteShareUrl(league.id, password);
      const payload = {
        title: "Join my PitchSide league",
        text: "Come predict the scores with me on PitchSide!",
        url: shareUrl,
      };

      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        try {
          await navigator.share(payload);
          return;
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") return;
          // Fall through to clipboard if share fails for other reasons.
        }
      }

      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      onToast?.("Invite link copied to clipboard!");
      window.setTimeout(() => setCopied(false), 2200);
    } catch (err) {
      console.error("[InviteButton] share failed", err);
      const message = err instanceof Error ? err.message : String(err);
      if (/not a member/i.test(message)) {
        onToast?.("Only league members can create invite links.");
      } else {
        onToast?.("Unable to create invite link. Please try again.");
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
            {busy ? "Preparing link…" : "Invite friends"}
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
