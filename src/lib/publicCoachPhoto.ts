import portraits from "./coachPortraits.json";
import { coachPhotoUrl } from "./staffPhoto";
import type { PublicCoach } from "./publicSchool";

/** Only replace the photographed source; a staff photo update takes precedence. */
export function publicCoachPhoto(coach: Pick<PublicCoach, "id" | "profile_photo">) {
  const portrait = portraits[coach.id as keyof typeof portraits];
  return portrait && portrait.source === coach.profile_photo
    ? portrait.portrait
    : coachPhotoUrl(coach.profile_photo);
}
