import type { ReactNode } from "react";
import { MotionMedia } from "@/components/marketing/MotionMedia";

/** A shared dance-led opening for public discovery pages. */
export function DiscoveryHero({ eyebrow, title, description, image, alt = "", children }: {
  eyebrow: string;
  title: ReactNode;
  description: string;
  image?: string;
  alt?: string;
  children?: ReactNode;
}) {
  return (
    <header className={`tde-discovery-hero${image ? " tde-discovery-with-photo" : ""}`}>
      <div className="tde-page-top">
        <span className="tde-eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
        {children}
      </div>
      {image && (
        <div className="tde-discovery-photo">
          <MotionMedia image={image} alt={alt} eager travel={28} />
          <span className="tde-photo-sticker" aria-hidden="true">Dance. Grow. Achieve. ↗</span>
        </div>
      )}
    </header>
  );
}
