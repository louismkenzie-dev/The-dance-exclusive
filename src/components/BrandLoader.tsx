import { useEffect, useState } from "react";
import logo from "@/assets/logo-avatar-512.png";

/** Full-screen branded loading state: the logo splat animation (rendered with
 *  Remotion, public/brand/loading-splat.mp4) on the app's background.
 *  Falls back to the static logo for reduced-motion users or if the video
 *  can't play. On the dark themes the backdrop matches the video's baked-in
 *  background so the frame edge is invisible; on the light booking theme the
 *  animation sits as a rounded brand tile. */
/** The splat animation on its own, for inline loading states (e.g. payment
 *  confirmation). Renders the static logo for reduced-motion users or when
 *  the video can't play. Give it a size via className; note the video has the
 *  dark app background baked in, so it belongs on dark surfaces. */
export const SplatVideo = ({ className = "" }: { className?: string }) => {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  if (reducedMotion || videoFailed) {
    return <img src={logo} alt="" className={`animate-pulse rounded-2xl ${className}`} />;
  }
  return (
    <video
      src="/brand/loading-splat.mp4"
      autoPlay
      muted
      loop
      playsInline
      onError={() => setVideoFailed(true)}
      className={`object-cover rounded-2xl ${className}`}
    />
  );
};

const BrandLoader = ({ label = "Loading" }: { label?: string }) => (
  <div
    role="status"
    aria-label={label}
    className="flex min-h-screen flex-col items-center justify-center gap-5 bg-background text-foreground"
  >
    <SplatVideo className="h-48 w-48 md:h-56 md:w-56" />
    <p className="animate-pulse text-[13px] font-medium text-muted-foreground">{label}</p>
  </div>
);

export default BrandLoader;
