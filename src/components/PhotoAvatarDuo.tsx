import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface PhotoAvatarDuoProps {
  photoUrl?: string | null;
  avatarUrl?: string | null;
  /** Fallback initials shown when there is no photo. */
  initials?: string;
  size?: "sm" | "md" | "lg";
  /** lg only: caption each image ("Photo" / "Avatar"). */
  showLabels?: boolean;
  className?: string;
}

const SIZES = {
  sm: { img: "w-9 h-9", overlap: "-ml-3", ring: "p-[2px]", text: "text-xs" },
  md: { img: "w-14 h-14", overlap: "-ml-4", ring: "p-[2.5px]", text: "text-lg" },
  lg: { img: "w-24 h-24", overlap: "-ml-6", ring: "p-[3px]", text: "text-2xl" },
};

/**
 * The real photo and the Dance Exclusive cartoon avatar, together. Staff and
 * parents always see the genuine photo of the child right next to the avatar —
 * the avatar never replaces it. With both present the pair overlaps slightly
 * (photo in front, avatar behind with a brand-gradient ring); with labels on
 * (lg) they sit side by side, captioned. Falls back to a single image or
 * initials when only one (or neither) exists.
 */
const PhotoAvatarDuo = ({ photoUrl, avatarUrl, initials, size = "md", showLabels = false, className }: PhotoAvatarDuoProps) => {
  const s = SIZES[size];

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

  if (showLabels && avatarUrl) {
    return (
      <div className={cn("flex items-start justify-center gap-4", className)}>
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
  }

  if (!avatarUrl) return <div className={cn("shrink-0", className)}>{photoImg}</div>;

  return (
    <div className={cn("flex items-center shrink-0", className)}>
      <div className="relative z-10">{photoImg}</div>
      <div className={s.overlap}>{avatarImg}</div>
    </div>
  );
};

export default PhotoAvatarDuo;
