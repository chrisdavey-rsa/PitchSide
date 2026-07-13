import { useState, useEffect, useCallback } from 'react';

const MESSAGES_KEY = 'pitchside_messages';
const MESSAGES_EVENT = 'pitchside-messages-updated';

export function notifyMessagesUpdated() {
  window.dispatchEvent(new Event(MESSAGES_EVENT));
}

export function useUnreadMessages(userId?: string) {
  const [unreadCount, setUnreadCount] = useState(0);

  const checkUnread = useCallback(() => {
    if (!userId) {
      setUnreadCount(0);
      return;
    }
    const stored = JSON.parse(localStorage.getItem(MESSAGES_KEY) || '[]');
    const myMessages = stored.filter(
      (m: { receiverId?: string }) => m.receiverId === userId || m.receiverId === 'all',
    );
    setUnreadCount(myMessages.filter((m: { read?: boolean }) => !m.read).length);
  }, [userId]);

  useEffect(() => {
    checkUnread();

    const onStorage = (event: StorageEvent) => {
      if (event.key === MESSAGES_KEY || event.key === null) {
        checkUnread();
      }
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener(MESSAGES_EVENT, checkUnread);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(MESSAGES_EVENT, checkUnread);
    };
  }, [checkUnread]);

  return unreadCount;
}
