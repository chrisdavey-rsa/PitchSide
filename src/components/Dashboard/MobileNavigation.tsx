import React from 'react';
import { UserCheck, HelpCircle, Lock, LogOut } from 'lucide-react';
import { UserProfile } from '../../types';
import { useUnreadMessages } from '../../hooks/useUnreadMessages';

interface MobileNavigationProps {
  user: UserProfile;
  onOpenAccount: () => void;
  onOpenRules: () => void;
  onOpenAdmin: () => void;
  onLogout: () => void;
}

export default function MobileNavigation({
  user,
  onOpenAccount,
  onOpenRules,
  onOpenAdmin,
  onLogout,
}: MobileNavigationProps) {
  const unreadMessagesCount = useUnreadMessages(user?.id);

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-950/90 backdrop-blur-lg border-t border-slate-800 z-40 flex items-center justify-around px-2 py-3 safe-area-pb">
      <button
        onClick={onOpenAccount}
        className="flex flex-col items-center gap-1 p-2 text-slate-400 hover:text-white transition-colors relative"
      >
        <UserCheck className="w-5 h-5 text-emerald-450" />
        <span className="text-[10px] font-medium">Account</span>
        {unreadMessagesCount > 0 && (
          <span className="absolute top-1 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
        )}
      </button>

      <button
        onClick={onOpenRules}
        className="flex flex-col items-center gap-1 p-2 text-slate-400 hover:text-white transition-colors"
      >
        <HelpCircle className="w-5 h-5 text-blue-400" />
        <span className="text-[10px] font-medium">Rules</span>
      </button>

      {user.isAdmin && (
        <button
          onClick={onOpenAdmin}
          className="flex flex-col items-center gap-1 p-2 text-purple-400 hover:text-purple-300 transition-colors"
        >
          <Lock className="w-5 h-5" />
          <span className="text-[10px] font-medium">Admin</span>
        </button>
      )}

      <button
        onClick={onLogout}
        className="flex flex-col items-center gap-1 p-2 text-slate-400 hover:text-red-400 transition-colors"
      >
        <LogOut className="w-5 h-5" />
        <span className="text-[10px] font-medium">Logout</span>
      </button>
    </div>
  );
}
