import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PassRedeemDialog, type SessionOption } from "@/components/portal/PassRedeemDialog";
import { passLabelOf, usePassCatalog } from "@/lib/passCatalog";
import { EmptyState } from "@/components/booking/EmptyState";
import { QuietPill } from "@/components/booking/QuietPill";
import { RecordCardSkeleton } from "@/components/booking/PortalSkeletons";

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
  const { passes: catalog } = usePassCatalog();
  const passLabel = (type: string) => passLabelOf(catalog, type);

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
    return (
      <div className="space-y-4">
        <RecordCardSkeleton />
      </div>
    );
  }
  if (loadError) {
    return (
      <EmptyState
        tone="error"
        title="Couldn't load your passes"
        body="Please try again in a moment."
      />
    );
  }

  return (
    <div className="space-y-6">
      {passes.length === 0 ? (
        <EmptyState
          title="No class passes yet"
          body="Buy a 2, 4, 6 or 8-class pass and mix and match any adult classes. Passes are valid for 6 weeks from purchase, and booking with a pass needs no payment."
          action={
            <Button asChild size="lg" className="rounded-full">
              <Link to="/classes/adult">Buy a class pass</Link>
            </Button>
          }
        />
      ) : (
        <>
          {activePasses.map((p) => {
            const daysLeft = differenceInCalendarDays(new Date(p.expires_at), new Date());
            const expiringSoon = daysLeft <= 7;
            const pct = Math.max(0, Math.min(100, (p.sessions_remaining / p.sessions_total) * 100));
            return (
              <div key={p.id} className="surface animate-rise-in p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-muted-foreground">Class pass</p>
                    <h3 className="mt-1 text-[19px] font-semibold leading-snug tracking-tight text-foreground">{passLabel(p.pass_type)}</h3>
                  </div>
                  <QuietPill tone={expiringSoon ? "warning" : "neutral"}>
                    {daysLeft} day{daysLeft === 1 ? "" : "s"} left
                  </QuietPill>
                </div>

                <div className="mt-5">
                  <p className="text-[28px] font-semibold leading-none tracking-tight tabular-nums text-foreground">
                    {p.sessions_remaining}
                    <span className="ml-2 text-[15px] font-normal text-muted-foreground">of {p.sessions_total} classes left</span>
                  </p>
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={p.sessions_remaining} aria-valuemin={0} aria-valuemax={p.sessions_total}>
                    <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-3 text-[15px] text-muted-foreground">
                    Valid until {format(parseISO(p.expires_at), "d MMM yyyy")}
                  </p>
                </div>

                <Button size="xl" className="mt-5 w-full rounded-full sm:w-auto" onClick={() => setRedeemPass(p)}>
                  Book your classes
                </Button>
                <p className="mt-2 text-[13px] text-muted-foreground">No payment needed — your pass covers it.</p>
              </div>
            );
          })}

          {activePasses.length === 0 && (
            <EmptyState
              title="No active passes"
              body="Grab a new pass to keep dancing."
              action={
                <Button asChild size="lg" className="rounded-full">
                  <Link to="/classes/adult">Buy a class pass</Link>
                </Button>
              }
            />
          )}

          {pastPasses.length > 0 && (
            <section>
              <h3 className="mb-3 text-[15px] font-semibold text-foreground">Past passes</h3>
              <div className="surface divide-y divide-border/70 overflow-hidden">
                {pastPasses.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-3 px-5 py-4">
                    <div className="min-w-0">
                      <p className="text-[15px] font-medium text-foreground">{passLabel(p.pass_type)}</p>
                      <p className="mt-0.5 text-[13px] text-muted-foreground">
                        Used {p.sessions_total - p.sessions_remaining} of {p.sessions_total} classes
                        {new Date(p.expires_at).getTime() >= Date.now() ? " · expires " : " · expired "}
                        {format(parseISO(p.expires_at), "d MMM yyyy")}
                      </p>
                    </div>
                    <span className="shrink-0 text-[13px] text-muted-foreground">
                      {p.sessions_remaining === 0 ? "Used up" : "Expired"}
                    </span>
                  </div>
                ))}
              </div>
            </section>
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
