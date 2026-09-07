import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionHeadingProps {
  /** Small label above the title, e.g. "Children's classes". */
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Something aligned to the right on wide screens (a count, a link). */
  aside?: ReactNode;
  as?: "h1" | "h2" | "h3";
  size?: "page" | "section";
  className?: string;
}

/** Page and section titles with one consistent scale. */
export function SectionHeading({ eyebrow, title, subtitle, aside, as = "h2", size = "section", className }: SectionHeadingProps) {
  const Tag = as;
  return (
    <div className={cn("flex items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        {eyebrow && <p className="mb-1.5 text-[13px] font-medium text-muted-foreground">{eyebrow}</p>}
        <Tag
          className={cn(
            "font-semibold tracking-tight text-foreground",
            size === "page" ? "text-[28px] leading-[1.15] sm:text-4xl" : "text-xl sm:text-2xl",
          )}
        >
          {title}
        </Tag>
        {subtitle && <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">{subtitle}</p>}
      </div>
      {aside && <div className="shrink-0">{aside}</div>}
    </div>
  );
}

export default SectionHeading;
