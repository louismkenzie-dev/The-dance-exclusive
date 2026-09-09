import { useState, type ReactNode } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MoveMembershipDialog, { type MoveMembershipTarget } from "@/components/admin/MoveMembershipDialog";
import type { ActionableBooking, BookingActionHandlers } from "@/components/admin/BookingActions";
import { formatTime } from "@/lib/bookingFormat";

/** The date a per-session booking is for: "... | session YYYY-MM-DD". */
export const bookedSessionDate = (b: { notes: string | null } | null) =>
  /session (\d{4}-\d{2}-\d{2})/.exec(b?.notes || "")?.[1] ?? null;

/**
 * Everything the studio can do to one booking — open its breakdown, confirm,
 * cancel, move it (date, class or both), move a monthly membership, refund —
 * with the dialogs those actions need. One hook, used by the Bookings page
 * and by each class session's own page, so a booking behaves the same
 * wherever it is listed. Render `dialogs` once on the page.
 */
export function useBookingActions({ onChanged }: { onChanged: () => void }): {
  actions: BookingActionHandlers;
  dialogs: ReactNode;
} {
  const { toast } = useToast();

  // Which booking's "what did they pay for?" panel is open.
  const [breakdownId, setBreakdownId] = useState<string | null>(null);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("bookings").update({ status: status as any }).eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Booking updated" }); onChanged(); }
  };

  // Admin refund: pick any card-paid booking, choose the amount, and the
  // money goes back to the parent's card via Stripe.
  const [refundBooking, setRefundBooking] = useState<ActionableBooking | null>(null);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refunding, setRefunding] = useState(false);

  const openRefund = (b: ActionableBooking) => {
    setRefundBooking(b);
    setRefundAmount(b.amount ? Number(b.amount).toFixed(2) : "");
    setRefundReason("");
  };

  const submitRefund = async () => {
    if (!refundBooking) return;
    const pounds = Number(refundAmount);
    if (!Number.isFinite(pounds) || pounds <= 0) {
      toast({ title: "Enter a refund amount", description: "The amount must be more than £0.", variant: "destructive" });
      return;
    }
    setRefunding(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-refund", {
        body: {
          bookingId: refundBooking.id,
          amountPence: Math.round(pounds * 100),
          reason: refundReason.trim() || undefined,
        },
      });
      let message = data?.error || error?.message;
      const ctx = (error as { context?: Response } | null)?.context;
      if (ctx && typeof ctx.json === "function") {
        try {
          const body = await ctx.json();
          if (body?.error) message = body.error;
        } catch { /* keep generic */ }
      }
      if (error || !data?.success) {
        toast({ title: "Refund failed", description: message || "Please try again.", variant: "destructive" });
        return;
      }
      toast({
        title: `Refunded £${pounds.toFixed(2)}`,
        description: "The money is on its way back to the parent's card (usually 5–10 working days).",
      });
      setRefundBooking(null);
      onChanged();
    } finally {
      setRefunding(false);
    }
  };

  // Monthly memberships are Stripe subscriptions, so the plain "move booking"
  // can't touch them — but the proper membership move can. Look the live
  // membership up from the booking row and open that flow right here, so
  // Amie doesn't have to know it lives on the Memberships & Plans tab.
  const [bookingMoveTarget, setBookingMoveTarget] = useState<MoveMembershipTarget | null>(null);
  const openMonthlyMove = async (b: ActionableBooking) => {
    const { data, error } = await (supabase as any)
      .from("memberships")
      .select("id, class_id, status")
      .eq("class_id", b.class_id)
      .eq("student_id", (b as any).student_id)
      .in("status", ["active", "paused"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      toast({
        title: "Couldn't look up the membership",
        description: `${error.message} — please try again.`,
        variant: "destructive",
      });
      return;
    }
    if (!data) {
      toast({
        title: "No active or paused membership found",
        description:
          "The membership behind this booking may have a payment issue or have ended — check the Memberships & Plans tab.",
        variant: "destructive",
      });
      return;
    }
    setBookingMoveTarget({
      membershipId: data.id,
      parentName: b.profiles?.full_name ?? "Unknown",
      childName: b.students ? `${b.students.first_name} ${b.students.last_name}` : "—",
      className: b.classes?.name ?? "—",
      classId: data.class_id ?? b.class_id,
      classType: b.classes?.class_type ?? null,
    });
  };

  // "Paid for the wrong class" fix: move a booking to another class in place,
  // keeping the child and the payment.
  const [moveBooking, setMoveBooking] = useState<ActionableBooking | null>(null);
  const [moveClasses, setMoveClasses] = useState<{ id: string; name: string; class_type: string; day_of_week: string; start_time: string | null; venues: { name: string } | null }[]>([]);
  const [moveClassId, setMoveClassId] = useState("");
  const [moveSessions, setMoveSessions] = useState<{ id: string; session_date: string; start_time: string }[]>([]);
  const [moveSessionDate, setMoveSessionDate] = useState("");
  const [moveSaving, setMoveSaving] = useState(false);

  const openMove = async (b: ActionableBooking) => {
    setMoveBooking(b);
    setMoveClassId("");
    setMoveSessions([]);
    setMoveSessionDate("");
    // Only classes this booking could actually move to: the same audience
    // (an adult never belongs on a children's register, or the other way
    // round) and never someone else's invite-only 1:1 session.
    let query = supabase
      .from("classes")
      .select("id, name, class_type, day_of_week, start_time, venues:venue_id(name)")
      .eq("is_active", true)
      .neq("invite_only", true)
      .order("name");
    const audience = b.classes?.class_type;
    if (audience) query = query.eq("class_type", audience);
    const { data } = await query;
    // A booking for a particular date can stay on its class and just change
    // date, so its own class belongs in the list. One with no date (a term
    // or year place) can only change class, so its own class doesn't.
    const dated = !!bookedSessionDate(b);
    setMoveClasses(((data as any[]) ?? []).filter((c) => dated || c.id !== b.class_id));
  };

  // Per-date bookings (trial / drop-in) need a date at the new class too.
  const onMoveClassPicked = async (classId: string) => {
    setMoveClassId(classId);
    setMoveSessionDate("");
    const bookedDate = bookedSessionDate(moveBooking);
    if (!bookedDate) return;
    // Local date, not UTC — after 11pm BST toISOString() names tomorrow.
    const today = format(new Date(), "yyyy-MM-dd");
    const { data } = await supabase
      .from("class_sessions")
      .select("id, session_date, start_time")
      .eq("class_id", classId)
      .eq("status", "scheduled")
      .gte("session_date", today)
      .order("session_date");
    // Staying on the same class means picking a different date, so the one
    // they already hold is not an option. Cancelled dates never are.
    setMoveSessions(((data as any[]) ?? []).filter(
      (s) => classId !== moveBooking?.class_id || s.session_date !== bookedDate,
    ));
  };

  const saveMove = async () => {
    if (!moveBooking || !moveClassId) return;
    const oldDate = bookedSessionDate(moveBooking);
    if (oldDate && !moveSessionDate) {
      toast({ title: "Pick a date", description: "This booking is for a specific session — choose the date at the new class.", variant: "destructive" });
      return;
    }
    setMoveSaving(true);
    let notes = moveBooking.notes ?? "";
    if (oldDate && moveSessionDate) {
      // Point the register at the new date and let the day-before trial
      // reminder send again for it.
      notes = notes.replace(`session ${oldDate}`, `session ${moveSessionDate}`).replace(" | reminder sent", "");
    }
    const { error } = await supabase
      .from("bookings")
      .update({ class_id: moveClassId, notes: notes || null })
      .eq("id", moveBooking.id);
    setMoveSaving(false);
    if (error) {
      toast({ title: "Couldn't move the booking", description: error.message, variant: "destructive" });
      return;
    }
    const sameClass = moveClassId === moveBooking.class_id;
    toast({
      title: "Booking moved",
      description: sameClass
        ? `Now on ${format(new Date(moveSessionDate + "T00:00:00"), "EEE d MMM")} — the registers are updated and the amount already paid is unchanged.`
        : "They now appear on the new class's register. The amount already paid is unchanged.",
    });
    setMoveBooking(null);
    onChanged();
  };

  const actions: BookingActionHandlers = {
    breakdownId,
    toggleBreakdown: (id) => setBreakdownId(breakdownId === id ? null : id),
    onConfirm: (id) => updateStatus(id, "confirmed"),
    onCancel: (id) => updateStatus(id, "cancelled"),
    onMove: openMove,
    onMoveMembership: openMonthlyMove,
    onRefund: openRefund,
  };

  const dialogs = (
    <>
      {/* Move a monthly membership to another class, straight from its booking row */}
      <MoveMembershipDialog
        target={bookingMoveTarget}
        onOpenChange={(o) => { if (!o) setBookingMoveTarget(null); }}
        onMoved={onChanged}
      />

      {/* Refund a card-paid booking (partial or full) */}
      <Dialog open={!!refundBooking} onOpenChange={(o) => { if (!o && !refunding) setRefundBooking(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Refund this booking</DialogTitle>
            <DialogDescription>
              {refundBooking?.classes?.name || "Booking"}
              {refundBooking?.students && ` — ${refundBooking.students.first_name} ${refundBooking.students.last_name}`}
              {refundBooking?.profiles && ` (${refundBooking.profiles.full_name})`}.
              The money goes straight back to the card that paid.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Amount to refund (£)</p>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                placeholder="0.00"
              />
              {refundBooking?.amount != null && (
                <p className="text-xs text-muted-foreground">
                  This booking cost £{Number(refundBooking.amount).toFixed(2)} — you can refund part
                  or all of it.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Reason <span className="text-muted-foreground font-normal">(optional, kept on the payment record)</span></p>
              <Input
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="e.g. cancelled 1:1 session"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={refunding} onClick={() => setRefundBooking(null)}>Cancel</Button>
            <Button variant="destructive" disabled={refunding} onClick={submitRefund}>
              {refunding ? "Refunding…" : `Refund £${Number(refundAmount || 0) > 0 ? Number(refundAmount).toFixed(2) : "0.00"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move a paid booking to another class (wrong-class fix) */}
      <Dialog open={!!moveBooking} onOpenChange={(o) => !o && setMoveBooking(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Move this booking</DialogTitle>
            <DialogDescription>
              {moveBooking?.students
                ? `${moveBooking.students.first_name} ${moveBooking.students.last_name}`
                : "This booking"}{" "}
              — currently {moveBooking?.classes?.name ?? "unassigned"}
              {bookedSessionDate(moveBooking)
                ? `, ${format(new Date(bookedSessionDate(moveBooking) + "T00:00:00"), "EEE d MMM")}`
                : ""}
              . Change the date, the class, or both — only{" "}
              {moveBooking?.classes?.class_type === "adult" ? "adult" : "children's"} classes are
              listed. The dancer and the amount already paid stay exactly as they are.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Class</p>
              <Select value={moveClassId} onValueChange={onMoveClassPicked}>
                <SelectTrigger><SelectValue placeholder="Choose a class..." /></SelectTrigger>
                <SelectContent>
                  {moveClasses.length === 0 ? (
                    <div className="px-2 py-3 text-sm text-muted-foreground">
                      No other {moveBooking?.classes?.class_type === "adult" ? "adult" : "children's"} classes to move this to.
                    </div>
                  ) : moveClasses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} · {c.day_of_week.charAt(0).toUpperCase() + c.day_of_week.slice(1)}
                      {c.start_time ? ` ${formatTime(c.start_time)}` : ""}
                      {c.venues?.name ? ` · ${c.venues.name}` : ""}
                      {c.id === moveBooking?.class_id ? " — same class, new date" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {bookedSessionDate(moveBooking) && moveClassId && (
              <div className="space-y-1.5">
                <p className="text-sm font-medium">New date</p>
                {moveSessions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {moveClassId === moveBooking?.class_id
                      ? "No other dates left at this class — pick a different class."
                      : "No upcoming sessions at that class — pick a different one."}
                  </p>
                ) : (
                  <Select value={moveSessionDate} onValueChange={setMoveSessionDate}>
                    <SelectTrigger><SelectValue placeholder="Choose a date..." /></SelectTrigger>
                    <SelectContent>
                      {moveSessions.map((s) => (
                        <SelectItem key={s.id} value={s.session_date}>
                          {format(new Date(s.session_date + "T00:00:00"), "EEE d MMM yyyy")} · {formatTime(s.start_time)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {moveBooking?.booking_type === "term" && (
              <p className="text-xs text-muted-foreground">
                Termly booking: if the new class has a different price, settle any difference with
                the parent separately — the system won't charge or refund on a move.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveBooking(null)}>Cancel</Button>
            <Button onClick={saveMove} disabled={moveSaving || !moveClassId}>
              {moveSaving ? "Moving..." : "Move booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  return { actions, dialogs };
}

export default useBookingActions;
