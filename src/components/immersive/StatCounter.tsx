import { AnimatedNumber } from "@/components/motion";

/** Animated count-up that fires once when scrolled into view (compat shim). */
export function StatCounter({
  value,
  prefix = "",
  suffix = "",
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
}) {
  return <AnimatedNumber value={value} prefix={prefix} suffix={suffix} />;
}

export default StatCounter;
