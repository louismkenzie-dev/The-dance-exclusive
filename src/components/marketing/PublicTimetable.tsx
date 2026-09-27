import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { addDays, format, parseISO } from "date-fns";
import { DateStrip } from "@/components/booking/DateStrip";
import { SessionRow } from "@/components/booking/SessionRow";
import { audienceText } from "@/lib/classAudience";
import { classPriceSummary } from "@/lib/classPresentation";
import { publicClassPath, type PublicClass, type PublicVenue } from "@/lib/publicSchool";
import { timetableStripDays } from "@/lib/timetableGaps";

/** The booking system's date strip and session rows, backed by the public session feed. */
export function PublicTimetable({ classes, venues }: { classes: PublicClass[]; venues: PublicVenue[] }) {
  const navigate = useNavigate();
  const [venueId, setVenueId] = useState("");
  const [day, setDay] = useState<string | null>(null);
  const byVenue = new Map(venues.map(venue => [venue.id, venue]));
  const filtered = classes.filter(item => !venueId || item.venue_id === venueId);
  const sessions = filtered.flatMap(item => (item.sessions ?? []).map(session => ({ ...session, item })))
    .sort((a, b) => `${a.session_date}${a.start_time}`.localeCompare(`${b.session_date}${b.start_time}`));
  const firstDate = sessions[0]?.session_date;
  const end = firstDate ? format(addDays(parseISO(firstDate), 20), "yyyy-MM-dd") : null;
  const upcoming = sessions.filter(session => !end || session.session_date <= end);
  const shownDay = day && upcoming.some(session => session.session_date === day) ? day : null;
  const shown = upcoming.filter(session => !shownDay || session.session_date === shownDay);
  const rows = shown.slice(0, 8);
  return <div className="tde-booking-theme portal-ui tde-public-timetable">
    <label className="tde-timetable-venue">Venue
      <select value={venueId} onChange={event => { setVenueId(event.target.value); setDay(null); }}>
        <option value="">All venues</option>
        {venues.filter(venue => classes.some(item => item.venue_id === venue.id)).map(venue => <option key={venue.id} value={venue.id}>{venue.name}</option>)}
      </select>
    </label>
    {upcoming.length > 0 ? <>
      <DateStrip days={timetableStripDays(upcoming.map(session => session.session_date), firstDate, end)} value={shownDay} onChange={setDay} allDaysLabel="All days" onAllDays={() => setDay(null)} className="my-6" relativeLabels />
      <div className="surface divide-y divide-border">
        {rows.map((session, index) => {
          const venue = session.item.venue_id ? byVenue.get(session.item.venue_id) : undefined;
          const price = classPriceSummary(session.item, session.item.remainingSessions);
          return <div key={session.id}>
            {(index === 0 || rows[index - 1].session_date !== session.session_date) && <h4 className="px-5 pt-5 pb-2 text-sm text-muted-foreground">{format(parseISO(session.session_date), "EEEE d MMMM")}</h4>}
            <SessionRow startTime={session.start_time} endTime={session.end_time} title={session.item.name}
              meta={[audienceText(session.item), venue?.name].filter(Boolean).join(" · ")}
              sub={`${price.priceLabel} ${price.priceHint}`}
              onOpen={() => navigate(publicClassPath(session.item))}
              action={<Link className="tde-timetable-view" to={publicClassPath(session.item)}>View class</Link>} />
          </div>;
        })}
      </div>
      <p className="mt-4 text-sm text-muted-foreground" role="status">Showing {rows.length} of {shown.length} upcoming sessions{shownDay ? " on this day" : " over three weeks"}.</p>
    </> : <p className="py-6 text-muted-foreground" role="status">No upcoming sessions are published{venueId ? " at this venue" : " for these classes"}. Explore the class cards for details or try another venue.</p>}
  </div>;
}
