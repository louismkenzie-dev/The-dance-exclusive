import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";

/**
 * The fields every admin action needs, whichever tab the row is on. The
 * Bookings, Trials and One-to-ones tabs all shape their rows to this, so a
 * booking can be opened, moved, refunded or cancelled from wherever the
 * studio happens to be looking at it.
 */
export interface ActionableBooking {
  id: string;
  status: string;
  booking_type: string;
  class_id: string | null;
  student_id?: string | null;
  amount: number | null;
  notes: string | null;
  classes: { name: string; class_type?: "children" | "adult" | null } | null;
  students: { first_name: string; last_name: string } | null;
  profiles?: { full_name: string; email: string; phone?: string | null } | null;
}

/** The handlers behind the buttons. One set, owned by the Bookings page and
 *  handed to every tab, so the actions can never drift apart. */
export interface BookingActionHandlers {
  breakdownId: string | null;
  toggleBreakdown: (id: string) => void;
  onConfirm: (id: string) => void;
  onCancel: (id: string) => void;
  onMove: (booking: ActionableBooking) => void;
  onMoveMembership: (booking: ActionableBooking) => void;
  onRefund: (booking: ActionableBooking) => void;
}

/** Booking types the admin can move to another class or date in place.
 *  Monthly memberships are excluded — they're Stripe subscriptions with
 *  their own change-class flow; camps and passes have no class to move. */
export const MOVABLE_TYPES = ["trial", "session", "drop_in", "term", "yearly"];

/** Money actually taken through Stripe, and not already sent back. */
export const isRefundable = (b: Pick<ActionableBooking, "amount" | "notes">) =>
  Number(b.amount) > 0 && /pi_[A-Za-z0-9]+/.test(b.notes || "") && !/refunded £/.test(b.notes || "");

/** The row of actions on a booking, identical on every tab. */
export function BookingActions({
  booking: b,
  actions: a,
}: {
  booking: ActionableBooking;
  actions: BookingActionHandlers;
}) {
  return (
    <div className="flex items-center justify-end gap-2 flex-wrap">
      <Button
        size="sm"
        variant={a.breakdownId === b.id ? "secondary" : "outline"}
        onClick={() => a.toggleBreakdown(b.id)}
      >
        Breakdown
        <ChevronDown className={`w-3.5 h-3.5 ml-1 transition-transform ${a.breakdownId === b.id ? "rotate-180" : ""}`} />
      </Button>
      {b.status === "pending_payment" && (
        <Button size="sm" onClick={() => a.onConfirm(b.id)}>Confirm</Button>
      )}
      {b.status === "confirmed" && b.class_id && MOVABLE_TYPES.includes(b.booking_type) && (
        <Button size="sm" variant="outline" onClick={() => a.onMove(b)}>Move</Button>
      )}
      {b.status === "confirmed" && b.class_id && b.booking_type === "monthly" && (
        <Button size="sm" variant="outline" onClick={() => a.onMoveMembership(b)}>Move class</Button>
      )}
      {isRefundable(b) && (
        <Button
          size="sm"
          variant="outline"
          className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => a.onRefund(b)}
        >
          Refund
        </Button>
      )}
      {b.status !== "cancelled" && (
        <Button size="sm" variant="outline" onClick={() => a.onCancel(b.id)}>Cancel</Button>
      )}
    </div>
  );
}

export default BookingActions;
