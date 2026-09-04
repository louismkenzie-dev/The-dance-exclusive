import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Loader2, RefreshCw, Star, XCircle } from "lucide-react";

const PLACE_ID_KEY = "google_place_id";

interface ReviewsStatus {
  connected?: boolean;
  reason?: string;
  rating: number | null;
  totalReviews: number;
  reviews: { author: string; rating: number; text: string }[];
  fetchedAt?: string;
}

const REASON_TEXT: Record<string, string> = {
  missing_api_key:
    "The Google Places API key isn't set up on the server yet — ask us to add it and this will start working.",
  missing_place_id: "Paste your Google Place ID above and save to connect your reviews.",
  place_not_found: "Google didn't recognise that Place ID — double-check it and try again.",
  google_error: "Google turned the request down. The Place ID may be wrong, or the key may need Places API access.",
};

/**
 * Connect the studio's Google Business reviews.
 *
 * The plumbing has always been here — reviews are pulled from Google, cached
 * for 12 hours and shown on the homepage — but nothing said so, and switching
 * it on needed a developer. Now the studio can paste their own Place ID,
 * refresh on demand, and see whether it worked.
 */
const GoogleReviewsCard = () => {
  const { toast } = useToast();
  const [placeId, setPlaceId] = useState("");
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(true);
  const [status, setStatus] = useState<ReviewsStatus | null>(null);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", PLACE_ID_KEY)
        .maybeSingle();
      setPlaceId(data?.value ?? "");
      await check(false);
    })();
  }, []);

  const check = async (refresh: boolean) => {
    setChecking(true);
    const { data, error } = await supabase.functions.invoke("google-reviews", {
      body: { refresh },
    });
    setChecking(false);
    if (error) {
      setStatus(null);
      return;
    }
    setStatus(data as ReviewsStatus);
  };

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("app_settings").upsert(
      {
        key: PLACE_ID_KEY,
        value: placeId.trim(),
        description: "Google Place ID used to pull the studio's Google reviews",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Saved — checking Google now" });
    await check(true);
  };

  const working = status?.connected === true || (status?.reviews?.length ?? 0) > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Star className="h-5 w-5" />Google Reviews</CardTitle>
        <CardDescription>
          Pull your Google Business reviews straight onto the website. They refresh automatically
          every 12 hours, and only 4- and 5-star reviews with a written comment are shown.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-xs">Google Place ID</Label>
          <div className="flex flex-wrap gap-2">
            <Input
              className="flex-1 min-w-[220px] font-mono text-sm"
              value={placeId}
              onChange={(e) => setPlaceId(e.target.value)}
              placeholder="e.g. ChIJN1t_tDeuEmsRUsoyG83frY4"
            />
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Find yours with Google&rsquo;s{" "}
            <a
              href="https://developers.google.com/maps/documentation/places/web-service/place-id"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              Place ID finder
            </a>{" "}
            — search for The Dance Exclusive and copy the ID it shows.
          </p>
        </div>

        <div className="rounded-lg border border-border/60 p-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm">
              {checking ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  <span className="text-muted-foreground">Checking…</span>
                </>
              ) : working ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>Connected</span>
                  {status?.rating != null && (
                    <Badge variant="outline">
                      {status.rating.toFixed(1)} ★ · {status.totalReviews} reviews
                    </Badge>
                  )}
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 text-amber-500" />
                  <span>Not connected yet</span>
                </>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => void check(true)} disabled={checking} className="gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh now
            </Button>
          </div>

          {!checking && !working && status?.reason && (
            <p className="text-xs text-muted-foreground">{REASON_TEXT[status.reason] ?? REASON_TEXT.google_error}</p>
          )}
          {!checking && working && (status?.reviews?.length ?? 0) > 0 && (
            <p className="text-xs text-muted-foreground">
              Showing {status!.reviews.length} review{status!.reviews.length === 1 ? "" : "s"} on the
              homepage, most recent first — for example &ldquo;{status!.reviews[0].text.slice(0, 90)}
              {status!.reviews[0].text.length > 90 ? "…" : ""}&rdquo;
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default GoogleReviewsCard;
