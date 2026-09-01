import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * SPAs keep the old scroll position when the route changes, so tapping
 * through to a new page on a phone lands you halfway down it. Start every
 * NEW page at the top; back/forward (POP) keeps the browser-restored
 * position so returning to a long list doesn't lose your place.
 */
const ScrollToTop = () => {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (navigationType !== "POP") {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
    }
  }, [pathname, navigationType]);

  return null;
};

export default ScrollToTop;
