import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AdminPageProps {
  children: ReactNode;
  className?: string;
  /** Leave room at the bottom for a floating action button. */
  hasFab?: boolean;
}

/**
 * Every admin and staff screen sits in one of these. It carries the two
 * classes that make a web page behave like an app — `app-screen` (no tap
 * flash, no double-tap zoom, 16px fields so iOS never zooms in) and
 * `portal-ui` (headings in the body face, sentence case, the way the parent
 * booking journey reads) — plus the page gutter and rhythm, so no screen has
 * to reinvent its own padding.
 */
export function AdminPage({ children, className, hasFab = false }: AdminPageProps) {
  return (
    <div
      className={cn(
        "app-screen portal-ui mx-auto w-full max-w-6xl px-4 pt-5 sm:px-6 sm:pt-8",
        // Phone screens end above the FAB and the home indicator; desktop
        // just needs breathing room.
        hasFab ? "pb-28 sm:pb-12" : "pb-16 sm:pb-12",
        className,
      )}
    >
      {children}
    </div>
  );
}

export default AdminPage;
