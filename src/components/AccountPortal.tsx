import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { X, CheckCircle2, AlertTriangle } from 'lucide-react';
import { UserProfile } from '../types';
import { getCompetitions } from '../competitions';
import { useLeaguesQuery, useUserLeaguesQuery } from '../hooks/usePitchsideQueries';
import { useOverlayHistory, retainOverlayHistoryDuringTransition } from '../hooks/useOverlayHistory';
import { useIsMobileViewport } from '../hooks/useMediaQuery';
import { RadialOrigin } from '../radial';
import { btnClose } from '../ui';

import {
  SidebarNav,
  AccountTab,
  isMobileRestrictedAccountTab,
  MOBILE_ACCOUNT_FALLBACK_TAB,
} from './AccountPortal/SidebarNav';
import { GeneralSettings } from './AccountPortal/GeneralSettings';
import { ChangeEmail } from './AccountPortal/ChangeEmail';
import { ChangePassword } from './AccountPortal/ChangePassword';
import { HistoricScores } from './AccountPortal/HistoricScores';
import { MyLeagues } from './AccountPortal/MyLeagues';
import { LeaguesAndCompetitions } from './AccountPortal/LeaguesAndCompetitions';
import { DeleteAccount } from './AccountPortal/DeleteAccount';
import { ContactSupport } from './AccountPortal/ContactSupport';
import { MobileAccountHub } from './AccountPortal/MobileAccountHub';
import {
  MobileAccountAccordion,
  type MobileAccountAccordionId,
} from './AccountPortal/MobileAccountAccordion';
import { getLatestSeason } from '../seasons';

export interface AccountPortalProps {
  user: UserProfile;
  registeredUsers: UserProfile[];
  /** Required for overlay mode; omit in embedded tab mode. */
  onClose?: () => void;
  onUpdateUser: (updatedUser: UserProfile) => void;
  onSelectLeague?: (leagueId: string) => void;
  onOpenRules?: () => void;
  onOpenAdmin?: () => void;
  onLogout?: () => void;
  origin?: RadialOrigin | null;
  /**
   * `overlay` — full-screen modal (desktop Settings).
   * `embedded` — in-flow tab page for mobile bottom nav (no close / backdrop).
   */
  variant?: 'overlay' | 'embedded';
}

export default function AccountPortal({
  user,
  registeredUsers,
  onClose,
  onUpdateUser,
  onSelectLeague,
  onOpenRules,
  onOpenAdmin,
  onLogout,
  variant = 'overlay',
}: AccountPortalProps) {
  const embedded = variant === 'embedded';
  const isMobile = useIsMobileViewport();
  const [activeTab, setActiveTab] = useState<AccountTab>('leagues');
  /** Mobile accordion: all sections closed until the user opens one. */
  const [mobileAccordionId, setMobileAccordionId] =
    useState<MobileAccountAccordionId | null>(null);

  const { data: realLeagues = [] } = useLeaguesQuery();
  const { data: userLeagues = [] } = useUserLeaguesQuery(user.id);

  const [statusMsg, setStatusMsg] = useState<{ text: string; mode: 'success' | 'error' | 'none' }>({
    text: '',
    mode: 'none',
  });

  const [selectedSeason, setSelectedSeason] = useState(getLatestSeason);
  const [selectedHistoricLeague, setSelectedHistoricLeague] = useState<string>('global');

  useOverlayHistory(!embedded && !!onClose, onClose || (() => {}), 'account');

  // Keep desktop tab out of restricted management views if resized to mobile mid-session.
  useLayoutEffect(() => {
    if (!isMobile) return;
    if (isMobileRestrictedAccountTab(activeTab)) {
      setActiveTab(MOBILE_ACCOUNT_FALLBACK_TAB);
    }
  }, [isMobile, activeTab]);

  const suppressBackdropCloseRef = useRef(true);
  useEffect(() => {
    if (embedded) return;
    suppressBackdropCloseRef.current = true;
    const timer = window.setTimeout(() => {
      suppressBackdropCloseRef.current = false;
    }, 400);
    return () => window.clearTimeout(timer);
  }, [embedded]);

  const handleReturnToDashboard = () => {
    if (!onClose) return;
    retainOverlayHistoryDuringTransition();
    onClose();
  };

  const handleBackdropClose = () => {
    if (embedded || !onClose) return;
    if (suppressBackdropCloseRef.current) return;
    handleReturnToDashboard();
  };

  const toggleMobileAccordion = (id: MobileAccountAccordionId) => {
    setMobileAccordionId((prev) => (prev === id ? null : id));
    setStatusMsg({ text: '', mode: 'none' });
  };

  const panel = (
    <div
      className={
        embedded
          ? 'relative z-10 w-full bg-slate-950 border border-slate-800 rounded-2xl shadow-xl flex flex-col md:flex-row overflow-visible touch-pan-y'
          : 'relative w-full max-w-5xl h-[100dvh] sm:h-[min(85vh,820px)] bg-slate-950 border-0 sm:border border-slate-800 sm:rounded-2xl shadow-2xl flex flex-col md:flex-row overflow-hidden pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:pb-0'
      }
      onClick={embedded ? undefined : (e) => e.stopPropagation()}
      onTouchEnd={embedded ? undefined : (e) => e.stopPropagation()}
    >
      <MobileAccountHub
        embedded={embedded}
        user={user}
        userLeagues={userLeagues}
        selectedSeason={selectedSeason}
        setSelectedSeason={setSelectedSeason}
        getCompetitions={getCompetitions}
        onSelectLeague={onSelectLeague}
        onUpdateUser={onUpdateUser}
        onOpenRules={() => onOpenRules?.()}
        onOpenAdmin={onOpenAdmin}
        onClose={embedded ? undefined : handleReturnToDashboard}
        onLogout={onLogout}
        compact
      />

      {statusMsg.mode !== 'none' && (
        <div className="md:hidden px-5 pb-2">
          <div
            className={`p-3.5 border rounded-xl text-xs flex items-start gap-2.5 font-sans ${
              statusMsg.mode === 'success'
                ? 'bg-emerald-950/45 border-emerald-500/20 text-emerald-400'
                : 'bg-red-950/45 border-red-500/20 text-red-400'
            }`}
          >
            {statusMsg.mode === 'success' ? (
              <CheckCircle2 className="w-4.5 h-4.5 shrink-0 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-4.5 h-4.5 shrink-0 text-red-400" />
            )}
            <span className="leading-relaxed">{statusMsg.text}</span>
          </div>
        </div>
      )}

      {/* Mobile-only accordion feature list */}
      <MobileAccountAccordion
        openId={mobileAccordionId}
        onToggle={toggleMobileAccordion}
        user={user}
        registeredUsers={registeredUsers}
        userLeagues={userLeagues}
        realLeagues={realLeagues}
        selectedSeason={selectedSeason}
        setSelectedSeason={setSelectedSeason}
        selectedHistoricLeague={selectedHistoricLeague}
        setSelectedHistoricLeague={setSelectedHistoricLeague}
        getCompetitions={getCompetitions}
        onSelectLeague={onSelectLeague}
        onUpdateUser={onUpdateUser}
        setStatusMsg={setStatusMsg}
      />

      {/* Desktop sidebar — unaffected by mobile accordion */}
      <SidebarNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        setStatusMsg={setStatusMsg}
        username={user.nickname}
      />

      {/* Desktop content pane */}
      <div className="hidden md:flex flex-1 p-6 overflow-y-auto flex-col justify-between h-full min-w-0">
        <div className="min-w-0 w-full">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800/70 mb-5 relative z-10 gap-3">
            <div className="min-w-0">
              <h4 className="text-base font-extrabold font-display text-white tracking-wide uppercase truncate">
                {activeTab === 'general' && 'General Account Details'}
                {activeTab === 'tournaments' && 'Leagues and Competitions'}
                {activeTab === 'leagues' && 'My Registered Leagues'}
                {activeTab === 'change-email' && 'Change Email'}
                {activeTab === 'change-password' && 'Change Password'}
                {activeTab === 'historic-scores' && 'Prediction History'}
                {activeTab === 'contact-support' && 'Contact Support'}
                {activeTab === 'delete-account' && 'Erase Account Data'}
              </h4>
              <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">
                {activeTab === 'tournaments' && 'Manage your Predictions feed opt-ins'}
                {activeTab === 'leagues' && 'League Memberships by Season'}
                {activeTab === 'historic-scores' && 'Performance HUD & Match Results'}
                {activeTab === 'contact-support' && 'Message the PitchSide team'}
                {activeTab === 'delete-account' && 'Irreversible Personal Data Erasure'}
                {activeTab === 'general' && 'Profile preferences & notifications'}
                {activeTab === 'change-email' && 'Update your login email'}
                {activeTab === 'change-password' && 'Update your account password'}
              </p>
            </div>

            {!embedded && onClose && (
              <button
                id="acc-close-btn"
                onClick={handleReturnToDashboard}
                className={btnClose}
                title="Return to Dashboard"
                type="button"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {statusMsg.mode !== 'none' && (
            <div
              className={`p-3.5 mb-5 border rounded-xl text-xs flex items-start gap-2.5 font-sans relative z-10 ${
                statusMsg.mode === 'success'
                  ? 'bg-emerald-950/45 border-emerald-500/20 text-emerald-400'
                  : 'bg-red-950/45 border-red-500/20 text-red-400'
              }`}
            >
              {statusMsg.mode === 'success' ? (
                <CheckCircle2 className="w-4.5 h-4.5 shrink-0 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-4.5 h-4.5 shrink-0 text-red-400" />
              )}
              <span className="leading-relaxed">{statusMsg.text}</span>
            </div>
          )}

          {activeTab === 'general' && (
            <GeneralSettings
              user={user}
              onUpdateUser={onUpdateUser}
              setStatusMsg={setStatusMsg}
              setActiveTab={setActiveTab}
            />
          )}

          {activeTab === 'change-email' && (
            <ChangeEmail
              user={user}
              onUpdateUser={onUpdateUser}
              setStatusMsg={setStatusMsg}
            />
          )}

          {activeTab === 'change-password' && (
            <ChangePassword
              user={user}
              onUpdateUser={onUpdateUser}
              setStatusMsg={setStatusMsg}
            />
          )}

          {activeTab === 'tournaments' && (
            <LeaguesAndCompetitions
              user={user}
              onUpdateUser={onUpdateUser}
              setStatusMsg={setStatusMsg}
            />
          )}

          {activeTab === 'leagues' && (
            <MyLeagues
              userLeagues={userLeagues}
              selectedSeason={selectedSeason}
              setSelectedSeason={setSelectedSeason}
              getCompetitions={getCompetitions}
              onSelectLeague={onSelectLeague}
            />
          )}

          {activeTab === 'historic-scores' && (
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

          {activeTab === 'contact-support' && (
            <ContactSupport user={user} setStatusMsg={setStatusMsg} />
          )}

          {activeTab === 'delete-account' && (
            <DeleteAccount
              user={user}
              setStatusMsg={setStatusMsg}
              onDeleted={onLogout}
            />
          )}
        </div>

        <div className="text-[10px] font-mono text-slate-500 text-center pt-5 mt-6 border-t border-slate-800/40 select-none">
          PITCHSIDE • 2026
        </div>
      </div>
    </div>
  );

  if (embedded) {
    return <div className="relative z-10 w-full font-sans touch-pan-y">{panel}</div>;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-6 md:p-12 font-sans overflow-hidden">
      <div
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
        onClick={handleBackdropClose}
        onTouchEnd={(e) => {
          if (suppressBackdropCloseRef.current) return;
          if (e.target !== e.currentTarget) return;
          handleReturnToDashboard();
        }}
      />
      {panel}
    </div>
  );
}
