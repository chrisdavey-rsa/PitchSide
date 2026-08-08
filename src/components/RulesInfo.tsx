/**
 * PitchSide Player Guide — sport-scoped rules + dedicated Chips section.
 * Mobile: sticky horizontal tabs. Desktop: left sidebar + content pane.
 */

import React, { useMemo, useState } from "react";
import { AnimatePresence } from "motion/react";
import {
  Award,
  Info,
  Shield,
  X,
  LifeBuoy,
  Ghost,
  Ticket,
  Sparkles,
  Users,
  Lock,
  ChevronRight,
  BookOpen,
  Target,
  Zap,
  Trophy,
  Star,
} from "lucide-react";
import { UserProfile } from "../types";
import { useCommunityShieldScheduled } from "./events/CommunityShieldEvent";
import { CHIPS } from "../constants/chips";
import ChipModal from "./chips/ChipModal";
import HowToPredictStepper from "./predictions/HowToPredictStepper";
import { btnClose } from "../ui";
import { retainOverlayHistoryDuringTransition } from "../hooks/useOverlayHistory";

type RulesSport = "football" | "rugby" | "formula1" | "golf";
type RulesNavId = RulesSport | "chips" | "golden_ticket";

type NavItem = {
  id: RulesNavId;
  label: string;
  short: string;
  accent: string;
  activeAccent: string;
  adminOnly?: boolean;
};

const SPORT_NAV: NavItem[] = [
  {
    id: "football",
    label: "Football",
    short: "FT",
    accent: "text-blue-300 border-blue-500/30",
    activeAccent: "bg-blue-500/15 text-blue-100 border-blue-500/40",
  },
  {
    id: "rugby",
    label: "Rugby",
    short: "RU",
    accent: "text-amber-300 border-amber-500/30",
    activeAccent: "bg-amber-500/15 text-amber-100 border-amber-500/40",
  },
  {
    id: "formula1",
    label: "Formula 1",
    short: "F1",
    accent: "text-red-300 border-red-500/30",
    activeAccent: "bg-red-500/15 text-red-100 border-red-500/40",
    adminOnly: true,
  },
  {
    id: "golf",
    label: "Golf",
    short: "GF",
    accent: "text-emerald-300 border-emerald-500/30",
    activeAccent: "bg-emerald-500/15 text-emerald-100 border-emerald-500/40",
    adminOnly: true,
  },
];

const CHIPS_NAV: NavItem = {
  id: "chips",
  label: "Chips",
  short: "CH",
  accent: "text-violet-300 border-violet-500/30",
  activeAccent: "bg-violet-500/15 text-violet-100 border-violet-500/40",
};

const GOLDEN_TICKET_NAV: NavItem = {
  id: "golden_ticket",
  label: "Golden Ticket",
  short: "GT",
  accent: "text-yellow-300 border-yellow-500/30",
  activeAccent: "bg-yellow-500/15 text-yellow-100 border-yellow-500/40",
};

const EXTRA_NAV_IDS: RulesNavId[] = ["chips", "golden_ticket"];

interface RulesInfoProps {
  user?: UserProfile | null;
  onClose?: () => void;
}

function SectionHeading({
  icon: Icon,
  title,
  barClass,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  barClass: string;
}) {
  return (
    <h3 className="text-lg font-bold font-display text-white mb-3 flex items-center gap-2">
      <span className={`w-1.5 h-5 rounded-full ${barClass}`} />
      <Icon className="w-4.5 h-4.5 text-slate-400" />
      {title}
    </h3>
  );
}

/** Shared cup ingestion + PitchSide Picks copy (no named clubs/nations). */
function CupCompetitionsAndPicksSection({ accentBar }: { accentBar: string }) {
  return (
    <>
      <section>
        <SectionHeading icon={Trophy} title="Cup Competitions" barClass={accentBar} />
        <div className="p-4 bg-slate-950/40 rounded-xl border border-slate-800 text-xs text-slate-300 leading-relaxed space-y-3">
          <p>
            To keep matchups high quality, domestic cups (FA Cup, EFL Cup) only become available for
            prediction from Round 4 onwards.
          </p>
          <p>
            European competitions (UEFA Champions League, UEFA Europa League) and the Rugby Champions
            Cup become available from the League / Pool phases.
          </p>
          <p>
            During the early League phases, fixtures are curated to feature top-tier matchups. All
            remaining fixtures become available once the knockout stages begin.
          </p>
        </div>
      </section>

      <section>
        <SectionHeading icon={Star} title="PitchSide Picks" barClass="bg-violet-400" />
        <div className="p-4 bg-slate-950/40 rounded-xl border border-slate-800 text-xs text-slate-300 leading-relaxed space-y-3">
          <p>
            PitchSide Picks are curated, marquee fixtures highlighted across the platform — the most
            highly anticipated matches of the week.
          </p>
          <p>
            These games are automatically tagged so you can quickly find and predict the biggest
            fixtures without digging through the full schedule.
          </p>
        </div>
      </section>
    </>
  );
}

function FootballContent({
  communityShieldScheduled,
}: {
  communityShieldScheduled: boolean;
}) {
  return (
    <div className="space-y-8">
      <HowToPredictStepper sport="football" />

      <section>
        <SectionHeading icon={BookOpen} title="How to Play" barClass="bg-blue-400" />
        <div className="p-4 bg-slate-950/40 rounded-xl border border-slate-800 text-xs text-slate-300 leading-relaxed space-y-3">
          <p>
            You are automatically entered into the Global Leaderboard so you can start playing
            immediately. Want to compete directly with friends? Create or join a Private League from
            the navigation menu.
          </p>
          <p>
            Lock scoreline predictions before kick-off. Points are awarded automatically once a match
            is settled - the closer your call, the more you score.
          </p>
        </div>
      </section>

      <section>
        <SectionHeading icon={Target} title="Points System" barClass="bg-yellow-400" />
        <div className="p-5 bg-slate-950/40 rounded-xl border border-blue-900/30 space-y-3.5">
          <p className="text-sm text-slate-300 font-sans leading-relaxed">
            Football rewards accuracy - from nailing a Perfect Prediction down to calling the right
            winner:
          </p>
          {[
            {
              pts: "5 pts",
              tone: "bg-emerald-500/20 text-emerald-400",
              title: "Perfect Prediction",
              body: "Guessing the exact final scoreline. E.g., predicted 2-0 when result is 2-0.",
            },
            {
              pts: "3 pts",
              tone: "bg-blue-500/20 text-blue-400",
              title: "Correct Outcome + Goal Margin",
              body: "Correct result (win/draw/loss) AND goal margin but different scores.",
            },
            {
              pts: "1 pt",
              tone: "bg-slate-500/30 text-slate-300",
              title: "Correct Winner / Incorrect Margin",
              body: "Picking the correct outcome but with a different margin.",
            },
            {
              pts: "0 pts",
              tone: "bg-red-500/20 text-red-400",
              title: "Incorrect Match Outcome",
              body: "Predicting the wrong winner or incorrectly predicting a draw.",
            },
          ].map((row) => (
            <div key={row.title} className="flex items-start gap-3">
              <div
                className={`w-10 h-6 shrink-0 font-mono text-xs font-bold flex items-center justify-center rounded-sm ${row.tone}`}
              >
                {row.pts}
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">{row.title}</h4>
                <p className="text-xs text-slate-400">{row.body}</p>
              </div>
            </div>
          ))}
          <div className="bg-blue-950/20 p-3 rounded-lg border border-blue-500/10 text-xs text-blue-300 font-sans flex items-start gap-2">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Draws with matching margins (e.g., predicting 1-1 and result is 2-2) qualify for the 3
              points bracket.
            </span>
          </div>
        </div>

        <div className="mt-5 p-5 bg-slate-950/40 rounded-xl border border-emerald-900/30">
          <div className="flex items-center gap-2 mb-3">
            <LifeBuoy className="w-5 h-5 text-emerald-400" />
            <h4 className="text-base font-bold font-display text-emerald-300">
              The Football Forgiveness Mechanic
            </h4>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed mb-4">
            Each football competition lets you drop a number of your lowest-scoring weeks. The exact
            drop allowance scales based on the length of the season:
          </p>
          <ul className="mb-4 space-y-2 text-sm text-slate-300">
            <li className="flex gap-2">
              <span className="text-emerald-400 font-bold shrink-0">*</span>
              <span>
                <span className="text-white font-semibold">English Premier League:</span> 38 games · 3 drop
                weeks.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-emerald-400 font-bold shrink-0">*</span>
              <span>
                <span className="text-white font-semibold">Scottish Premiership:</span> 38 games
                (including the post-split fixtures) · 3 drop weeks.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-emerald-400 font-bold shrink-0">*</span>
              <span>
                <span className="text-white font-semibold">EFL Championship:</span> 46 games · 4 drop
                weeks.
              </span>
            </li>
          </ul>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div className="bg-slate-900/60 rounded-lg border border-slate-800 p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-6 h-6 rounded-md bg-emerald-500/15 text-emerald-400 text-xs font-bold flex items-center justify-center">
                  ✓
                </span>
                <span className="text-xs font-bold text-white uppercase font-mono">Best Results</span>
              </div>
              <p className="text-xs text-slate-400">Your kept results - official leaderboard total.</p>
            </div>
            <div className="bg-slate-900/60 rounded-lg border border-slate-800 p-3">
              <div className="flex items-center gap-2 mb-1">
                <Ghost className="w-5 h-5 text-slate-400" />
                <span className="text-xs font-bold text-white uppercase font-mono">Ghost Points</span>
              </div>
              <p className="text-xs text-slate-400">
                What your score would be if no weeks were dropped.
              </p>
            </div>
            <div className="bg-slate-900/60 rounded-lg border border-slate-800 p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase">
                  Drops
                </span>
              </div>
              <p className="text-xs text-slate-400">Badge by your name shows remaining drops.</p>
            </div>
          </div>
        </div>
      </section>

      <CupCompetitionsAndPicksSection accentBar="bg-blue-400" />

      {communityShieldScheduled && (
        <section>
          <SectionHeading icon={Ticket} title="The Golden Ticket" barClass="bg-amber-400" />
          <div className="p-5 rounded-xl border border-amber-400/30 bg-gradient-to-br from-amber-500/10 via-slate-950/40 to-slate-950/40">
            <div className="flex items-start gap-3">
              <div className="shrink-0 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-amber-300 to-yellow-600 shadow-lg shadow-amber-900/40">
                <Ticket className="h-6 w-6 text-slate-950" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <h4 className="text-base font-bold font-display text-amber-200">
                    Community Shield Special
                  </h4>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Nail the exact Community Shield scoreline for a one-off Golden Ticket reward -
                  separate from your league standings.
                </p>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function RugbyContent() {
  return (
    <div className="space-y-8">
      <HowToPredictStepper sport="rugby" />

      <section>
        <SectionHeading icon={BookOpen} title="How to Play" barClass="bg-amber-400" />
        <div className="p-4 bg-slate-950/40 rounded-xl border border-slate-800 text-xs text-slate-300 leading-relaxed space-y-3">
          <p>
            Pick the match winner and select their exact winning margin. Lock it in before kick-off.
            Remember: Rugby requires total consistency. Every gameweek counts and there are no drop
            weeks.
          </p>
        </div>
      </section>

      <section>
        <SectionHeading icon={Target} title="Points System" barClass="bg-yellow-400" />
        <div className="p-5 bg-slate-950/40 rounded-xl border border-amber-950/30 space-y-3.5">
          {[
            {
              pts: "5 pts",
              tone: "bg-emerald-500/20 text-emerald-400",
              title: "Perfect Prediction",
              body: "Correct winner and perfectly guessing the winning margin.",
            },
            {
              pts: "3 pts",
              tone: "bg-amber-500/20 text-amber-400",
              title: "Correct Winner + Margin (±7)",
              body: "Correct winner with margin within 7 points of actual.",
            },
            {
              pts: "1 pt",
              tone: "bg-slate-500/30 text-slate-300",
              title: "Correct Winner + Margin (±10)",
              body: "Correct winner with margin within 10 points of actual.",
            },
            {
              pts: "0 pts",
              tone: "bg-red-500/20 text-red-400",
              title: "Incorrect Outcome or Margin > 10",
              body: "Wrong winner, or margin off by more than 10 points.",
            },
          ].map((row) => (
            <div key={row.title} className="flex items-start gap-3">
              <div
                className={`w-10 h-6 shrink-0 font-mono text-xs font-bold flex items-center justify-center rounded-sm ${row.tone}`}
              >
                {row.pts}
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">{row.title}</h4>
                <p className="text-xs text-slate-400">{row.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <CupCompetitionsAndPicksSection accentBar="bg-amber-400" />
    </div>
  );
}

function Formula1Content() {
  return (
    <div className="space-y-8">
      <HowToPredictStepper sport="formula1" />
      <section>
        <SectionHeading icon={BookOpen} title="How to Play" barClass="bg-red-400" />
        <div className="p-4 bg-slate-950/40 rounded-xl border border-slate-800 text-sm text-slate-300 leading-relaxed">
          Build Qualifying Top 10 and Race grids before the session locks. Drag or tap drivers into
          slots, then confirm.
          <p className="text-xs text-red-300/80 font-mono uppercase tracking-wider mt-3">
            Admin preview - not yet live for players
          </p>
        </div>
      </section>
      <section>
        <SectionHeading icon={Target} title="Points System" barClass="bg-yellow-400" />
        <div className="p-5 bg-slate-950/40 rounded-xl border border-red-900/30 text-sm text-slate-300">
          Scoring rewards correct drivers in the right positions across Qualifying and Race, with
          Fastest Lap bonuses. Final bands publish before public launch.
        </div>
      </section>
    </div>
  );
}

function GolfContent() {
  return (
    <div className="space-y-8">
      <HowToPredictStepper sport="golf" />
      <section>
        <SectionHeading icon={BookOpen} title="How to Play" barClass="bg-emerald-400" />
        <div className="p-4 bg-slate-950/40 rounded-xl border border-slate-800 text-sm text-slate-300 leading-relaxed">
          Select finishers across OWGR tiers, then lock before Thursday&apos;s first tee time.
          <p className="text-xs text-emerald-300/80 font-mono uppercase tracking-wider mt-3">
            Admin preview - not yet live for players
          </p>
        </div>
      </section>
      <section>
        <SectionHeading icon={Target} title="Points System" barClass="bg-yellow-400" />
        <div className="p-5 bg-slate-950/40 rounded-xl border border-emerald-900/30 text-sm text-slate-300">
          Points scale with how close your predicted finishers land to the official leaderboard.
        </div>
      </section>
    </div>
  );
}

function ChipsRulesContent({ isAdmin }: { isAdmin?: boolean }) {
  const [activeChip, setActiveChip] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <section>
        <SectionHeading icon={Zap} title="Chips" barClass="bg-violet-400" />
        <div className="p-4 bg-slate-950/40 rounded-xl border border-slate-800 text-xs text-slate-300 leading-relaxed space-y-3">
          <p>
            Chips give you a strategic edge. They are earned by making consistent predictions and
            must be used before the end of that specific sport&apos;s season. Unused chips do not
            carry over to the next year.
          </p>
          <p>
            Chips apply to Football and Rugby seasons.
            {isAdmin && (
              <>
                {" "}
                Administrators can also preview Chip behaviour for Formula 1 and Golf ahead of
                public launch.
              </>
            )}
          </p>
        </div>
      </section>

      <div className="overflow-hidden rounded-xl border border-slate-800">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/60">
              <th className="px-3 py-2 text-[9px] font-mono uppercase tracking-widest text-slate-500 font-semibold">
                Chip Name
              </th>
              <th className="px-3 py-2 text-[9px] font-mono uppercase tracking-widest text-slate-500 font-semibold">
                Core Function
              </th>
            </tr>
          </thead>
          <tbody>
            {CHIPS.map((chip) => (
              <tr
                key={`ref-${chip.id}`}
                className="border-b border-slate-800/80 last:border-b-0"
              >
                <td className="px-3 py-2.5 text-[11px] font-bold font-display text-slate-200 whitespace-nowrap align-top">
                  {chip.name}
                </td>
                <td className="px-3 py-2.5 text-[11px] text-slate-400 font-sans leading-snug">
                  {chip.tagline}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {CHIPS.map((chip) => {
          const Icon = chip.icon;
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => setActiveChip(chip.id)}
              className={`group text-left rounded-2xl border p-4 transition-all cursor-pointer hover:brightness-110 ${
                chip.isPremium
                  ? "border-amber-300/50 bg-linear-to-br from-amber-500/15 via-yellow-500/10 to-slate-950 shadow-[0_0_28px_rgba(251,191,36,0.2)]"
                  : `${chip.theme.border} ${chip.theme.bg}`
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`shrink-0 flex h-11 w-11 items-center justify-center rounded-xl border ${
                    chip.isPremium
                      ? "border-amber-200/40 bg-slate-950/70"
                      : `${chip.theme.border} bg-slate-950/50`
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 ${
                      chip.isPremium ? "text-amber-200" : chip.theme.iconText
                    }`}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h4
                      className={`text-xs font-bold font-display ${
                        chip.isPremium ? "text-amber-100" : chip.theme.accentText
                      }`}
                    >
                      {chip.name}
                    </h4>
                    <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 shrink-0" />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">{chip.tagline}</p>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
                    <div className="rounded-lg border border-slate-800/80 bg-slate-950/40 px-2.5 py-2">
                      <span className="block text-[8px] font-mono uppercase tracking-widest text-slate-500 mb-1">
                        Function
                      </span>
                      <p className="text-slate-300 leading-snug">{chip.gameImpact}</p>
                    </div>
                    <div className="rounded-lg border border-slate-800/80 bg-slate-950/40 px-2.5 py-2">
                      <span className="block text-[8px] font-mono uppercase tracking-widest text-slate-500 mb-1">
                        How earned
                      </span>
                      <p className="text-slate-300 leading-snug">{chip.howToEarn}</p>
                    </div>
                  </div>
                  {chip.notes && (
                    <p className="mt-2 text-[9px] text-amber-200/80 leading-snug">{chip.notes}</p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <AnimatePresence>
        {activeChip && (
          <ChipModal chipId={activeChip} onClose={() => setActiveChip(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function GoldenTicketRulesContent() {
  return (
    <div className="space-y-6">
      <section>
        <SectionHeading icon={Ticket} title="Golden Ticket" barClass="bg-yellow-400" />
        <div className="p-4 bg-gradient-to-r from-yellow-900/30 via-yellow-700/15 to-slate-950/40 rounded-xl border border-yellow-500/40 text-xs text-slate-300 leading-relaxed space-y-3">
          <p>
            The Golden Ticket is PitchSide&apos;s ultimate status symbol, awarded exclusively for
            landing a Perfect Prediction on a marquee fixture. It is not a consumable chip. Holding
            a Golden Ticket grants you permanent &apos;God Mode&apos; for the season, allowing you to
            view community consensus percentages before locking in your picks. Furthermore, ticket
            holders gain exclusive entry into &apos;The Summit&apos;, an end-of-season, high-stakes
            prediction event where the ultimate winners are etched into the PitchSide Pantheon.
          </p>
        </div>
      </section>
    </div>
  );
}

export default function RulesInfo({ user, onClose }: RulesInfoProps) {
  const communityShieldScheduled = useCommunityShieldScheduled();
  const visibleNav = useMemo(() => {
    const sports = SPORT_NAV.filter((s) => !s.adminOnly || user?.isAdmin === true);
    return [...sports, CHIPS_NAV, GOLDEN_TICKET_NAV];
  }, [user?.isAdmin]);

  const [activeNav, setActiveNav] = useState<RulesNavId>("football");

  const safeNav = visibleNav.some((s) => s.id === activeNav) ? activeNav : "football";

  const handleReturnToDashboard = () => {
    if (!onClose) return;
    retainOverlayHistoryDuringTransition();
    onClose();
  };

  return (
    <div className="bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 shadow-2xl text-slate-100 max-w-5xl mx-auto my-4 overflow-hidden relative">
      {onClose && (
        <button
          id="close-rules-btn"
          type="button"
          onClick={handleReturnToDashboard}
          className={`absolute top-4 right-4 z-20 ${btnClose}`}
          title="Return to Dashboard"
        >
          <X className="w-5 h-5" />
        </button>
      )}

      <div className="flex items-center gap-3 px-5 sm:px-6 pt-5 pb-4 border-b border-slate-800">
        <Award className="w-8 h-8 text-yellow-400 shrink-0" />
        <div className="min-w-0 pr-10 flex-1">
          <h2 className="text-2xl font-bold font-display tracking-tight text-white">
            PitchSide Player Guide
          </h2>
          <p className="text-xs text-slate-400 font-mono">
            HOW TO PLAY · POINTS · CHIPS
          </p>
          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(new CustomEvent("pitchside:replay-product-tour"));
            }}
            className="mt-1.5 text-[10px] font-mono text-slate-600 hover:text-emerald-400 transition-colors cursor-pointer underline-offset-2 hover:underline"
          >
            Replay product tour
          </button>
        </div>
      </div>

      <div
        data-no-swipe="true"
        className="md:hidden sticky top-0 z-10 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-3 py-2.5"
      >
        <div role="tablist" aria-label="Rules sections" className="flex gap-1.5 overflow-x-auto pb-0.5">
          {visibleNav.map((item) => {
            const active = safeNav === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveNav(item.id)}
                className={`shrink-0 px-3.5 py-2 rounded-full text-[10px] font-mono font-bold uppercase tracking-wide border transition-colors cursor-pointer ${
                  active ? item.activeAccent : `bg-slate-950/60 ${item.accent}`
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="md:flex md:min-h-[28rem]">
        <aside className="hidden md:flex w-52 shrink-0 flex-col border-r border-slate-800 bg-slate-950/40 p-4 gap-1">
          <span className="text-[10px] font-extrabold text-slate-500 font-mono uppercase tracking-widest px-2 mb-2">
            Sports
          </span>
          {visibleNav
            .filter((item) => !EXTRA_NAV_IDS.includes(item.id))
            .map((item) => {
              const active = safeNav === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveNav(item.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold font-mono flex items-center gap-2.5 border transition-all cursor-pointer ${
                    active
                      ? item.activeAccent
                      : "border-transparent text-slate-400 hover:bg-slate-900/50 hover:text-white"
                  }`}
                >
                  <span
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold border ${
                      active ? "border-current/30 bg-slate-950/40" : "border-slate-700 bg-slate-900"
                    }`}
                  >
                    {item.short}
                  </span>
                  {item.label}
                </button>
              );
            })}

          <span className="text-[10px] font-extrabold text-slate-500 font-mono uppercase tracking-widest px-2 mt-4 mb-2">
            Chips
          </span>
          {[CHIPS_NAV, GOLDEN_TICKET_NAV].map((item) => {
            const active = safeNav === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveNav(item.id)}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold font-mono flex items-center gap-2.5 border transition-all cursor-pointer ${
                  active
                    ? item.activeAccent
                    : "border-transparent text-slate-400 hover:bg-slate-900/50 hover:text-white"
                }`}
              >
                <span
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold border ${
                    active
                      ? "border-current/30 bg-slate-950/40"
                      : "border-slate-700 bg-slate-900"
                  }`}
                >
                  {item.short}
                </span>
                {item.label}
              </button>
            );
          })}
        </aside>

        <div className="flex-1 p-5 sm:p-6 overflow-y-auto max-h-[min(70vh,720px)] md:max-h-[min(75vh,780px)]">
          {safeNav === "football" && (
            <FootballContent communityShieldScheduled={communityShieldScheduled} />
          )}
          {safeNav === "rugby" && <RugbyContent />}
          {safeNav === "formula1" && <Formula1Content />}
          {safeNav === "golf" && <GolfContent />}
          {safeNav === "chips" && <ChipsRulesContent isAdmin={user?.isAdmin} />}
          {safeNav === "golden_ticket" && <GoldenTicketRulesContent />}

          {user?.isAdmin && safeNav !== "chips" && safeNav !== "golden_ticket" && (
            <div className="mt-8 p-5 rounded-xl border border-purple-500/30 bg-purple-950/20">
              <div className="flex items-center gap-2 mb-2">
                <Lock className="w-5 h-5 text-purple-400" />
                <h4 className="text-base font-bold font-display text-purple-300">Admin Area</h4>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">
                Administrators can manage fixtures, enter final scores, review predictions, and
                manage player accounts from the Admin Area.
              </p>
            </div>
          )}

          <div className="mt-8 pt-4 border-t border-slate-800 text-center text-xs text-slate-500 font-mono flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 justify-center">
              <Shield className="w-4 h-4 text-slate-400" />
              <span>Fair Play Guarantee: Scoring runs server-side</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              Version 1.5.0
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
