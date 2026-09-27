import { photoFromSrc, photoSrcSet } from "@/lib/tdeMedia";
import { useEffect, useRef, useState, type CSSProperties } from "react";

export interface WorkshopCoverFraming {
  cover_position?: string | null;
  cover_zoom?: number | null;
  cover_fit?: string | null;
}

interface WorkshopCoverProps extends WorkshopCoverFraming {
  src: string;
  alt?: string;
  className?: string;
  style?: CSSProperties;
  loading?: "lazy" | "eager";
  onError?: () => void;
  srcSet?: string;
  sizes?: string;
  revealWhenLoaded?: boolean;
}

/** Workshop (type-of-class) cover art with the admin-set framing applied —
 *  focal point + zoom for cropped cards, or "contain" to show the whole
 *  image (square logo artwork) letterboxed inside the frame. Render inside
 *  a sized container; the image fills it. */
const WorkshopCover = ({ src, alt = "", className = "", cover_position, cover_zoom, cover_fit, style, loading, onError, srcSet, sizes, revealWhenLoaded = false }: WorkshopCoverProps) => {
  const imageRef = useRef<HTMLImageElement>(null);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!revealWhenLoaded) return;
    const image = imageRef.current;
    if (!image) return;
    let active = true;
    const reveal = async () => {
      if (!image.naturalWidth) return;
      try { await image.decode?.(); } catch { /* A loaded image can still be displayed. */ }
      if (active) setLoadedSrc(src);
    };
    image.addEventListener("load", reveal);
    if (image.complete) void reveal(); // Includes images loaded before hydration.
    return () => { active = false; image.removeEventListener("load", reveal); };
  }, [src, revealWhenLoaded]);
  const photo = photoFromSrc(src);
  const responsive = srcSet ? { srcSet, sizes } : photo ? { srcSet: photoSrcSet(photo), sizes: sizes ?? "(max-width: 768px) 100vw, 720px", width: photo.width, height: photo.height } : {};
  const revealStyle = revealWhenLoaded && loadedSrc !== src ? { opacity: 0 } : {};
  if (cover_fit === "contain") {
    return <img ref={imageRef} {...responsive} loading={loading} decoding="async" onError={onError} src={src} alt={alt} className={`w-full h-full object-contain ${className}`} style={{ ...style, ...revealStyle }} />;
  }
  const pos = cover_position ?? "50% 25%";
  const zoom = Number(cover_zoom) > 1 ? Number(cover_zoom) : 1;
  return (
    <img
      ref={imageRef}
      {...responsive}
      loading={loading}
      decoding="async"
      onError={onError}
      src={src}
      alt={alt}
      className={`w-full h-full object-cover ${className}`}
      style={{
        objectPosition: pos,
        ...(zoom !== 1 ? { transform: `scale(${zoom})`, transformOrigin: pos } : {}),
        ...style,
        ...revealStyle,
      }}
    />
  );
};

export default WorkshopCover;
