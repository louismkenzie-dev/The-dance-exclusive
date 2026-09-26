import { Link } from "react-router-dom";
import { ArrowUpRight, Baby, CalendarDays, Clock3, MapPin, Music2, PersonStanding } from "lucide-react";
import { classDaysLabel, classPriceSummary } from "@/lib/classPresentation";
import { audienceText } from "@/lib/classAudience";
import { publicClassPath } from "@/lib/publicSchool";
import { classPhoto } from "@/lib/tdeMedia";
import { SchoolPhoto } from "./SchoolPhoto";
import type { PublicClass, PublicVenue } from "@/lib/publicSchool";

export function PublicClassList({ classes, venues }: { classes: PublicClass[]; venues: PublicVenue[] }) {
  const venueById = new Map(venues.map(venue => [venue.id, venue]));
  if (!classes.length) return <p className="tde-empty">No current public classes are listed here.{" "}
    <Link to="/classes?type=children">Explore the full timetable</Link> or <Link to="/contact">get in touch</Link>.</p>;
  return (
    <div className="tde-class-list tde-photo-class-grid">
      {classes.map(item => {
        const venue = item.venue_id ? venueById.get(item.venue_id) : undefined;
        const price = classPriceSummary(item, item.remainingSessions);
        const AudienceIcon = item.class_type === "adult" ? PersonStanding : Baby;
        return (
          <Link key={item.id} to={publicClassPath(item)} className="tde-photo-class" data-audience={item.class_type}>
            <div className="tde-photo-class-image">
              <SchoolPhoto photo={classPhoto(item)} decorative sizes="(max-width: 640px) 100vw, (max-width: 1050px) 50vw, 33vw" />
              <span className="tde-photo-class-audience"><AudienceIcon size={16} aria-hidden />{item.class_type === "adult" ? "Adults" : "Children"}</span>
            </div>
            <div className="tde-photo-class-body">
              {item.dance_style && <span className="tde-photo-class-style"><Music2 size={15} aria-hidden />{item.dance_style}</span>}
              <h3>{item.name}</h3>
              {item.description && <p className="tde-photo-class-description">{item.description}</p>}
              <ul className="tde-photo-class-facts">
                {audienceText(item) && <li><AudienceIcon size={17} aria-hidden /><span>{audienceText(item)}</span></li>}
                {venue && <li><MapPin size={17} aria-hidden /><span>{venue.name}</span></li>}
                <li><CalendarDays size={17} aria-hidden /><span>{classDaysLabel(item.days_of_week, item.day_of_week)}</span></li>
                <li><Clock3 size={17} aria-hidden /><span>{item.start_time.slice(0, 5)} – {item.end_time.slice(0, 5)}</span></li>
              </ul>
              <div className="tde-photo-class-bottom">
                <span className="tde-photo-class-price">{price.priceLabel}<small>{price.priceHint}</small></span>
                <span className="tde-photo-class-link">View class <ArrowUpRight size={19} aria-hidden /></span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
