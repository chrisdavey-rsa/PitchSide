import React, { useState, useEffect, useRef } from 'react';
import { X, CheckCircle2, AlertTriangle } from 'lucide-react';
import { UserProfile } from '../types';
import { getCompetitions } from '../competitions';
import { useLeaguesQuery, useUserLeaguesQuery } from '../hooks/usePitchsideQueries';
import { useOverlayHistory, retainOverlayHistoryDuringTransition } from '../hooks/useOverlayHistory';
import { RadialOrigin } from '../radial';
import { btnClose } from '../ui';

import { SidebarNav, AccountTab } from './AccountPortal/SidebarNav';
import { GeneralSettings } from './AccountPortal/GeneralSettings';
import { ChangeEmail } from './AccountPortal/ChangeEmail';
import { ChangePassword } from './AccountPortal/ChangePassword';
import { HistoricScores } from './AccountPortal/HistoricScores';
import { MyLeagues } from './AccountPortal/MyLeagues';
import { DeleteAccount } from './AccountPortal/DeleteAccount';
import { MobileAccountHub } from './AccountPortal/MobileAccountHub';
import { getLatestSeason } from '../seasons';

export interface AccountPortalProps {
  user: UserProfile;
  registeredUsers: UserProfile[];
  /** Required for overlay mode; omit in embedded tab mode. */
  onClose?: () => void;
  onUpdateUser: (updatedUser: UserProfile) => void;
  onSelectLeague?: (leagueId: string) => void;
  onOpenRules?: () => void;
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
  onLogout,
  variant = 'overlay',
}: AccountPortalProps) {
  const embedded = variant === 'embedded';
  const [activeTab, setActiveTab] = useState<AccountTab>('leagues');

  const { data: realLeagues = [] } = useLeaguesQuery();
  const { data: userLeagues = [] } = useUserLeaguesQuery(user.id);

  const [statusMsg, setStatusMsg] = useState<{ text: string; mode: 'success' | 'error' | 'none' }>({ text: '', mode: 'none' });

  const [selectedSeason, setSelectedSeason] = useState(getLatestSeason);
  const [selectedHistoricLeague, setSelectedHistoricLeague] = useState<string>('global');

  useOverlayHistory(!embedded && !!onClose, onClose || (() => {}), 'account');

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

  const panel = (
    <div
      className={
        embedded
          ? 'relative w-full bg-slate-950 border border-slate-800 rounded-2xl shadow-xl flex flex-col md:flex-row overflow-hidden min-h-[70vh]'
          : 'relative w-full max-w-5xl h-[100dvh] sm:h-[min(85vh,820px)] bg-slate-950 border-0 sm:border border-slate-800 sm:rounded-2xl shadow-2xl flex flex-col md:flex-row overflow-hidden pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:pb-0'
      }
      onClick={embedded ? undefined : (e) => e.stopPropagation()}
      onTouchEnd={embedded ? undefined : (e) => e.stopPropagation()}
    >
      <MobileAccountHub
        user={user}
        userLeagues={userLeagues}
        selectedSeason={selectedSeason}
        setSelectedSeason={setSelectedSeason}
        getCompetitions={getCompetitions}
        onSelectLeague={onSelectLeague}
        onOpenRules={() => onOpenRules?.()}
        onClose={embedded ? undefined : handleReturnToDashboard}
        onLogout={onLogout}
      />

      <SidebarNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        setStatusMsg={setStatusMsg}
        username={user.nickname}
      />

      <div className="hidden md:flex flex-1 p-6 overflow-y-auto flex-col justify-between h-full">
        <div>
          <div className="flex items-center justify-between pb-4 border-b border-slate-800/70 mb-5 relative z-10">
            <div>
              <h4 className="text-base font-extrabold font-display text-white tracking-wide uppercase">
                {activeTab === 'general' && 'General Account Details'}
                {activeTab === 'leagues' && 'My Registered Leagues'}
                {activeTab === 'change-email' && 'Change Email'}
                {activeTab === 'change-password' && 'Change Password'}
                {activeTab === 'historic-scores' && 'Contestant Historic Scores'}
                {activeTab === 'delete-account' && 'Erase Account Data'}
              </h4>
              <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">
                {activeTab === 'leagues' && 'League Memberships by Season'}
                {activeTab === 'historic-scores' && 'Performance Vectors & Seasonal Archives'}
                {activeTab === 'delete-account' && 'Irreversible Personal Data Erasure'}
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

          {activeTab === 'delete-account' && (
            <DeleteAccount user={user} setStatusMsg={setStatusMsg} />
          )}
        </div>

        <div className="text-[10px] font-mono text-slate-500 text-center pt-5 mt-6 border-t border-slate-800/40 select-none">
          PITCHSIDE • 2026
        </div>
      </div>
    </div>
  );

  if (embedded) {
    return <div className="w-full font-sans">{panel}</div>;
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
