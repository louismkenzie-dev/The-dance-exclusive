import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CalendarDays, Clock, MapPin, Sparkles } from "lucide-react";

interface PortalInvite {
  id: string;
  class_id: string;
  student_id: string;
  price: number;
  classes: {
    name: string;
    class_type: "children" | "adult";
    day_of_week: string;
    start_time: string;
    end_time: string;
    location_note: string | null;
    venues: { name: string } | null;
  } | null;
  students: { first_name: string; last_name: string } | null;
}

interface InviteSessions {
  ids: string[];
  dates: string[];
}

/**
 * "You're invited" cards on My Bookings: private one-to-one sessions Amie
 * has created for this family. Book & pay drops the session into the
 * basket and goes straight to checkout.
 */
const OneToOneInvites = () => {
  const { user } = useAuth();
  const { addItem, items } = useCart();
  const navigate = useNavigate();
  const [invites, setInvites] = useState<PortalInvite[]>([]);
  const [sessions, setSessions] = useState<Record<string, InviteSessions>>({});

  const load = useCallback(async () => {
    if (!user) { setInvites([]); return; }
    const { data } = await (supabase as any).from("class_invites")
      .select("id, class_id, student_id, price, classes:class_id(name, class_type, day_of_week, start_time, end_time, is_active, location_note, venues:venue_id(name)), students:student_id(first_name, last_name)")
      .eq("parent_id", user.id)
      .eq("status", "pending");
    const rows = ((data ?? []) as any[]).filter((r) => r.classes?.is_active !== false) as PortalInvite[];
    if (rows.length === 0) { setInvites([]); return; }

    const classIds = rows.map((r) => r.class_id);
    const today = new Date().toISOString().slice(0, 10);
    const [{ data: sessionRows }, { data: bookingRows }] = await Promise.all([
      supabase.from("class_sessions").select("id, class_id, session_date").in("class_id", classIds).gte("session_date", today),
      supabase.from("bookings").select("class_id").eq("parent_id", user.id).in("class_id", classIds).in("status", ["confirmed", "pending_payment"]),
    ]);
    const booked = new Set(((bookingRows as any[]) ?? []).map((b) => b.class_id));
    // A one-to-one can run over several weeks — every upcoming session in the
    // invite is booked and paid for together.
    const sessionByClass: Record<string, InviteSessions> = {};
    for (const s of ((sessionRows as any[]) ?? []).sort((a, b) => a.session_date.localeCompare(b.session_date))) {
      const entry = sessionByClass[s.class_id] ?? { ids: [], dates: [] };
      entry.ids.push(s.id);
      entry.dates.push(s.session_date);
      sessionByClass[s.class_id] = entry;
    }
    setSessions(sessionByClass);
    // Only invites still bookable: upcoming sessions, not already booked.
    setInvites(rows.filter((r) => sessionByClass[r.class_id]?.ids.length && !booked.has(r.class_id)));
  }, [user]);
  useEffect(() => { void load(); }, [load]);

  if (invites.length === 0) return null;

  const bookInvite = (invite: PortalInvite) => {
    const session = sessions[invite.class_id];
    const cls = invite.classes;
    if (!session?.ids.length || !cls) return;
    if (!items.some((i) => i.classId === invite.class_id && i.studentId === invite.student_id)) {
      addItem({
        id: `invite-${invite.id}`,
        classId: invite.class_id,
        className: cls.name,
        classType: cls.class_type,
        danceStyle: null,
        dayOfWeek: cls.day_of_week,
        startTime: cls.start_time,
        endTime: cls.end_time,
        venueName: cls.venues?.name ?? cls.location_note ?? null,
        studentId: invite.student_id,
        studentName: invite.students ? `${invite.students.first_name} ${invite.students.last_name}` : null,
        pricingPlan: "session",
        unitPrice: Number(invite.price),
        totalPrice: Number(invite.price) * session.ids.length,
        sessionsCount: session.ids.length,
        termDiscountPercent: null,
        workshopImage: null,
        selectedSessionIds: session.ids,
        selectedSessionDates: session.dates.map((d) => format(parseISO(d), "d MMM")),
        itemKind: "class",
      });
    }
    toast.success("Added to your basket");
    navigate("/checkout");
  };

  return (
    <div className="space-y-3 mb-4">
      {invites.map((invite) => {
        const session = sessions[invite.class_id];
        const cls = invite.classes;
        return (
          <Card key={invite.id} className="border-pink-500/40 bg-pink-500/5 animate-fade-in">
            <CardContent className="py-4 flex items-center justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-pink-400" />
                  {invite.students?.first_name ?? "Your dancer"} is invited: {cls?.name}
                </p>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                  {session && (
                    <span className="flex items-center gap-1">
                      <CalendarDays className="w-3 h-3" />
                      {session.dates.length === 1
                        ? format(parseISO(session.dates[0]), "EEEE d MMMM")
                        : `${session.dates.length} sessions: ${session.dates.map((d) => format(parseISO(d), "d MMM")).join(", ")}`}
                    </span>
                  )}
                  {cls && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {cls.start_time.slice(0, 5)} – {cls.end_time.slice(0, 5)}
                    </span>
                  )}
                  {(cls?.venues?.name || cls?.location_note) && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {cls.venues?.name ?? cls.location_note}
                    </span>
                  )}
                </p>
                {session && session.dates.length > 1 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    £{Number(invite.price).toFixed(2)} per session
                  </p>
                )}
              </div>
              <Button size="sm" className="bg-pink-600 hover:bg-pink-700 text-white" onClick={() => bookInvite(invite)}>
                Book &amp; pay £{(Number(invite.price) * Math.max(1, session?.ids.length ?? 1)).toFixed(2)}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default OneToOneInvites;
