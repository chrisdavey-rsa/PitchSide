import React, { useMemo, useState } from "react";
import { UserProfile } from "../../types";
import { dbUpdateTournamentSubscriptions } from "../../supabase";
import { defaultSubscribedLeagues } from "../../utils/userOnboardingDefaults";
import type { GolfCoverageTier } from "../../constants/golfCoverage";
import TournamentListManager from "../Dashboard/TournamentListManager";

type Props = {
  user: UserProfile;
  onUpdateUser: (updated: UserProfile) => void;
  setStatusMsg: (msg: { text: string; mode: "success" | "error" | "none" }) => void;
};

/**
 * Account Portal — manage subscribed football/rugby tournaments.
 */
export const LeaguesAndCompetitions: React.FC<Props> = ({
  user,
  onUpdateUser,
  setStatusMsg,
}) => {
  const [saving, setSaving] = useState(false);

  const subscribedLeagues = useMemo(() => {
    if (user.subscribedLeagues && user.subscribedLeagues.length > 0) {
      return user.subscribedLeagues;
    }
    return defaultSubscribedLeagues({
      preferredNation: user.preferredNation,
      selectedSports: user.selectedSports,
    });
  }, [user.subscribedLeagues, user.preferredNation, user.selectedSports]);

  const golfTier: GolfCoverageTier = user.golfCoverageTier || "MAJORS_ONLY";

  const toggle = async (id: string) => {
    if (id.startsWith("g-") || id.startsWith("f1-") || saving) return;

    const nextCore = subscribedLeagues.filter(
      (x) => !x.startsWith("g-") && !x.startsWith("f1-"),
    );
    const golfId = subscribedLeagues.find((x) => x.startsWith("g-"));
    const has = nextCore.includes(id);
    const core = has ? nextCore.filter((x) => x !== id) : [...nextCore, id];
    // Keep at least one tournament if possible — allow empty and show empty feed.
    const next = golfId ? [...core, golfId] : core;

    setSaving(true);
    setStatusMsg({ text: "", mode: "none" });
    try {
      await dbUpdateTournamentSubscriptions(user.id, {
        subscribedLeagues: next,
        golfCoverageTier: golfTier,
      });
      const updated: UserProfile = {
        ...user,
        subscribedLeagues: next,
        golfCoverageTier: golfTier,
      };
      onUpdateUser(updated);
      try {
        localStorage.setItem("pitchside_logged_in", JSON.stringify(updated));
      } catch {
        /* ignore */
      }
      setStatusMsg({
        text: has
          ? "Tournament removed from your feed."
          : "Tournament added to your feed.",
        mode: "success",
      });
    } catch (err) {
      setStatusMsg({
        text: err instanceof Error ? err.message : "Could not update subscriptions.",
        mode: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-400 font-sans leading-relaxed">
        Choose which leagues and competitions appear in your Predictions feed.
        Golf and Formula 1 are coming soon.
      </p>
      <TournamentListManager
        mode="manage"
        subscribedLeagues={subscribedLeagues}
        selectedIds={subscribedLeagues}
        onToggle={(id) => void toggle(id)}
        golfCoverageTier={golfTier}
      />
      {saving ? (
        <p className="text-[10px] font-mono text-slate-500">Saving…</p>
      ) : null}
    </div>
  );
};
