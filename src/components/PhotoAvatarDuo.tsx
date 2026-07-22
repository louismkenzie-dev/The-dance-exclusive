import { useState, type ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface PhotoAvatarDuoProps {
  photoUrl?: string | null;
  avatarUrl?: string | null;
  /** Fallback initials shown when there is no photo. */
  initials?: string;
  size?: "sm" | "md" | "lg";
  /** lg only: caption each image ("Photo" / "Avatar"). */
  showLabels?: boolean;
  /**
   * true (default): the real photo is the front/primary circle — the right
   * default for staff safeguarding views, where identifying the actual child
   * comes first. Pass false on parent-facing screens to let the Dance
   * Exclusive avatar lead with the photo tucked behind it.
   */
  photoPrimary?: boolean;
  /** Wraps the duo in a button that opens a lightbox showing photo and avatar large. */
  expandable?: boolean;
  className?: string;
}

const SIZES = {
  sm: { img: "w-12 h-12", overlap: "-ml-4", ring: "p-[2.5px]", text: "text-sm" },
  md: { img: "w-20 h-20", overlap: "-ml-6", ring: "p-[3px]", text: "text-xl" },
  lg: { img: "w-32 h-32", overlap: "-ml-8", ring: "p-[3.5px]", text: "text-3xl" },
};

/**
 * The real photo and the Dance Exclusive cartoon avatar, together. Staff and
 * parents always see the genuine photo of the child right next to the avatar —
 * the avatar never replaces it. With both present the pair overlaps slightly;
 * `photoPrimary` (default true) keeps the real photo in front for staff
 * safeguarding views, while parent-facing screens pass false so the avatar
 * leads. With labels on (lg) they sit side by side, captioned. Falls back to a
 * single image or initials when only one (or neither) exists. Set `expandable`
 * to make the duo clickable, opening a lightbox with both images large,
 * captioned "Photo" / "Avatar".
 */
const PhotoAvatarDuo = ({
  photoUrl,
  avatarUrl,
  initials,
  size = "md",
  showLabels = false,
  photoPrimary = true,
  expandable = false,
  className,
}: PhotoAvatarDuoProps) => {
  const s = SIZES[size];
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const photoImg = photoUrl ? (
    <img src={photoUrl} alt="" className={cn(s.img, "rounded-full object-cover border-2 border-border bg-muted")} />
  ) : (
    <div className={cn(s.img, "rounded-full bg-muted border-2 border-border flex items-center justify-center font-bold text-muted-foreground", s.text)}>
      {initials || "?"}
    </div>
  );

  const avatarImg = avatarUrl ? (
    <div className={cn("rounded-full bg-gradient-to-br from-sky-400 via-primary to-pink-500 shrink-0", s.ring)}>
      <img src={avatarUrl} alt="" className={cn(s.img, "rounded-full object-cover bg-background")} />
    </div>
  ) : null;

  let duo: ReactNode;
  if (showLabels && avatarUrl) {
    duo = (
      <div className="flex items-start justify-center gap-4">
        <div className="flex flex-col items-center gap-1.5">
          {photoImg}
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Photo</span>
        </div>
        <div className="flex flex-col items-center gap-1.5">
          {avatarImg}
          <span className="text-[10px] uppercase tracking-wider text-primary font-semibold flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Avatar
          </span>
        </div>
      </div>
    );
  } else if (!avatarUrl) {
    duo = photoImg;
  } else {
    const [front, back] = photoPrimary ? [photoImg, avatarImg] : [avatarImg, photoImg];
    duo = (
      <div className="flex items-center">
        <div className="relative z-10">{front}</div>
        <div className={s.overlap}>{back}</div>
      </div>
    );
  }

  if (!expandable) {
    return <div className={cn("shrink-0", className)}>{duo}</div>;
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setLightboxOpen(true);
        }}
        aria-label="View photo and avatar larger"
        className={cn(
          "shrink-0 cursor-pointer rounded-full outline-none transition-transform hover:scale-[1.03] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          className,
        )}
      >
        {duo}
      </button>
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-md" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Photo & Avatar</DialogTitle>
          </DialogHeader>
          <div className="flex items-start justify-center gap-6 py-2">
            <div className="flex flex-col items-center gap-2">
              {photoUrl ? (
                <img src={photoUrl} alt="Photo" className="w-36 h-36 sm:w-40 sm:h-40 rounded-full object-cover border-2 border-border bg-muted" />
              ) : (
                <div className="w-36 h-36 sm:w-40 sm:h-40 rounded-full bg-muted border-2 border-border flex items-center justify-center text-4xl font-bold text-muted-foreground">
                  {initials || "?"}
                </div>
              )}
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Photo</span>
            </div>
            {avatarUrl && (
              <div className="flex flex-col items-center gap-2">
                <div className="rounded-full bg-gradient-to-br from-sky-400 via-primary to-pink-500 p-[3px]">
                  <img src={avatarUrl} alt="Avatar" className="w-36 h-36 sm:w-40 sm:h-40 rounded-full object-cover bg-background" />
                </div>
                <span className="text-xs uppercase tracking-wider text-primary font-semibold flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> Avatar
                </span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PhotoAvatarDuo;
