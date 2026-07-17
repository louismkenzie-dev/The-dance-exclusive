import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, ArrowRight, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import {
  featuredVenuesForDisplay,
  venueCardImage,
  type PublicVenueFields,
} from "@/lib/venuePresentation";

export interface FeaturedVenue extends PublicVenueFields {
  id: string;
  city: string;
  county: string | null;
  short_description: string | null;
  description: string | null;
  hero_image: string | null;
  photo_outside: string | null;
}

/**
 * Featured-venue carousel. Admin-configurable (is_featured + featured_order on
 * venues) — nothing is hard-coded. Shows up to three cards on desktop, one at
 * a time on mobile. No auto-rotation; embla + the shadcn carousel provide
 * keyboard navigation and labelled controls.
 */
export const FeaturedVenueCards = ({ venues }: { venues: FeaturedVenue[] }) => {
  const display = featuredVenuesForDisplay(venues);
  if (display.length === 0) return null;

  return (
    <section aria-label="Featured venues" className="relative py-24 px-4 overflow-hidden">
      <div className="absolute inset-0 stage-light-blue opacity-40" />
      <div className="relative container">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <p className="text-accent uppercase tracking-[0.3em] text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
            New for September
          </p>
          <h2 className="font-display font-bold text-4xl md:text-6xl">Brand-New Venues</h2>
          <p
            className="mt-4 text-muted-foreground"
            style={{ textTransform: "none", letterSpacing: "normal", fontFamily: "var(--font-body)" }}
          >
            The Dance Exclusive is expanding — find a brand-new class night near you.
          </p>
        </div>

        <Carousel
          opts={{ align: "start", loop: display.length > 3 }}
          className="w-full"
          aria-roledescription="carousel"
        >
          <CarouselContent>
            {display.map((v) => (
              <CarouselItem
                key={v.id}
                className={
                  display.length >= 3
                    ? "basis-full sm:basis-1/2 lg:basis-1/3"
                    : display.length === 2
                      ? "basis-full sm:basis-1/2"
                      : "basis-full sm:basis-2/3 lg:basis-1/2 mx-auto"
                }
              >
                <article
                  data-testid="featured-venue-card"
                  className="group h-full flex flex-col rounded-2xl border border-border bg-card/60 backdrop-blur-sm overflow-hidden transition-all duration-500 hover:-translate-y-1.5 hover:border-primary/40"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                    <img
                      src={venueCardImage(v.hero_image, v.photo_outside)}
                      alt={`${v.name}, ${v.city}`}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute top-3 left-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-background/70 backdrop-blur-sm border border-border text-[10px] uppercase tracking-[0.18em] text-foreground/80">
                      <Sparkles className="w-3 h-3 text-accent" /> New Venue
                    </div>
                  </div>
                  <div className="flex flex-col flex-1 p-6">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 mt-1 shrink-0 text-primary" />
                      <div>
                        <h3 className="font-display text-2xl leading-tight">{v.name}</h3>
                        <p className="text-xs uppercase tracking-[0.18em] mt-0.5 text-primary">
                          {v.city}
                          {v.county ? `, ${v.county}` : ""}
                        </p>
                      </div>
                    </div>
                    {(v.short_description || v.description) && (
                      <p
                        className="mt-3 text-sm text-muted-foreground flex-1"
                        style={{ textTransform: "none", letterSpacing: "normal", fontFamily: "var(--font-body)" }}
                      >
                        {v.short_description || v.description}
                      </p>
                    )}
                    <div className="mt-5 pt-4 border-t border-border/60">
                      <Button asChild className="font-semibold uppercase tracking-wider">
                        <Link to="/classes/children" aria-label={`View classes at ${v.name}`}>
                          View Classes <ArrowRight className="w-4 h-4 ml-2" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </article>
              </CarouselItem>
            ))}
          </CarouselContent>
          {display.length > 1 && (
            <>
              <CarouselPrevious className="hidden sm:flex" aria-label="Previous featured venue" />
              <CarouselNext className="hidden sm:flex" aria-label="Next featured venue" />
            </>
          )}
        </Carousel>
      </div>
    </section>
  );
};

/** Data-fetching wrapper used on the public homepage. Renders nothing until venues load, and nothing at all when no venue is featured. */
const FeaturedVenueCarousel = () => {
  const [venues, setVenues] = useState<FeaturedVenue[]>([]);

  useEffect(() => {
    supabase
      .from("venues")
      .select(
        "id, name, city, county, status, publicly_visible, is_featured, featured_order, short_description, description, hero_image, photo_outside",
      )
      .eq("is_featured", true)
      .then(({ data }) => {
        if (data) setVenues(data as unknown as FeaturedVenue[]);
      });
  }, []);

  return <FeaturedVenueCards venues={venues} />;
};

export default FeaturedVenueCarousel;
