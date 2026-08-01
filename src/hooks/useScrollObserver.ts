import { useEffect, useState } from "react";

/**
 * Tracks whether `target` has left the viewport via IntersectionObserver.
 * `isScrolledPastTop` is true when the element is not intersecting.
 */
export function useScrollObserver(
  target: Element | null,
  options?: IntersectionObserverInit,
): boolean {
  const [isScrolledPastTop, setIsScrolledPastTop] = useState(false);

  useEffect(() => {
    if (!target) {
      setIsScrolledPastTop(false);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsScrolledPastTop(!entry.isIntersecting);
      },
      {
        threshold: 0,
        root: options?.root ?? null,
        rootMargin: options?.rootMargin ?? "0px",
      },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [target, options?.root, options?.rootMargin]);

  return isScrolledPastTop;
}
