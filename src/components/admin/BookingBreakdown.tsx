import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, CreditCard, Receipt, User } from "lucide-react";
import {
  derivePriceBreakdown,
  paymentRefOf,
  refundNoteOf,
  sessionDateOf,
} from "@/lib/bookingBreakdown";
import { round2, type PricedClass } from "@/lib/pricing";

/**
 * The expandable "what exactly did they pay for?" panel under an admin
 * booking: who booked it, the whole payment it was part of, the price
 * itemised (base → discount → paid), and every session date the booking
 * covers — with dates that fall in a school holiday flagged, because "15
 * sessions" quietly including half-term week is precisely the sort of thing
 * that starts a parent email.
 */

export interface BreakdownBooking {
  id: string;
  booking_type: string;
  amount: number | null;
  booked_at: string;
  notes: string | null;
  class_id: string | null;
  camp_id?: string | null;
  classes: (PricedClass & { name: string; term_end?: string | null }) | null;
  students: { first_name: string; last_name: string } | null;
}

export interface PaymentSibling {
  id: string;
  studentName: string;
  className: string;
  plan: string;
  amount: number;
}

interface Props {
  booking: BreakdownBooking;
  parent: { full_name: string; email: string; phone?: string | null } | null;
  /** Every booking paid in the same Stripe payment (this one included). */
  samePayment: PaymentSibling[];
}

interface Holiday { name: string; start_date: string; end_date: string }

const PLAN_LABEL: Record<string, string> = {
  trial: "Trial",
  session: "Pay as you go",
  term: "Termly",
  yearly: "Yearly",
  monthly: "Monthly membership",
  camp: "Holiday camp",
};

const holidayFor = (d: string, holidays: Holiday[]) =>
  holidays.find((h) => d >= h.start_date && d <= h.end_date) ?? null;

const BookingBreakdown = ({ booking, parent, samePayment }: Props) => {
  const [dates, setDates] = useState<string[] | null>(null);
  const [holidays, setHolidays] = useState<Holiday[]>([]);

  const plan = booking.booking_type;
  const bookedDate = booking.booked_at.slice(0, 10);
  const singleDate = sessionDateOf(booking.notes);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const holidaysReq = supabase
        .from("school_holidays")
        .select("name, start_date, end_date")
        .neq("holiday_type", "bank_holiday");

      // Which dates does this booking cover?
      //  - dated plans: the one date in the notes
      //  - term: the class's sessions from booking day to the class's term end
      //  - yearly: everything scheduled from booking day
      //  - monthly: rolling — no fixed list
      //  - camps: every day of the event
      let datesReq: PromiseLike<{ data: unknown }> = Promise.resolve({ data: null });
      if (singleDate) {
        datesReq = Promise.resolve({ data: [{ session_date: singleDate }] });
      } else if ((plan === "term" || plan === "yearly") && booking.class_id) {
        let q = supabase
          .from("class_sessions")
          .select("session_date")
          .eq("class_id", booking.class_id)
          .neq("status", "cancelled")
          .gte("session_date", bookedDate)
          .order("session_date");
        if (plan === "term" && booking.classes?.term_end) {
          q = q.lte("session_date", booking.classes.term_end);
        }
        datesReq = q;
      } else if (booking.camp_id) {
        datesReq = supabase
          .from("camp_sessions")
          .select("session_date")
          .eq("camp_id", booking.camp_id)
          .order("session_date");
      }

      const [{ data: hols }, { data: sess }] = await Promise.all([holidaysReq, datesReq]);
      if (cancelled) return;
      setHolidays(((hols as Holiday[]) ?? []));
      setDates(sess ? ((sess as { session_date: string }[]).map((s) => s.session_date)) : null);
    })();
    return () => { cancelled = true; };
  }, [booking.id, booking.class_id, booking.camp_id, plan, bookedDate, singleDate, booking.classes?.term_end]);

  const breakdown = derivePriceBreakdown(
    plan,
    Number(booking.amount ?? 0),
    booking.classes,
    dates?.length ?? 0,
  );
  const refund = refundNoteOf(booking.notes);
  const payRef = paymentRefOf(booking.notes);
  const paymentTotal = round2(samePayment.reduce((sum, s) => sum + s.amount, 0));
  const holidayDates = (dates ?? []).filter((d) => holidayFor(d, holidays));

  return (
    <div className="mt-3 pt-3 border-t border-border/60 grid gap-4 md:grid-cols-3 text-sm animate-fade-in">
      {/* Who booked it, and the payment it belonged to */}
      <div className="space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
          <User className="w-3.5 h-3.5" /> Booked by
        </p>
        {parent ? (
          <div className="space-y-0.5">
            <p className="font-medium">{parent.full_name}</p>
            <a href={`mailto:${parent.email}`} className="block text-xs text-muted-foreground hover:text-foreground">{parent.email}</a>
            {parent.phone && (
              <a href={`tel:${parent.phone}`} className="block text-xs text-muted-foreground hover:text-foreground">{parent.phone}</a>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground">Unknown account</p>
        )}

        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 pt-2">
          <CreditCard className="w-3.5 h-3.5" /> Payment
        </p>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            {format(parseISO(booking.booked_at), "d MMM yyyy 'at' HH:mm")}
            {payRef ? ` · card (…${payRef.slice(-6)})` : " · no card payment on record"}
          </p>
          {samePayment.length > 1 ? (
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">This payment covered {samePayment.length} bookings:</p>
              {samePayment.map((s) => (
                <p key={s.id} className={`text-xs flex justify-between gap-2 ${s.id === booking.id ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                  <span className="truncate">{s.studentName} — {s.className} ({PLAN_LABEL[s.plan] ?? s.plan})</span>
                  <span className="whitespace-nowrap">£{s.amount.toFixed(2)}</span>
                </p>
              ))}
              <p className="text-xs flex justify-between gap-2 border-t border-border/40 pt-0.5 font-semibold">
                <span>Payment total</span>
                <span>£{paymentTotal.toFixed(2)}</span>
              </p>
            </div>
          ) : (
            payRef && <p className="text-xs text-muted-foreground">Single-item payment.</p>
          )}
          {refund && <Badge variant="destructive" className="text-[10px]">{refund}</Badge>}
        </div>
      </div>

      {/* The money, itemised */}
      <div className="space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
          <Receipt className="w-3.5 h-3.5" /> Price for this booking
        </p>
        <div className="space-y-1">
          {breakdown.lines.map((l, i) => (
            <p
              key={i}
              className={`text-xs flex justify-between gap-3 ${
                l.kind === "total"
                  ? "font-semibold text-foreground border-t border-border/40 pt-1"
                  : l.kind === "discount"
                    ? "text-emerald-500"
                    : l.kind === "note"
                      ? "text-muted-foreground italic"
                      : "text-muted-foreground"
              }`}
            >
              <span>{l.label}</span>
              {l.amount != null && (
                <span className="whitespace-nowrap">
                  {l.amount < 0 ? `−£${Math.abs(l.amount).toFixed(2)}` : `£${l.amount.toFixed(2)}`}
                </span>
              )}
            </p>
          ))}
        </div>
      </div>

      {/* Exactly which dates the booking covers */}
      <div className="space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
          <CalendarDays className="w-3.5 h-3.5" /> Sessions covered
        </p>
        {plan === "monthly" ? (
          <p className="text-xs text-muted-foreground">
            Rolling membership — attends every session of {booking.classes?.name ?? "the class"} while it's active.
          </p>
        ) : dates == null ? (
          <p className="text-xs text-muted-foreground">Loading dates…</p>
        ) : dates.length === 0 ? (
          <p className="text-xs text-muted-foreground">No scheduled dates found for this booking.</p>
        ) : (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">{dates.length}</strong> session{dates.length === 1 ? "" : "s"}: {format(parseISO(dates[0]), "d MMM")} – {format(parseISO(dates[dates.length - 1]), "d MMM yyyy")}
            </p>
            <div className="flex flex-wrap gap-1">
              {dates.map((d) => {
                const hol = holidayFor(d, holidays);
                return (
                  <span
                    key={d}
                    title={hol ? `${format(parseISO(d), "EEE d MMM")} — ${hol.name}` : format(parseISO(d), "EEEE d MMMM yyyy")}
                    className={`text-[10px] px-1.5 py-0.5 rounded border ${
                      hol
                        ? "border-pink-500/50 bg-pink-500/10 text-pink-400 font-semibold"
                        : "border-border/50 bg-muted/30 text-muted-foreground"
                    }`}
                  >
                    {format(parseISO(d), "d MMM")}
                  </span>
                );
              })}
            </div>
            {holidayDates.length > 0 && (
              <p className="text-[11px] text-pink-400">
                {holidayDates.length === 1 ? "One date falls" : `${holidayDates.length} dates fall`} in a school
                holiday ({[...new Set(holidayDates.map((d) => holidayFor(d, holidays)!.name))].join(", ")}) — worth
                mentioning to the parent when confirming session counts.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BookingBreakdown;
