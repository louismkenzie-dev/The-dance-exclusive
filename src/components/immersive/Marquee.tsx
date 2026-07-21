/**
 * Retired in the Studio Light redesign — marquee tickers are no longer part of
 * the design language. Kept as a no-op so legacy imports compile until swept.
 */
export function Marquee(_props: {
  items: string[];
  className?: string;
  reverse?: boolean;
  speed?: number;
  accent?: string;
}) {
  return null;
}

export default Marquee;
