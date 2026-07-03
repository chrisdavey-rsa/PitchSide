import React, { useState, useEffect } from 'react';
import { SiteMessage } from '../../types';
import { Mail, CheckCircle2 } from 'lucide-react';

interface MessagesProps {
  userId: string;
}

export const Messages: React.FC<MessagesProps> = ({ userId }) => {
  const [messages, setMessages] = useState<SiteMessage[]>([]);

  useEffect(() => {
    // Load messages from localStorage
    const stored = JSON.parse(localStorage.getItem('pitchside_messages') || '[]');
    const myMessages = stored.filter((m: SiteMessage) => m.receiverId === userId || m.receiverId === 'all');
    
    // Sort by latest first
    myMessages.sort((a: SiteMessage, b: SiteMessage) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setMessages(myMessages);
  }, [userId]);

  const markAsRead = (msgId: string) => {
    const stored = JSON.parse(localStorage.getItem('pitchside_messages') || '[]');
    const updated = stored.map((m: SiteMessage) => {
      if (m.id === msgId) {
        return { ...m, read: true };
      }
      return m;
    });
    localStorage.setItem('pitchside_messages', JSON.stringify(updated));
    setMessages(updated.filter((m: SiteMessage) => m.receiverId === userId || m.receiverId === 'all').sort((a: SiteMessage, b: SiteMessage) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  };

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 border border-slate-800/50 rounded-xl bg-slate-900/20">
        <Mail className="w-8 h-8 text-slate-700 mb-3" />
        <p className="text-xs text-slate-500 font-mono">No messages found in your inbox.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 font-mono">
      {messages.map((msg) => (
        <div key={msg.id} className={`p-5 border rounded-xl transition-colors ${msg.read ? 'bg-slate-900/30 border-slate-800/50' : 'bg-slate-800/40 border-amber-500/30'}`}>
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                {!msg.read && <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></span>}
                <h4 className={`text-sm font-bold ${msg.read ? 'text-slate-300' : 'text-amber-400'}`}>{msg.subject}</h4>
              </div>
              <p className="text-[10px] text-slate-500">
                {new Date(msg.createdAt).toLocaleString()} • From: System Administration
              </p>
            </div>
            {!msg.read && (
              <button 
                onClick={() => markAsRead(msg.id)}
                className="flex items-center gap-1.5 text-[9px] font-bold tracking-widest uppercase bg-slate-950 px-2 py-1.5 rounded-lg text-slate-400 hover:text-white border border-slate-800 transition-colors"
              >
                <CheckCircle2 className="w-3 h-3" /> Mark Read
              </button>
            )}
          </div>
          <div className="text-xs text-slate-300 whitespace-pre-wrap mt-4 bg-slate-950/50 p-4 rounded-lg border border-slate-800/50">
            {msg.body}
          </div>
        </div>
      ))}
    </div>
  );
};
