import type { CSSProperties } from "react";

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
}

/** Workshop (type-of-class) cover art with the admin-set framing applied —
 *  focal point + zoom for cropped cards, or "contain" to show the whole
 *  image (square logo artwork) letterboxed inside the frame. Render inside
 *  a sized container; the image fills it. */
const WorkshopCover = ({ src, alt = "", className = "", cover_position, cover_zoom, cover_fit, style }: WorkshopCoverProps) => {
  if (cover_fit === "contain") {
    return <img src={src} alt={alt} className={`w-full h-full object-contain ${className}`} style={style} />;
  }
  const pos = cover_position ?? "50% 25%";
  const zoom = Number(cover_zoom) > 1 ? Number(cover_zoom) : 1;
  return (
    <img
      src={src}
      alt={alt}
      className={`w-full h-full object-cover ${className}`}
      style={{
        objectPosition: pos,
        ...(zoom !== 1 ? { transform: `scale(${zoom})`, transformOrigin: pos } : {}),
        ...style,
      }}
    />
  );
};

export default WorkshopCover;
