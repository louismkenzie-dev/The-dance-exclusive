import PhotoAvatarDuo from "@/components/PhotoAvatarDuo";
import { cn } from "@/lib/utils";

interface AttendeeAvatarProps {
  initials: string;
  photoUrl?: string | null;
  avatarUrl?: string | null;
  /** Let a tap open the photo/avatar lightbox when there is a picture. */
  expandable?: boolean;
  className?: string;
}

/**
 * Who a booking is for, as a small circle: the child's photo and Dance
 * Exclusive avatar when they exist (tap to enlarge), otherwise initials on a
 * muted disc. Keeps the same lightbox behaviour parents already have.
 */
export function AttendeeAvatar({ initials, photoUrl, avatarUrl, expandable = true, className }: AttendeeAvatarProps) {
  if (photoUrl || avatarUrl) {
    return (
      <PhotoAvatarDuo
        photoUrl={photoUrl}
        avatarUrl={avatarUrl}
        initials={initials}
        size="sm"
        photoPrimary={false}
        expandable={expandable}
        className={className}
      />
    );
  }
  return (
    <span
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-[13px] font-semibold text-foreground",
        className,
      )}
      aria-hidden
    >
      {initials}
    </span>
  );
}

export default AttendeeAvatar;
