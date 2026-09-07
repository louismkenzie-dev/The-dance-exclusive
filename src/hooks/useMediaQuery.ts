import { useEffect, useState } from "react";

/**
 * Reactive media query with a synchronous first value, so a component can
 * pick "bottom sheet on a phone, dialog on a desktop" on its first render
 * rather than flashing the wrong one.
 */
export function useMediaQuery(query: string): boolean {
  const get = () => (typeof window !== "undefined" ? window.matchMedia(query).matches : false);
  const [matches, setMatches] = useState<boolean>(get);

  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setMatches(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [query]);

  return matches;
}

/** Below Tailwind's md breakpoint: a phone, or a very narrow window. */
export const useIsPhone = () => useMediaQuery("(max-width: 767px)");
