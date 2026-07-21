/**
 * "Studio Light" motion kit — springy, physical, restrained (Bevel-grade).
 * All primitives respect prefers-reduced-motion automatically.
 */
import {
  Children,
  type CSSProperties,
  type ElementType,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { motion, useInView, useReducedMotion, useSpring } from "motion/react";

const spring = { type: "spring" as const, stiffness: 120, damping: 20, mass: 0.9 };

/** Fades + rises into view once, with a soft spring. */
export function FadeRise({
  children,
  className = "",
  delay = 0,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  /** milliseconds */
  delay?: number;
  as?: ElementType;
}) {
  const reduce = useReducedMotion();
  const Tag = (motion as unknown as Record<string, typeof motion.div>)[as as string] ?? motion.div;
  return (
    <Tag
      className={className}
      initial={reduce ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -8% 0px" }}
      transition={{ ...spring, delay: delay / 1000 }}
    >
      {children}
    </Tag>
  );
}

/** Staggers its direct children in as they enter the viewport. */
export function Stagger({
  children,
  className = "",
  step = 80,
  childClassName = "",
}: {
  children: ReactNode;
  className?: string;
  /** ms between children */
  step?: number;
  childClassName?: string;
}) {
  return (
    <div className={className}>
      {Children.map(children, (child, i) => (
        <FadeRise delay={i * step} className={childClassName}>
          {child}
        </FadeRise>
      ))}
    </div>
  );
}

/** Springy count-up that fires once in view. Drop-in for numeric stats. */
export function AnimatedNumber({
  value,
  prefix = "",
  suffix = "",
  className = "",
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const reduce = useReducedMotion();
  const spr = useSpring(0, { stiffness: 60, damping: 18, mass: 1 });
  const [n, setN] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setN(value);
      return;
    }
    spr.set(value);
  }, [inView, value, reduce, spr]);

  useEffect(() => spr.on("change", (v) => setN(Math.round(v))), [spr]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {n.toLocaleString()}
      {suffix}
    </span>
  );
}

/** Soft ambient aurora wash behind a section. Absolute-positioned; parent must be relative. */
export function AmbientGlow({
  variant = "light",
  className = "",
}: {
  variant?: "light" | "night" | "duo";
  className?: string;
}) {
  const cls =
    variant === "night" ? "aurora-night" : variant === "duo" ? "aurora-duo" : "aurora";
  return <div aria-hidden className={`pointer-events-none absolute inset-0 ${cls} ${className}`} />;
}

/** Wraps a tappable element: scales down on press with a spring back. */
export function PressScale({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      style={style}
      whileTap={reduce ? undefined : { scale: 0.97 }}
      transition={spring}
    >
      {children}
    </motion.div>
  );
}
