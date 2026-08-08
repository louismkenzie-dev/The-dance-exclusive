import { useEffect, useState } from "react";
import logo from "@/assets/logo-avatar-512.png";

/** Full-screen branded loading state: the logo splat animation (rendered with
 *  Remotion, public/brand/loading-splat.mp4) on the app's dark background.
 *  Falls back to the static logo for reduced-motion users or if the video
 *  can't play. The backdrop colour matches the video's baked-in background so
 *  the frame edge is invisible. */
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
    return <img src={logo} alt="" className={`animate-pulse ${className}`} />;
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
    className="min-h-screen flex flex-col items-center justify-center"
    style={{ backgroundColor: "hsl(220, 20%, 4%)" }}
  >
    <SplatVideo className="w-56 h-56 md:w-72 md:h-72" />
    <p
      className="text-xs uppercase tracking-[0.3em] animate-pulse"
      style={{ color: "hsl(193, 100%, 44%)", fontFamily: "var(--font-body)" }}
    >
      {label}
    </p>
  </div>
);

export default BrandLoader;
