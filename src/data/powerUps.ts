import { Shield, Sparkles, type LucideIcon } from "lucide-react";

/** Visual theme tokens so every surface renders a power-up consistently. */
export interface PowerUpTheme {
  /** Accent text colour (e.g. chip name, headings). */
  accentText: string;
  /** Icon colour. */
  iconText: string;
  /** Border colour for outlined surfaces. */
  border: string;
  /** Soft background tint. */
  bg: string;
  /** Ambient glow colour used behind the modal icon. */
  glow: string;
}

export interface PowerUp {
  id: string;
  name: string;
  /** Short one-line hook shown on chips and list rows. */
  tagline: string;
  icon: LucideIcon;
  description: string;
  howToEarn: string;
  howToUse: string;
  gameImpact: string;
  theme: PowerUpTheme;
}

export const POWER_UPS: PowerUp[] = [
  {
    id: "urc-shield-bank",
    name: "URC Shield Bank",
    tagline: "Bank a result and shield it from a bad round.",
    icon: Shield,
    description:
      "The URC Shield Bank lets you safeguard a locked prediction. Deploy it on a fixture you're confident about and the points you earn are 'banked' — protected even if the rest of your round goes sideways.",
    howToEarn:
      "Earn a Shield by stringing together correct outcomes in United Rugby Championship fixtures. Every milestone streak tops up your bank with one Shield charge.",
    howToUse:
      "Before kick-off, tap the Shield on a locked prediction to arm it. Only one Shield can be armed per round, so pick the fixture you trust most.",
    gameImpact:
      "A banked result can't be dropped or diluted — it's a guaranteed floor for your round, turning a single confident call into a safety net.",
    theme: {
      accentText: "text-amber-300",
      iconText: "text-amber-400",
      border: "border-amber-500/30",
      bg: "bg-amber-500/5",
      glow: "bg-amber-500/20",
    },
  },
  {
    id: "ucl-joker",
    name: "UCL Joker",
    tagline: "Double down on one Champions League team.",
    icon: Sparkles,
    description:
      "The UCL Joker nominates a single Champions League team as your Joker. Whenever your nominated side plays, correct predictions on their fixtures are worth double points.",
    howToEarn:
      "Every player is granted one Joker per Champions League stage. Nominate your team before the stage locks to bank the multiplier.",
    howToUse:
      "Open your wallet, choose the Joker, and assign it to a team for the stage. Your pick is shown on the chip (e.g. 'UCL Joker: Arsenal') until the stage ends.",
    gameImpact:
      "Doubles the points from every correct prediction on your Joker team's fixtures — a high-upside swing that can vault you up the table in a single big night.",
    theme: {
      accentText: "text-purple-300",
      iconText: "text-purple-400",
      border: "border-purple-500/30",
      bg: "bg-purple-500/5",
      glow: "bg-purple-500/20",
    },
  },
];

/** Look up a single power-up by its id. */
export function getPowerUp(id: string): PowerUp | undefined {
  return POWER_UPS.find((p) => p.id === id);
}
