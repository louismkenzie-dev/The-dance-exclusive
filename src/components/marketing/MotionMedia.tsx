import { useEffect, useRef, useState } from "react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { photoFromSrc, photoSrcSet } from "@/lib/tdeMedia";
import { onScrollFrame } from "@/lib/scrollFrame";

/** Bounded image parallax and in-view video; scrolling itself stays native. */
export function MotionMedia({
  image,
  video,
  mobileVideo,
  alt,
  className = "",
  active = true,
  eager = false,
  travel = 44,
  sizes = "100vw",
  objectPosition,
}: {
  image: string;
  video?: string;
  mobileVideo?: string;
  alt: string;
  className?: string;
  active?: boolean;
  eager?: boolean;
  travel?: number;
  sizes?: string;
  objectPosition?: string;
}) {
  const photo = photoFromSrc(image);
  const container = useRef<HTMLDivElement>(null);
  const film = useRef<HTMLVideoElement>(null);
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const desktop = useMediaQuery("(min-width: 1024px) and (pointer: fine)");
  const [source, setSource] = useState<string>();
  const [loaded, setLoaded] = useState(eager);
  const [visible, setVisible] = useState(eager);
  const [failed, setFailed] = useState(false);
  const canMove = active && !reduced;

  useEffect(() => {
    setSource(mobileVideo && window.matchMedia("(max-width: 760px)").matches ? mobileVideo : video);
    const element = container.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry.isIntersecting);
        if (entry.isIntersecting) setLoaded(true);
      },
      { rootMargin: "160px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [video, mobileVideo]);

  useEffect(() => {
    const element = container.current;
    if (!element || !canMove || !visible || !desktop || travel === 0) {
      if (!canMove || !desktop) element?.style.setProperty("--media-shift", "0px");
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
  }, [canMove, visible, travel, desktop]);

  useEffect(() => {
    const video = film.current;
    if (!video) return;
    video.muted = true;
    const update = () => {
      if (visible && canMove && !failed && !document.hidden) void video.play().catch(() => {});
      else video.pause();
    };
    update();
    document.addEventListener("visibilitychange", update);
    return () => { document.removeEventListener("visibilitychange", update); video.pause(); };
  }, [visible, canMove, failed, source, loaded, reduced]);

  return (
    <div ref={container} className={`tde-media ${className}`}>
      <div className="tde-media-layer">
        <img
          src={image}
          srcSet={photo ? photoSrcSet(photo) : undefined}
          sizes={photo ? sizes : undefined}
          width={photo?.width}
          height={photo?.height}
          style={{ objectPosition: objectPosition ?? photo?.position }}
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          {...{ fetchpriority: eager ? "high" : "auto" }}
          decoding="async"
        />
        {source && loaded && !reduced && !failed && (
          <video
            ref={film}
            src={source}
            poster={image}
            muted
            loop
            playsInline
            preload={eager ? "auto" : "metadata"}
            aria-hidden="true"
            onError={() => setFailed(true)}
          />
        )}
      </div>
    </div>
  );
}
