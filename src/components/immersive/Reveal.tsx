import type { ReactNode } from "react";
import { FadeRise } from "@/components/motion";

/**
 * Scroll-reveal wrapper (compat shim) — now a soft spring FadeRise.
 * Respects prefers-reduced-motion via the motion kit.
 */
export function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <FadeRise className={className} delay={delay}>
      {children}
    </FadeRise>
  );
}

export default Reveal;
