import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { CalendarDays, Ticket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PassRedeemDialog, type SessionOption } from "@/components/portal/PassRedeemDialog";
import { ADULT_PASSES, type AdultPassType } from "@/lib/pricing";

interface PassRow {
  id: string;
  pass_type: string;
  sessions_total: number;
  sessions_remaining: number;
  amount_paid: number;
  purchased_at: string;
  expires_at: string;
}

interface ClassPassesPanelProps {
  /** Called whenever the passes list changes (e.g. after a redemption). */
  onPassesChanged?: () => void;
}

const passLabel = (type: string) =>
  ADULT_PASSES[type as AdultPassType]?.label ?? "Class Pass";

/** A pass still holds bookable credit: sessions left AND not yet expired. */
const isActivePass = (p: PassRow) =>
  p.sessions_remaining > 0 && new Date(p.expires_at).getTime() >= Date.now();

/** Signed-in view of the user's multi-class passes: credits left, validity
 *  countdown, and a no-payment booking flow for active passes. */
export function ClassPassesPanel({ onPassesChanged }: ClassPassesPanelProps) {
  const { user } = useAuth();
  const [passes, setPasses] = useState<PassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [sessionOptions, setSessionOptions] = useState<SessionOption[]>([]);
  const [redeemPass, setRedeemPass] = useState<PassRow | null>(null);

  const fetchPasses = useCallback(async () => {
    if (!user) { setPasses([]); setLoading(false); return; }
    const { data, error } = await supabase
      .from("class_passes")
      .select("id, pass_type, sessions_total, sessions_remaining, amount_paid, purchased_at, expires_at")
      .eq("user_id", user.id)
      .order("purchased_at", { ascending: false });
    if (error) {
      setLoadError(true);
    } else {
      setLoadError(false);
      setPasses((data as PassRow[]) ?? []);
    }
    setLoading(false);
  }, [user]);
  useEffect(() => { fetchPasses(); }, [fetchPasses]);

  // Upcoming sessions of the bookable adult classes — what a pass can be
  // redeemed against (mirrors the ClassBrowser listing).
  useEffect(() => {
    const fetchSessions = async () => {
      const { data: classData } = await supabase
        .from("classes")
        .select("id, name, venues(name)")
        .eq("class_type", "adult")
        .eq("is_active", true)
        .eq("status", "confirmed")
        .eq("publicly_visible", true)
        .eq("booking_enabled", true)
        .eq("invite_only", false);
      if (!classData || classData.length === 0) { setSessionOptions([]); return; }
      const today = new Date().toISOString().split("T")[0];
      const { data: sessionData } = await supabase
        .from("class_sessions")
        .select("id, class_id, session_date, start_time, end_time")
        .in("class_id", classData.map((c) => c.id))
        .eq("status", "scheduled")
        .gte("session_date", today)
        .order("session_date");
      const classMap = new Map(classData.map((c) => [c.id, c]));
      setSessionOptions((sessionData ?? []).map((s) => {
        const cls = classMap.get(s.class_id);
        return {
          id: s.id,
          classId: s.class_id,
          className: cls?.name ?? "Adult class",
          session_date: s.session_date,
          start_time: s.start_time,
          end_time: s.end_time,
          venueName: (cls?.venues as { name: string } | null)?.name ?? null,
        };
      }));
    };
    fetchSessions();
  }, []);

  const activePasses = passes.filter(isActivePass);
  const pastPasses = passes.filter((p) => !isActivePass(p));

  if (loading) {
    return <div className="text-muted-foreground py-8">Loading your passes...</div>;
  }
  if (loadError) {
    return <div className="text-muted-foreground py-8">Could not load your passes right now. Please try again later.</div>;
  }

  return (
    <div className="space-y-6">
      {passes.length === 0 ? (
        <Card className="card-elevated">
          <CardContent className="py-16 text-center space-y-4">
            <Ticket className="w-12 h-12 mx-auto text-muted-foreground/40" />
            <div>
              <p className="text-lg font-semibold">No class passes yet</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                Buy a 2, 4, 6 or 8-class pass and mix and match any adult classes.
                Passes are valid for 6 weeks from purchase — and booking with a pass
                needs no payment.
              </p>
            </div>
            <Button asChild size="lg">
              <Link to="/classes/adult">
                <Ticket className="w-4 h-4 mr-2" /> Buy a Class Pass
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {activePasses.map((p) => {
            const daysLeft = differenceInCalendarDays(new Date(p.expires_at), new Date());
            const expiringSoon = daysLeft <= 7;
            return (
              <Card key={p.id} className="card-elevated border-primary/30">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Ticket className="w-4 h-4 text-primary" /> {passLabel(p.pass_type)}
                    </CardTitle>
                    <Badge
                      variant="outline"
                      className={expiringSoon
                        ? "border-amber-500/40 bg-amber-500/10 text-amber-500"
                        : "border-primary/30 text-primary"}
                    >
                      {daysLeft} day{daysLeft === 1 ? "" : "s"} left
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-3xl font-bold text-foreground">
                      {p.sessions_remaining} <span className="text-base font-medium text-muted-foreground">of {p.sessions_total} classes left</span>
                    </p>
                    <Progress
                      value={(p.sessions_remaining / p.sessions_total) * 100}
                      className="h-2 mt-2"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5 text-primary" />
                    Valid until {format(parseISO(p.expires_at), "d MMM yyyy")}
                  </p>
                  <Button
                    size="lg"
                    className="w-full sm:w-auto uppercase tracking-wider text-xs font-bold"
                    onClick={() => setRedeemPass(p)}
                  >
                    Book your classes — no payment needed
                  </Button>
                </CardContent>
              </Card>
            );
          })}

          {activePasses.length === 0 && (
            <Card className="card-elevated">
              <CardContent className="py-10 text-center space-y-3">
                <p className="text-sm text-muted-foreground">
                  You have no active passes. Grab a new one to keep dancing!
                </p>
                <Button asChild>
                  <Link to="/classes/adult">
                    <Ticket className="w-4 h-4 mr-2" /> Buy a Class Pass
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {pastPasses.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground/70 font-semibold">Past passes</p>
              {pastPasses.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-border/40 bg-muted/20"
                >
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">{passLabel(p.pass_type)}</span>
                    <span className="block text-[10px] text-muted-foreground/70">
                      Used {p.sessions_total - p.sessions_remaining} of {p.sessions_total} classes
                      {new Date(p.expires_at).getTime() >= Date.now() ? " · expires " : " · expired "}
                      {format(parseISO(p.expires_at), "d MMM yyyy")}
                    </span>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">
                    {p.sessions_remaining === 0 ? "Used up" : "Expired"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <PassRedeemDialog
        open={!!redeemPass}
        onOpenChange={(o) => { if (!o) setRedeemPass(null); }}
        mode="pass"
        pass={redeemPass}
        sessionOptions={sessionOptions}
        onRedeemed={() => {
          fetchPasses();
          onPassesChanged?.();
        }}
      />
    </div>
  );
}
