import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, ArrowRight, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { FadeRise } from "@/components/motion";
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
    <section aria-label="Featured venues" className="relative py-16 md:py-24 px-4 overflow-hidden bg-secondary/40">
      <div className="relative container max-w-7xl">
        <FadeRise className="text-center max-w-2xl mx-auto mb-12">
          <p className="eyebrow mb-3">
            <Sparkles className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5 text-accent" />
            New for September
          </p>
          <h2 className="font-display font-bold tracking-tight text-3xl md:text-5xl">Brand-new venues</h2>
          <p className="mt-3 text-muted-foreground">
            The Dance Exclusive is expanding — find a brand-new class night near you.
          </p>
        </FadeRise>

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
                  className="group h-full flex flex-col rounded-3xl bg-card shadow-soft overflow-hidden transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-soft-lg dark:border dark:border-border/60"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                    <img
                      src={venueCardImage(v.hero_image, v.photo_outside)}
                      alt={`${v.name}, ${v.city}`}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                    />
                    <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-card/85 backdrop-blur px-3 py-1 text-xs font-semibold text-foreground shadow-soft">
                      <Sparkles className="w-3 h-3 text-accent" /> New venue
                    </span>
                  </div>
                  <div className="flex flex-col flex-1 p-6">
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <MapPin className="w-5 h-5" />
                      </span>
                      <div>
                        <h3 className="font-display font-bold tracking-tight text-xl leading-tight">{v.name}</h3>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {v.city}
                          {v.county ? `, ${v.county}` : ""}
                        </p>
                      </div>
                    </div>
                    {(v.short_description || v.description) && (
                      <p className="mt-3 text-sm text-muted-foreground flex-1">
                        {v.short_description || v.description}
                      </p>
                    )}
                    <div className="mt-5 pt-4 border-t border-border/50">
                      <Button asChild>
                        <Link to="/classes/children" aria-label={`View classes at ${v.name}`}>
                          View classes <ArrowRight className="w-4 h-4 ml-2" />
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
