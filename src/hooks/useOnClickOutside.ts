import { useEffect, useRef, type RefObject } from "react";

/**
 * Call `handler` when a pointer/touch lands outside `ref`.
 */
export function useOnClickOutside<T extends HTMLElement>(
  ref: RefObject<T | null>,
  handler: () => void,
  enabled = true,
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) return;

    const onPointer = (event: MouseEvent | TouchEvent) => {
      const el = ref.current;
      const target = event.target;
      if (!(target instanceof Node) || !el) return;
      if (el.contains(target)) return;
      handlerRef.current();
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") handlerRef.current();
    };

    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [enabled, ref]);
}
