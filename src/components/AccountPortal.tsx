import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle2, AlertTriangle } from 'lucide-react';
import { supabase, dbFetchLeagues, dbFetchUserLeagues } from '../supabase';
import { UserProfile, League } from '../types';
import { getCompetitions } from '../competitions';

import { SidebarNav } from './AccountPortal/SidebarNav';
import { GeneralSettings } from './AccountPortal/GeneralSettings';
import { ChangeEmail } from './AccountPortal/ChangeEmail';
import { ChangePassword } from './AccountPortal/ChangePassword';
import { HistoricScores } from './AccountPortal/HistoricScores';
import { MyLeagues } from './AccountPortal/MyLeagues';
import { DeleteAccount } from './AccountPortal/DeleteAccount';
import { Messages } from './AccountPortal/Messages';
import { SiteMessage } from '../types';

export interface AccountPortalProps {
  user: UserProfile;
  registeredUsers: UserProfile[];
  onClose: () => void;
  onUpdateUser: (updatedUser: UserProfile) => void;
  onSelectLeague?: (leagueId: string) => void;
}

export default function AccountPortal({ user, registeredUsers, onClose, onUpdateUser, onSelectLeague }: AccountPortalProps) {
  const [activeTab, setActiveTab] = useState<'general' | 'change-email' | 'change-password' | 'historic-scores' | 'leagues' | 'messages' | 'delete-account'>('leagues');
  
  const [realLeagues, setRealLeagues] = useState<League[]>([]);
  const [userLeagues, setUserLeagues] = useState<League[]>([]);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);

  useEffect(() => {
    // Check unread messages
    const checkUnread = () => {
      const stored = JSON.parse(localStorage.getItem('pitchside_messages') || '[]');
      const myMessages = stored.filter((m: SiteMessage) => m.receiverId === user.id || m.receiverId === 'all');
      setUnreadMessagesCount(myMessages.filter((m: SiteMessage) => !m.read).length);
    };

    checkUnread();
    const interval = setInterval(checkUnread, 5000);

    const loadRealLeagues = async () => {
      try {
        const leagues = await dbFetchLeagues();
        setRealLeagues(leagues || []);
        if (user && user.id) {
          const uLeagues = await dbFetchUserLeagues(user.id);
          setUserLeagues(uLeagues || []);
        }
      } catch (err) {
        console.warn('Failed to load global league db entries:', err);
      }
    };
    loadRealLeagues();

    return () => clearInterval(interval);
  }, [user]);

  const [statusMsg, setStatusMsg] = useState<{ text: string; mode: 'success' | 'error' | 'none' }>({ text: '', mode: 'none' });

  const [selectedSeason, setSelectedSeason] = useState<'2026' | '2025' | '2024'>('2026');
  const [selectedHistoricLeague, setSelectedHistoricLeague] = useState<string>('global');

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-12 font-sans overflow-hidden"
    >
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={onClose} />
      
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative w-full max-w-5xl h-[85vh] sm:h-[600px] bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl flex flex-col md:flex-row overflow-hidden"
      >
        <SidebarNav 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          setStatusMsg={setStatusMsg}
          unreadMessagesCount={unreadMessagesCount}
        />

        <div className="flex-1 p-6 overflow-y-auto flex flex-col justify-between h-full">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-800/70 mb-5 relative z-10">
              <div>
                <h4 className="text-base font-extrabold font-display text-white tracking-wide uppercase">
                  {activeTab === 'general' && 'General Account Details'}
                  {activeTab === 'leagues' && 'My Registered Leagues'}
                  {activeTab === 'messages' && 'Secure Messages'}
                  {activeTab === 'change-email' && 'Change Email'}
                  {activeTab === 'change-password' && 'Change Password'}
                  {activeTab === 'historic-scores' && 'Contestant Historic Scores'}
                  {activeTab === 'delete-account' && 'Erase Account Data'}
                </h4>
                <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">
                  {activeTab === 'leagues' && 'League Memberships by Season'}
                  {activeTab === 'messages' && 'Direct communications from platform administrators'}
                  {activeTab === 'historic-scores' && 'Performance Vectors & Seasonal Archives'}
                  {activeTab === 'delete-account' && 'Irreversible Personal Data Erasure'}
                </p>
              </div>

              <button
                id="acc-close-btn"
                onClick={onClose}
                className="text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 p-2.5 rounded-full cursor-pointer transition-colors"
                title="Return to Dashboard"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <AnimatePresence mode="wait">
              {statusMsg.mode !== 'none' && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
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
                </motion.div>
              )}
            </AnimatePresence>

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
              <DeleteAccount 
                user={user} 
                setStatusMsg={setStatusMsg} 
              />
            )}

            {activeTab === 'messages' && (
              <Messages userId={user.id} />
            )}
          </div>

          <div className="text-[10px] font-mono text-slate-500 text-center pt-5 mt-6 border-t border-slate-800/40 select-none">
            PITCHSIDE • 2026
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
