import { useEffect, useRef, useState } from "react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { onScrollFrame } from "@/lib/scrollFrame";

/** Bounded image parallax and in-view video; scrolling itself stays native. */
export function MotionMedia({
  image,
  video,
  alt,
  className = "",
  active = true,
  eager = false,
  travel = 44,
}: {
  image: string;
  video?: string;
  alt: string;
  className?: string;
  active?: boolean;
  eager?: boolean;
  travel?: number;
}) {
  const container = useRef<HTMLDivElement>(null);
  const film = useRef<HTMLVideoElement>(null);
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [visible, setVisible] = useState(eager);
  const [failed, setFailed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const canMove = active && !reduced;

  useEffect(() => {
    setMounted(true);
    const element = container.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: "160px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = container.current;
    if (!element || !canMove || !visible) {
      if (reduced) element?.style.setProperty("--media-shift", "0px");
      return;
    }
    return onScrollFrame(() => {
      const rect = element.getBoundingClientRect();
      const progress = Math.max(
        -1,
        Math.min(
          1,
          (window.innerHeight / 2 - rect.top - rect.height / 2) /
            window.innerHeight,
        ),
      );
      return () =>
        element.style.setProperty(
          "--media-shift",
          `${(progress * travel).toFixed(2)}px`,
        );
    });
  }, [canMove, visible, travel, reduced]);

  useEffect(() => {
    if (!film.current) return;
    if (visible && canMove && !failed) void film.current.play().catch(() => {});
    else film.current.pause();
  }, [visible, canMove, failed, mounted]);

  return (
    <div ref={container} className={`tde-media ${className}`}>
      <div className="tde-media-layer">
        <img
          src={image}
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          {...{ fetchpriority: eager ? "high" : "auto" }}
          decoding="async"
        />
        {video && mounted && !reduced && !failed && (
          <video
            ref={film}
            src={visible ? video : undefined}
            poster={image}
            muted
            loop
            playsInline
            preload="none"
            aria-hidden="true"
            onError={() => setFailed(true)}
          />
        )}
      </div>
    </div>
  );
}
