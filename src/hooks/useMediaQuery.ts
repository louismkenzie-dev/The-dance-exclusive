import { useCallback, useSyncExternalStore } from "react";

/**
 * Reactive media query with a synchronous first value, so a component can
 * pick "bottom sheet on a phone, dialog on a desktop" on its first render
 * rather than flashing the wrong one.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback((update: () => void) => {
    const mq = window.matchMedia(query);
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [query]);
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
}

/** Below Tailwind's md breakpoint: a phone, or a very narrow window. */
export const useIsPhone = () => useMediaQuery("(max-width: 767px)");
