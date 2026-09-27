import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/integrations/supabase/types";
import { orderPublicCoaches } from "./publicCoaches";

export type PublicVenue = Pick<
  Tables<"venues">,
  | "id"
  | "name"
  | "slug"
  | "city"
  | "postcode"
  | "address_line1"
  | "description"
  | "short_description"
  | "hero_image"
  | "photo_outside"
  | "accessibility_info"
  | "has_parking"
>;
export type PublicCoach = Pick<
  Tables<"staff_public">,
  | "id"
  | "first_name"
  | "profile_photo"
  | "description"
  | "dance_skills"
  | "role"
>;
export type PublicSession = Pick<
  Tables<"class_sessions">,
  "id" | "session_date" | "start_time" | "end_time"
>;
export type PublicWorkshopCover = Pick<Tables<"workshops">, "cover_image" | "cover_position" | "cover_zoom" | "cover_fit">;

export type PublicClass = Pick<
  Tables<"classes">,
  | "id"
  | "name"
  | "description"
  | "class_type"
  | "dance_style"
  | "age_min"
  | "age_max"
  | "school_year_min"
  | "school_year_max"
  | "audience_label"
  | "day_of_week"
  | "days_of_week"
  | "start_time"
  | "end_time"
  | "venue_id"
  | "instructor_id"
  | "term_end"
  | "capacity"
  | "price_per_session"
  | "price_per_month"
  | "price_per_term"
  | "price_per_year"
  | "allow_monthly"
  | "allow_termly"
  | "allow_yearly"
  | "allow_trial"
  | "invite_only"
  | "booking_enabled"
  | "status"
  | "publicly_visible"
  | "is_active"
> & {
  workshops?: PublicWorkshopCover | null;
  remainingSessions: number;
  sessions: PublicSession[];
  enrolled: number | null;
};
export type PublicCamp = Pick<
  Tables<"camps">,
  | "id"
  | "name"
  | "description"
  | "class_type"
  | "start_date"
  | "end_date"
  | "price_per_day"
  | "price_total"
  | "venue_id"
  | "workshop_id"
> & { workshops?: PublicWorkshopCover | null };
export interface PublicSchool {
  classes: PublicClass[];
  venues: PublicVenue[];
  coaches: PublicCoach[];
  camps: PublicCamp[];
  contact: PublicContact;
}

export interface PublicContact {
  email: string;
  phone: string;
  instagram: string;
  facebook: string;
}

export const defaultPublicContact: PublicContact = {
  email: "hello@thedanceexclusive.co.uk",
  phone: "07822018812",
  instagram: "https://www.instagram.com/thedanceexclusive_/",
  facebook: "https://www.facebook.com/essexdanceexclusive",
};

function publicContact(rows: { key: string; value: string }[]): PublicContact {
  const values = new Map(rows.map(({ key, value }) => [key, value.trim()]));
  const social = (key: string, fallback: string) => {
    try {
      const url = new URL(values.get(key) || fallback);
      return ["https:", "http:"].includes(url.protocol) ? url.href : fallback;
    } catch {
      return fallback;
    }
  };
  const email = values.get("email_address") || defaultPublicContact.email;
  const phone = values.get("phone_number") || defaultPublicContact.phone;
  return {
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : defaultPublicContact.email,
    phone: /^[+\d\s()-]+$/.test(phone) ? phone : defaultPublicContact.phone,
    instagram: social("social_instagram", defaultPublicContact.instagram),
    facebook: social("social_facebook", defaultPublicContact.facebook),
  };
}

export const schoolDate = (now = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  return ["year", "month", "day"]
    .map((part) => parts.find((p) => p.type === part)?.value)
    .join("-");
};

export function hasCurrentSchedule(
  termEnd: string | null,
  dates: string[],
  today: string,
) {
  if (dates.some((date) => date >= today)) return true;
  return dates.length === 0 && (!termEnd || termEnd >= today);
}

/** Public fields only. Shared by public directories and their detail pages. */
export async function fetchPublicSchool(
  client: SupabaseClient<Database>,
): Promise<PublicSchool> {
  const today = schoolDate();
  const [classResult, venueResult, coachResult, campResult, contactResult] = await Promise.all(
    [
      client
        .from("classes")
        .select(
          "id,name,description,class_type,dance_style,age_min,age_max,school_year_min,school_year_max,audience_label,day_of_week,days_of_week,start_time,end_time,venue_id,instructor_id,term_end,capacity,price_per_session,price_per_month,price_per_term,price_per_year,allow_monthly,allow_termly,allow_yearly,allow_trial,invite_only,booking_enabled,status,publicly_visible,is_active,workshops(cover_image,cover_position,cover_zoom,cover_fit)",
        )
        .eq("is_active", true)
        .eq("publicly_visible", true)
        .eq("status", "confirmed")
        .order("sort_order")
        .order("start_time"),
      client
        .from("venues")
        .select(
          "id,name,slug,city,postcode,address_line1,description,short_description,hero_image,photo_outside,accessibility_info,has_parking",
        )
        .eq("publicly_visible", true)
        .neq("status", "inactive")
        .neq("name", "")
        .order("is_featured", { ascending: false })
        .order("name"),
      client
        .from("staff_public")
        .select("id,first_name,profile_photo,description,dance_skills,role")
        .order("created_at"),
      client
        .from("camps")
        .select(
          "id,name,description,class_type,start_date,end_date,price_per_day,price_total,venue_id,workshop_id,workshops(cover_image,cover_position,cover_zoom,cover_fit)",
        )
        .eq("is_active", true)
        .gte("end_date", today)
        .order("start_date"),
      client
        .from("app_settings")
        .select("key,value")
        .in("key", ["email_address", "phone_number", "social_instagram", "social_facebook"]),
    ],
  );
  for (const result of [classResult, venueResult, coachResult, campResult, contactResult])
    if (result.error) throw result.error;
  const classes = classResult.data ?? [];
  const sessions = new Map<string, PublicSession[]>();
  const enrollment = new Map<string, number>();
  let availabilityKnown = false;
  if (classes.length) {
    await Promise.all([
      (async () => {
        // Avoid silently truncating schedules at the API's row limit.
        for (let start = 0; ; start += 1000) {
          const { data, error } = await client
            .from("class_sessions")
            .select("id,class_id,session_date,start_time,end_time")
            .in(
              "class_id",
              classes.map((item) => item.id),
            )
            .eq("status", "scheduled")
            .order("session_date")
            .order("id")
            .range(start, start + 999);
          if (error) throw error;
          for (const session of data ?? []) {
            const list = sessions.get(session.class_id) ?? [];
            list.push({
              id: session.id,
              session_date: session.session_date,
              start_time: session.start_time,
              end_time: session.end_time,
            });
            sessions.set(session.class_id, list);
          }
          if ((data?.length ?? 0) < 1000) break;
        }
      })(),
      (async () => {
        const { data, error } = await client.rpc("get_class_enrollment", {
          _class_ids: classes.map((item) => item.id),
        });
        // A failed availability request must never turn into "spaces available".
        if (error) return;
        availabilityKnown = true;
        for (const row of data ?? [])
          enrollment.set(row.class_id, Number(row.confirmed_count));
      })(),
    ]);
  }
  return {
    classes: classes
      .filter((item) =>
        hasCurrentSchedule(
          item.term_end,
          (sessions.get(item.id) ?? []).map((session) => session.session_date),
          today,
        ),
      )
      .map((item) => {
        const upcoming = (sessions.get(item.id) ?? []).filter(
          (session) => session.session_date >= today,
        );
        return {
          ...item,
          remainingSessions: upcoming.length,
          sessions: upcoming,
          enrolled: availabilityKnown ? (enrollment.get(item.id) ?? 0) : null,
        };
      }),
    venues: venueResult.data ?? [],
    coaches: orderPublicCoaches((coachResult.data ?? []).filter(
      (coach) => coach.id && coach.first_name,
    )),
    camps: campResult.data ?? [],
    contact: publicContact(contactResult.data ?? []),
  };
}

export const venuePath = (venue: Pick<PublicVenue, "id" | "slug">) =>
  `/venues/${encodeURIComponent(venue.slug || venue.id)}`;
export const coachPath = (coach: Pick<PublicCoach, "id">) =>
  `/team/${encodeURIComponent(coach.id ?? "")}`;
export const publicClassPath = (item: Pick<PublicClass, "id" | "class_type">) =>
  `/classes/${item.class_type}/${encodeURIComponent(item.id)}`;
