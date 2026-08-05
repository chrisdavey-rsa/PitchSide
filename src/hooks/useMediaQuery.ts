import { useEffect, useState } from 'react';

/**
 * Subscribe to a CSS media query. SSR-safe (defaults to `false` when `window` is missing).
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** Tailwind `md` breakpoint — screens narrower than 768px. */
export function useIsMobileViewport(): boolean {
  return useMediaQuery('(max-width: 767px)');
}
