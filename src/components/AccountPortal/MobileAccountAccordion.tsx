import React from 'react';
import {
  Layers,
  Trophy,
  Award,
  LifeBuoy,
  ChevronDown,
  type LucideIcon,
} from 'lucide-react';
import { UserProfile, League, Competition } from '../../types';
import { LeaguesAndCompetitions } from './LeaguesAndCompetitions';
import { MyLeagues } from './MyLeagues';
import { HistoricScores } from './HistoricScores';
import { ContactSupport } from './ContactSupport';

export type MobileAccountAccordionId =
  | 'tournaments'
  | 'leagues'
  | 'historic-scores'
  | 'contact-support';

type AccordionItem = {
  id: MobileAccountAccordionId;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  tone: 'emerald' | 'blue';
};

const ITEMS: AccordionItem[] = [
  {
    id: 'tournaments',
    title: 'Leagues and Competitions',
    subtitle: 'Manage Predictions feed opt-ins',
    icon: Layers,
    tone: 'emerald',
  },
  {
    id: 'leagues',
    title: 'My Leagues',
    subtitle: 'League memberships by season',
    icon: Trophy,
    tone: 'emerald',
  },
  {
    id: 'historic-scores',
    title: 'Prediction History',
    subtitle: 'Performance HUD & match results',
    icon: Award,
    tone: 'emerald',
  },
  {
    id: 'contact-support',
    title: 'Contact Support',
    subtitle: 'Message the PitchSide team',
    icon: LifeBuoy,
    tone: 'blue',
  },
];

interface MobileAccountAccordionProps {
  openId: MobileAccountAccordionId | null;
  onToggle: (id: MobileAccountAccordionId) => void;
  user: UserProfile;
  registeredUsers: UserProfile[];
  userLeagues: League[];
  realLeagues: League[];
  selectedSeason: string;
  setSelectedSeason: (season: string) => void;
  selectedHistoricLeague: string;
  setSelectedHistoricLeague: (league: string) => void;
  getCompetitions: () => Competition[];
  onSelectLeague?: (leagueId: string) => void;
  onUpdateUser: (updated: UserProfile) => void;
  setStatusMsg: (msg: { text: string; mode: 'success' | 'error' | 'none' }) => void;
}

export const MobileAccountAccordion: React.FC<MobileAccountAccordionProps> = ({
  openId,
  onToggle,
  user,
  registeredUsers,
  userLeagues,
  realLeagues,
  selectedSeason,
  setSelectedSeason,
  selectedHistoricLeague,
  setSelectedHistoricLeague,
  getCompetitions,
  onSelectLeague,
  onUpdateUser,
  setStatusMsg,
}) => {
  return (
    <div className="md:hidden space-y-3 px-5 pb-4">
      <span className="text-[10px] font-extrabold text-slate-500 font-mono uppercase tracking-widest pl-1 block">
        Account features
      </span>

      {ITEMS.map(({ id, title, subtitle, icon: Icon, tone }) => {
        const open = openId === id;
        const activeBorder =
          tone === 'blue'
            ? open
              ? 'border-blue-500/40 ring-1 ring-blue-500/25'
              : 'border-slate-800/80'
            : open
              ? 'border-emerald-500/40 ring-1 ring-emerald-500/25'
              : 'border-slate-800/80';
        const iconWrap =
          tone === 'blue'
            ? open
              ? 'bg-blue-500/15 border-blue-500/35 text-blue-300'
              : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
            : open
              ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300'
              : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
        const titleColor =
          tone === 'blue'
            ? open
              ? 'text-blue-300'
              : 'text-white'
            : open
              ? 'text-emerald-300'
              : 'text-white';

        return (
          <div
            key={id}
            className={`rounded-xl border bg-slate-900/50 overflow-hidden transition-colors ${activeBorder}`}
          >
            <button
              type="button"
              aria-expanded={open}
              data-no-swipe="true"
              onClick={() => onToggle(id)}
              className={`w-full text-left px-4 py-3.5 flex items-center gap-3 cursor-pointer transition-colors touch-manipulation ${
                open ? 'bg-slate-950/70' : 'hover:bg-slate-900/80'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${iconWrap}`}
              >
                <Icon className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className={`block text-sm font-semibold ${titleColor}`}>{title}</span>
                <span className="block text-[10px] text-slate-500 font-mono mt-0.5 truncate">
                  {subtitle}
                </span>
              </div>
              <ChevronDown
                className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
                  open
                    ? tone === 'blue'
                      ? 'rotate-180 text-blue-400'
                      : 'rotate-180 text-emerald-400'
                    : 'text-slate-500'
                }`}
              />
            </button>

            {open && (
              <div className="border-t border-slate-800/60 bg-slate-950/40 p-3 sm:p-4 min-w-0 overflow-x-auto">
                {id === 'tournaments' && (
                  <LeaguesAndCompetitions
                    user={user}
                    onUpdateUser={onUpdateUser}
                    setStatusMsg={setStatusMsg}
                  />
                )}
                {id === 'leagues' && (
                  <MyLeagues
                    userLeagues={userLeagues}
                    selectedSeason={selectedSeason}
                    setSelectedSeason={setSelectedSeason}
                    getCompetitions={getCompetitions}
                    onSelectLeague={onSelectLeague}
                  />
                )}
                {id === 'historic-scores' && (
                  <HistoricScores
                    user={user}
                    registeredUsers={registeredUsers}
                    realLeagues={realLeagues}
                    selectedSeason={selectedSeason}
                    setSelectedSeason={setSelectedSeason}
                    selectedHistoricLeague={selectedHistoricLeague}
                    setSelectedHistoricLeague={setSelectedHistoricLeague}
                  />
                )}
                {id === 'contact-support' && (
                  <ContactSupport user={user} setStatusMsg={setStatusMsg} />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
