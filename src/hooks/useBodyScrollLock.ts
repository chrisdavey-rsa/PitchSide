import { useEffect } from 'react';

/** Nested-safe counter so stacked overlays don't unlock body early. */
let lockCount = 0;
let savedScrollY = 0;

/**
 * Locks document scrolling while `locked` is true.
 * Uses position:fixed on body so mobile browsers (iOS/Android) cannot scroll
 * content behind full-screen overlays / account panels.
 */
export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;

    if (lockCount === 0) {
      savedScrollY = window.scrollY;
      document.documentElement.classList.add('overflow-hidden');
      document.body.classList.add('overflow-hidden');
      document.body.style.position = 'fixed';
      document.body.style.top = `-${savedScrollY}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.width = '100%';
    }
    lockCount += 1;

    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) {
        document.documentElement.classList.remove('overflow-hidden');
        document.body.classList.remove('overflow-hidden');
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.width = '';
        window.scrollTo(0, savedScrollY);
      }
    };
  }, [locked]);
}
