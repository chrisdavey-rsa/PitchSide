/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { UserCheck, HelpCircle, Lock, LogOut } from "lucide-react";
import { UserProfile } from "../../types"; // Adjust path if your types are elsewhere
import PitchSideLogo from "../PitchSideLogo";

interface TopNavigationProps {
  user: UserProfile;
  onLogout: () => void;
  onOpenRules: () => void;
  onOpenAdmin: () => void;
  onOpenAccount: () => void;
}

export default function TopNavigation({
  user,
  onLogout,
  onOpenRules,
  onOpenAdmin,
  onOpenAccount,
}: TopNavigationProps) {
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);

  // Checks for unread notifications specific to the user
  useEffect(() => {
    const checkUnread = () => {
      const stored = JSON.parse(localStorage.getItem('pitchside_messages') || '[]');
      const myMessages = stored.filter((m: any) => m.receiverId === user?.id || m.receiverId === 'all');
      setUnreadMessagesCount(myMessages.filter((m: any) => !m.read).length);
    };

    checkUnread();
    const interval = setInterval(checkUnread, 5000);
    return () => clearInterval(interval);
  }, [user?.id]);

  return (
    <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-800/80 p-4 sm:px-6 flex items-center justify-between shadow-xl">
      <div className="flex items-center gap-3">
        {/* We removed the reset state onClick here because that's now handled by the dashboard router */}
        <div className="cursor-pointer">
          <PitchSideLogo size="md" autoplay={false} />
        </div>
        {user.isAdmin && (
          <span className="bg-purple-500/15 border border-purple-500/30 text-purple-400 font-mono text-[9px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">
            ADMINISTRATOR
          </span>
        )}
      </div>

      <div className="hidden md:flex items-center gap-2 sm:gap-4">
        <motion.button
          layoutId="nav-account-btn"
          id="nav-account-btn"
          onClick={onOpenAccount}
          className="text-xs text-slate-300 hover:text-white bg-slate-800/60 p-2 sm:px-3 sm:py-1.5 rounded-lg cursor-pointer transition-colors flex items-center gap-1.5 font-medium relative"
        >
          <UserCheck className="w-4 h-4 text-emerald-450" />
          <span>Account</span>
          {unreadMessagesCount > 0 && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse border-2 border-slate-900"></span>
          )}
        </motion.button>

        <motion.button
          layoutId="nav-rules-btn"
          id="nav-rules-btn"
          onClick={onOpenRules}
          className="text-xs text-slate-300 hover:text-white bg-slate-800/60 p-2 sm:px-3 sm:py-1.5 rounded-lg cursor-pointer transition-colors flex items-center gap-1.5 font-medium"
        >
          <HelpCircle className="w-4 h-4 text-blue-400" />
          <span className="hidden sm:inline">Rules Guide</span>
        </motion.button>

        {/* Admin Toggle Switch */}
        {user.isAdmin && (
          <button
            id="nav-admin-toggle-btn"
            onClick={onOpenAdmin}
            className="text-xs text-white bg-purple-600 hover:bg-purple-700 active:translate-y-[0.5px] border border-purple-500 py-1.5 px-3 rounded-lg flex items-center gap-1.5 font-semibold transition-all shadow-[0_4px_12px_rgba(147,51,234,0.3)] cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5 text-white" />
            <span>Admin Area</span>
          </button>
        )}

        <button
          id="nav-logout-btn"
          onClick={onLogout}
          className="text-xs text-slate-400 hover:text-red-400 bg-slate-950/60 p-2 rounded-lg cursor-pointer transition-colors"
          title="Log out from PitchSide"
        >
          <LogOut className="w-4.5 h-4.5" />
        </button>
      </div>
    </div>
  );
}