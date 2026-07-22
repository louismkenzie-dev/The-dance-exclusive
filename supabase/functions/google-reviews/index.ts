import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CACHE_KEY = "google_reviews_cache";
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const MAX_REVIEWS = 6;

interface MappedReview {
  author: string;
  rating: number;
  text: string;
  relativeTime: string;
  profilePhotoUrl: string | null;
}

interface ReviewsPayload {
  fetchedAt: string;
  rating: number | null;
  totalReviews: number;
  reviews: MappedReview[];
}

const EMPTY_PAYLOAD: ReviewsPayload = {
  fetchedAt: new Date(0).toISOString(),
  rating: null,
  totalReviews: 0,
  reviews: [],
};

function jsonResponse(body: unknown): Response {
  // Always 200 — the homepage must degrade gracefully, and functions.invoke
  // treats non-2xx as a thrown FunctionsHttpError.
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let cached: ReviewsPayload | null = null;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Try the cache first.
    const { data: cacheRow } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", CACHE_KEY)
      .maybeSingle();

    if (cacheRow?.value) {
      try {
        cached = JSON.parse(cacheRow.value) as ReviewsPayload;
      } catch {
        cached = null;
      }
    }

    if (cached?.fetchedAt) {
      const age = Date.now() - new Date(cached.fetchedAt).getTime();
      if (Number.isFinite(age) && age >= 0 && age < CACHE_TTL_MS) {
        return jsonResponse(cached);
      }
    }

    // 2. Cache is missing or stale — fetch fresh data from Google.
    const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
    const placeId = Deno.env.get("GOOGLE_PLACE_ID");

    if (!apiKey || !placeId) {
      console.warn("google-reviews: GOOGLE_PLACES_API_KEY / GOOGLE_PLACE_ID not set");
      return jsonResponse(cached ?? EMPTY_PAYLOAD);
    }

    const url =
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}` +
      `?fields=rating,userRatingCount,reviews&key=${encodeURIComponent(apiKey)}`;

    const googleRes = await fetch(url, {
      headers: { "X-Goog-FieldMask": "rating,userRatingCount,reviews" },
    });

    if (!googleRes.ok) {
      console.error(
        `google-reviews: Places API responded ${googleRes.status}: ${await googleRes.text()}`,
      );
      return jsonResponse(cached ?? EMPTY_PAYLOAD);
    }

    // deno-lint-ignore no-explicit-any
    const place: any = await googleRes.json();

    const reviews: MappedReview[] = (Array.isArray(place.reviews) ? place.reviews : [])
      // deno-lint-ignore no-explicit-any
      .map((r: any): MappedReview => ({
        author:
          r?.authorAttribution?.displayName ??
          r?.displayName?.text ??
          "Google user",
        rating: typeof r?.rating === "number" ? r.rating : 0,
        text: r?.text?.text ?? r?.originalText?.text ?? "",
        relativeTime: r?.relativePublishTimeDescription ?? "",
        profilePhotoUrl: r?.authorAttribution?.photoUri ?? null,
      }))
      .filter((r: MappedReview) => r.rating >= 4 && r.text.trim().length > 0)
      .slice(0, MAX_REVIEWS);

    const payload: ReviewsPayload = {
      fetchedAt: new Date().toISOString(),
      rating: typeof place.rating === "number" ? place.rating : null,
      totalReviews:
        typeof place.userRatingCount === "number" ? place.userRatingCount : 0,
      reviews,
    };

    // 3. Refresh the cache (best-effort — a failure here must not break the response).
    const { error: upsertError } = await supabase
      .from("app_settings")
      .upsert(
        {
          key: CACHE_KEY,
          value: JSON.stringify(payload),
          description: "Cached Google reviews",
        },
        { onConflict: "key" },
      );

    if (upsertError) {
      console.error("google-reviews: cache upsert failed:", upsertError);
    }

    return jsonResponse(payload);
  } catch (e) {
    console.error("google-reviews error:", e);
    // Never 500 — fall back to whatever we have so the homepage degrades gracefully.
    return jsonResponse(cached ?? EMPTY_PAYLOAD);
  }
});
