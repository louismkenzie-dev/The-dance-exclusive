import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { classDaysLabel, classPriceSummary } from "@/lib/classPresentation";
import { audienceText } from "@/lib/classAudience";
import { publicClassPath } from "@/lib/publicSchool";
import type { PublicClass, PublicVenue } from "@/lib/publicSchool";

export function PublicClassList({
  classes,
  venues,
}: {
  classes: PublicClass[];
  venues: PublicVenue[];
}) {
  const venueById = new Map(venues.map((venue) => [venue.id, venue]));
  if (!classes.length)
    return (
      <p className="tde-empty">
        No current public classes are listed here.{" "}
        <Link to="/classes?type=children">Explore the full timetable</Link> or{" "}
        <Link to="/contact">get in touch</Link>.
      </p>
    );
  return (
    <div className="tde-class-list">
      {classes.map((item) => {
        const venue = item.venue_id ? venueById.get(item.venue_id) : undefined;
        const price = classPriceSummary(item, item.remainingSessions);
        return (
          <Link
            key={item.id}
            to={publicClassPath(item)}
            className="tde-class-row"
            data-audience={item.class_type}
          >
            <span className="tde-class-type">
              {item.class_type === "adult" ? "ADULTS" : "CHILDREN"}
            </span>
            <div>
              <h3>{item.name}</h3>
              <span>
                {venue?.name}
                {audienceText(item) ? ` · ${audienceText(item)}` : ""}
              </span>
            </div>
            <span>
              {classDaysLabel(item.days_of_week, item.day_of_week)}
              <small>
                {item.start_time.slice(0, 5)} – {item.end_time.slice(0, 5)}
              </small>
            </span>
            <span className="tde-class-price">
              {price.priceLabel}
              <small>{price.priceHint}</small>
            </span>
            <ArrowUpRight size={23} aria-hidden />
          </Link>
        );
      })}
    </div>
  );
}
