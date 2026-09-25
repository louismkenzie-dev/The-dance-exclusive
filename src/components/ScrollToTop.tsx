import { useEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * SPAs keep the old scroll position when the route changes, so tapping
 * through to a new page on a phone lands you halfway down it. Start every
 * NEW page at the top; back/forward (POP) keeps the browser-restored
 * position so returning to a long list doesn't lose your place.
 */
const ScrollToTop = () => {
  const { pathname, key } = useLocation();
  const previousPath = useRef(pathname);
  const navigationType = useNavigationType();

  useEffect(() => {
    // A navigation link may change only an audience query parameter. Filters
    // use REPLACE and keep the reader by the controls; links use PUSH.
    if (navigationType !== "POP" && (navigationType === "PUSH" || previousPath.current !== pathname)) {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
    }
    previousPath.current = pathname;
  }, [pathname, key, navigationType]);

  return null;
};

export default ScrollToTop;
