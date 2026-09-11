import inkWordmark from "@/assets/logo-wordmark-ink.png";
import whiteWordmark from "@/assets/logo-wordmark-white.png";
import { cn } from "@/lib/utils";

/**
 * The Dance Exclusive wordmark, in the colourway that reads on the ground it
 * is sitting on: ink on a light background, white on a dark one. Both are
 * the same silhouette, so they line up exactly when a screen switches theme.
 *
 * This is the mark WITHOUT the splat. The splat version is square and the
 * lettering only fills about a third of it, so in a top bar it rendered
 * tiny with a ring of empty space around it. This one is 2.13:1 and the
 * type fills the frame, which is why callers set a HEIGHT and let the width
 * follow — a fixed square box would squash it.
 *
 * The splat mark is still right where it has room to breathe (the marketing
 * site, the app icon, email); this is for the product's own chrome.
 */
export function BrandLogo({
  tone,
  className,
}: {
  /** Which ground it sits on — "ink" for light, "white" for dark. */
  tone: "ink" | "white";
  /** Size it with a height class; the width follows the artwork. */
  className?: string;
}) {
  return (
    <img
      src={tone === "ink" ? inkWordmark : whiteWordmark}
      alt="The Dance Exclusive"
      className={cn("w-auto object-contain", className)}
    />
  );
}

export default BrandLogo;
