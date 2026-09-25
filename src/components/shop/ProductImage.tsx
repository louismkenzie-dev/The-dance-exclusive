import { useState } from "react";
import { RotateCw } from "lucide-react";
import { useHasHover, usePrefersReducedMotion } from "@/hooks/useMediaQuery";
import { getMediaUrl } from "@/lib/merchMediaUrl";
import { frontMedia, backMedia, type MerchMediaLike } from "@/lib/merchMedia";

export type ShopMedia = MerchMediaLike & {
  position?: string | null;
  zoom?: number | null;
};

/**
 * Product photo, honouring admin-set framing (focal point + zoom). Unframed photos keep the
 * original letterboxed "contain" look.
 */
export const ProductImage = ({
  media,
  alt,
  className = "",
}: {
  media: ShopMedia | undefined;
  alt: string;
  className?: string;
}) => {
  const framed = !!(media?.position || media?.zoom);
  if (!framed) {
    return (
      <img
        src={getMediaUrl(media?.file_path)}
        alt={alt}
        loading="lazy"
        className={`relative h-full w-full object-contain p-6 ${className}`}
      />
    );
  }
  const pos = media?.position || "50% 50%";
  const zoom = Number(media?.zoom) > 0 ? Number(media?.zoom) : 1;
  return (
    <img
      src={getMediaUrl(media?.file_path)}
      alt={alt}
      loading="lazy"
      className={`relative h-full w-full object-cover ${className}`}
      style={{ objectPosition: pos, transform: zoom !== 1 ? `scale(${zoom})` : undefined, transformOrigin: pos }}
    />
  );
};

/**
 * A product photo that shows the reverse of the garment on hover, so a parent sees the front and
 * back print without opening anything.
 *
 * Deliberate choices:
 * - The flip is also a real button, not hover alone. Phones and tablets cannot hover, and tapping
 *   the tile itself has to keep opening the product — so hijacking that tap would cost a sale.
 *   The button is the affordance on touch and the hint on desktop.
 * - Under prefers-reduced-motion it crossfades instead of rotating. A grid of spinning tiles is
 *   exactly what that setting exists to prevent.
 * - A product with only one photo does not animate at all and renders no button.
 */
export const ProductFlipImage = ({
  media,
  alt,
  className = "",
}: {
  media: ShopMedia[] | null | undefined;
  alt: string;
  className?: string;
}) => {
  const [flipped, setFlipped] = useState(false);
  const hasHover = useHasHover();
  const reduceMotion = usePrefersReducedMotion();

  const front = frontMedia(media);
  const back = backMedia(media);

  if (!back) return <ProductImage media={front} alt={alt} className={className} />;

  const showBack = flipped;

  if (reduceMotion) {
    return (
      <div className={`group/flip relative h-full w-full ${hasHover ? "[&:hover_.flip-back]:opacity-100 [&:hover_.flip-front]:opacity-0" : ""}`}>
        <div className={`flip-front absolute inset-0 transition-opacity duration-200 ${showBack ? "opacity-0" : "opacity-100"}`}>
          <ProductImage media={front} alt={alt} className={className} />
        </div>
        <div className={`flip-back absolute inset-0 transition-opacity duration-200 ${showBack ? "opacity-100" : "opacity-0"}`}>
          <ProductImage media={back} alt={`${alt} — back`} className={className} />
        </div>
        <FlipButton flipped={showBack} onToggle={() => setFlipped((f) => !f)} alt={alt} />
      </div>
    );
  }

  return (
    <div className="group/flip relative h-full w-full [perspective:1000px]">
      <div
        className={[
          "relative h-full w-full transition-transform duration-500 ease-out [transform-style:preserve-3d]",
          showBack ? "[transform:rotateY(180deg)]" : "",
          hasHover ? "group-hover/flip:[transform:rotateY(180deg)]" : "",
        ].join(" ")}
      >
        <div className="absolute inset-0 [backface-visibility:hidden]">
          <ProductImage media={front} alt={alt} className={className} />
        </div>
        <div className="absolute inset-0 [transform:rotateY(180deg)] [backface-visibility:hidden]">
          <ProductImage media={back} alt={`${alt} — back`} className={className} />
        </div>
      </div>
      <FlipButton flipped={showBack} onToggle={() => setFlipped((f) => !f)} alt={alt} />
    </div>
  );
};

const FlipButton = ({ flipped, onToggle, alt }: { flipped: boolean; onToggle: () => void; alt: string }) => (
  <button
    type="button"
    onClick={(e) => {
      // The tile behind this opens the product; flipping must not trigger that.
      e.stopPropagation();
      e.preventDefault();
      onToggle();
    }}
    aria-pressed={flipped}
    aria-label={flipped ? `Show the front of ${alt}` : `Show the back of ${alt}`}
    className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-background/80 text-muted-foreground backdrop-blur transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  >
    <RotateCw className={`h-4 w-4 transition-transform duration-500 ${flipped ? "rotate-180" : ""}`} />
  </button>
);
