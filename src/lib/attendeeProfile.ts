// Every booking — child or adult self-booking — must reference an attendee
// profile with the details the class register needs.

export interface AttendeeProfileFields {
  id: string;
  date_of_birth: string | null;
  expected_arrival_time: string | null;
  expected_departure_time: string | null;
}

/** Complete enough to book: age (DOB) plus expected arrival & departure times. */
export const isAttendeeProfileComplete = (
  s: AttendeeProfileFields | null | undefined,
): boolean =>
  !!s &&
  !!s.date_of_birth &&
  !!s.expected_arrival_time &&
  !!s.expected_departure_time;

/** Human explanation for why a profile blocks booking (null = it doesn't). */
export const attendeeProfileGap = (
  s: AttendeeProfileFields | null | undefined,
): string | null => {
  if (!s) return "No attendee profile yet";
  if (!s.date_of_birth) return "Date of birth missing";
  if (!s.expected_arrival_time || !s.expected_departure_time)
    return "Expected arrival/departure times missing";
  return null;
};
