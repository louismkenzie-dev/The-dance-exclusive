import { photoSrcSet, type SchoolPhoto as Photo } from "@/lib/tdeMedia";

export function SchoolPhoto({ photo, className, sizes = "(max-width: 640px) 100vw, 50vw", eager = false, decorative = false }: {
  photo: Photo;
  className?: string;
  sizes?: string;
  eager?: boolean;
  decorative?: boolean;
}) {
  return <img src={photo.src} srcSet={photoSrcSet(photo)} sizes={sizes}
    width={photo.width} height={photo.height} alt={decorative ? "" : photo.alt}
    loading={eager ? "eager" : "lazy"} decoding="async" className={className}
    style={{ objectPosition: photo.position }} />;
}
