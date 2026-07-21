// Every booking — child or adult self-booking — must reference an attendee
// profile so the class register knows who is attending.

export interface AttendeeProfileFields {
  id: string;
  date_of_birth: string | null;
}

/** Complete enough to book: the profile exists and has a date of birth (age). */
export const isAttendeeProfileComplete = (
  s: AttendeeProfileFields | null | undefined,
): boolean => !!s && !!s.date_of_birth;

/** Human explanation for why a profile blocks booking (null = it doesn't). */
export const attendeeProfileGap = (
  s: AttendeeProfileFields | null | undefined,
): string | null => {
  if (!s) return "No attendee profile yet";
  if (!s.date_of_birth) return "Date of birth missing";
  return null;
};
