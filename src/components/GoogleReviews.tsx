import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface GoogleReview {
  author: string;
  rating: number;
  text: string;
  relativeTime: string;
  profilePhotoUrl: string | null;
}

interface GoogleReviewsData {
  rating: number | null;
  totalReviews: number;
  reviews: GoogleReview[];
}

export interface FallbackTestimonial {
  quote: string;
  name: string;
  role?: string;
}

export interface GoogleReviewsProps {
  fallback?: FallbackTestimonial[];
}

const bodyStyle: React.CSSProperties = {
  textTransform: "none",
  letterSpacing: "normal",
  fontFamily: "var(--font-body)",
};

const StarRow = ({ rating }: { rating: number }) => (
  <div className="flex gap-1 text-primary mb-4" aria-label={`${rating} out of 5 stars`}>
    {Array.from({ length: 5 }).map((_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${i < Math.round(rating) ? "fill-current" : "opacity-30"}`}
      />
    ))}
  </div>
);

const FallbackGrid = ({ items }: { items: FallbackTestimonial[] }) => (
  <div className="grid md:grid-cols-3 gap-6">
    {items.map((t) => (
      <figure
        key={t.name}
        className="h-full rounded-2xl border border-border bg-card/70 backdrop-blur-sm p-8 flex flex-col"
      >
        <StarRow rating={5} />
        <blockquote className="flex-1 text-foreground/90" style={bodyStyle}>
          “{t.quote}”
        </blockquote>
        <figcaption className="mt-6 pt-4 border-t border-border">
          <span className="font-display uppercase tracking-wider text-sm">{t.name}</span>
          {t.role && (
            <span className="block text-xs text-muted-foreground" style={{ textTransform: "none" }}>
              {t.role}
            </span>
          )}
        </figcaption>
      </figure>
    ))}
  </div>
);

const GoogleReviews = ({ fallback }: GoogleReviewsProps) => {
  const [data, setData] = useState<GoogleReviewsData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    supabase.functions
      .invoke<GoogleReviewsData>("google-reviews")
      .then(({ data: result, error }) => {
        if (cancelled) return;
        if (error || !result) {
          setFailed(true);
        } else {
          setData({
            rating: typeof result.rating === "number" ? result.rating : null,
            totalReviews: typeof result.totalReviews === "number" ? result.totalReviews : 0,
            reviews: Array.isArray(result.reviews) ? result.reviews : [],
          });
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const showFallback = failed || (data !== null && data.reviews.length === 0);

  if (showFallback) {
    return fallback && fallback.length > 0 ? <FallbackGrid items={fallback} /> : null;
  }

  // Still loading.
  if (data === null) {
    return fallback && fallback.length > 0 ? <FallbackGrid items={fallback} /> : null;
  }

  return (
    <div>
      <div className="grid md:grid-cols-3 gap-6">
        {data.reviews.map((review, i) => (
          <figure
            key={`${review.author}-${i}`}
            className="h-full rounded-2xl border border-border bg-card/70 backdrop-blur-sm p-8 flex flex-col"
          >
            <StarRow rating={review.rating} />
            <blockquote className="flex-1 text-foreground/90 line-clamp-5" style={bodyStyle}>
              “{review.text}”
            </blockquote>
            <figcaption className="mt-6 pt-4 border-t border-border">
              <span className="font-display uppercase tracking-wider text-sm">{review.author}</span>
              <span className="block text-xs text-muted-foreground" style={{ textTransform: "none" }}>
                {review.relativeTime}
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
      <div className="mt-8 text-center">
        {data.rating !== null && (
          <p className="text-sm text-foreground/90" style={bodyStyle}>
            <span className="text-primary" aria-hidden="true">★</span>{" "}
            {data.rating.toFixed(1)} from {data.totalReviews} Google reviews
          </p>
        )}
        <p className="mt-1 text-xs text-muted-foreground" style={bodyStyle}>
          Reviews from Google
        </p>
      </div>
    </div>
  );
};

export default GoogleReviews;
