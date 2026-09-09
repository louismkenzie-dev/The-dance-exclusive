import { useState, type ReactNode } from "react";
import { ArrowRightLeft, Ban, Check, ChevronDown, ChevronRight, MoreHorizontal, Repeat, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResponsiveSheet } from "@/components/booking/ResponsiveSheet";
import { useIsPhone } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

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

interface Action {
  id: string;
  label: string;
  /** One line under the label in the phone sheet: what the action does. */
  hint: string;
  icon: ReactNode;
  tone: "default" | "primary" | "destructive";
  run: () => void;
}

/** Everything that can be done to this booking right now, in the order it
 *  is offered. The same list drives the desktop row and the phone sheet. */
function actionsFor(b: ActionableBooking, a: BookingActionHandlers): Action[] {
  const list: Action[] = [];
  if (b.status === "pending_payment") {
    list.push({
      id: "confirm",
      label: "Confirm booking",
      hint: "Mark it as paid and put them on the register",
      icon: <Check className="h-4 w-4" />,
      tone: "primary",
      run: () => a.onConfirm(b.id),
    });
  }
  if (b.status === "confirmed" && b.class_id && MOVABLE_TYPES.includes(b.booking_type)) {
    list.push({
      id: "move",
      label: "Move",
      hint: "A different date, a different class, or both",
      icon: <ArrowRightLeft className="h-4 w-4" />,
      tone: "default",
      run: () => a.onMove(b),
    });
  }
  if (b.status === "confirmed" && b.class_id && b.booking_type === "monthly") {
    list.push({
      id: "move-membership",
      label: "Move class",
      hint: "Transfer the membership to another class",
      icon: <Repeat className="h-4 w-4" />,
      tone: "default",
      run: () => a.onMoveMembership(b),
    });
  }
  if (isRefundable(b)) {
    list.push({
      id: "refund",
      label: "Refund",
      hint: "Send some or all of the money back to their card",
      icon: <RotateCcw className="h-4 w-4" />,
      tone: "destructive",
      run: () => a.onRefund(b),
    });
  }
  if (b.status !== "cancelled") {
    list.push({
      id: "cancel",
      label: "Cancel booking",
      hint: "Takes them off the register — no money moves",
      icon: <Ban className="h-4 w-4" />,
      tone: "destructive",
      run: () => a.onCancel(b.id),
    });
  }
  return list;
}

const dancerLine = (b: ActionableBooking) => {
  const dancer = b.students ? `${b.students.first_name} ${b.students.last_name}` : "Adult booking";
  const parent = b.profiles?.full_name;
  const parts = [dancer];
  if (parent && parent !== dancer) parts.push(parent);
  if (b.amount != null) parts.push(`£${Number(b.amount).toFixed(2)}`);
  return parts.join(" · ");
};

/**
 * The actions on a booking, identical on every tab.
 *
 * On a desktop they sit in a row of small buttons. On a phone the row becomes
 * a two-button bar along the bottom of the card — "Details" opens the
 * breakdown in place, "Manage" opens a bottom sheet listing what can be done
 * to the booking, each with a line saying what it means. The bar expects to
 * be the last thing inside a card padded p-4.
 */
export function BookingActions({
  booking: b,
  actions: a,
  className,
}: {
  booking: ActionableBooking;
  actions: BookingActionHandlers;
  className?: string;
}) {
  const isPhone = useIsPhone();
  const [open, setOpen] = useState(false);
  const list = actionsFor(b, a);
  const detailsOpen = a.breakdownId === b.id;

  if (isPhone) {
    return (
      <>
        <div className={cn("-mx-4 -mb-4 mt-3 flex divide-x divide-border/70 border-t border-border/70", className)}>
          <button
            type="button"
            onClick={() => a.toggleBreakdown(b.id)}
            aria-expanded={detailsOpen}
            className={cn(
              "pressable flex h-12 flex-1 items-center justify-center gap-1.5 text-sm font-medium",
              detailsOpen ? "text-foreground" : "text-muted-foreground",
            )}
          >
            Details
            <ChevronDown className={cn("h-4 w-4 transition-transform", detailsOpen && "rotate-180")} />
          </button>
          {list.length > 0 && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="pressable flex h-12 flex-1 items-center justify-center gap-1.5 text-sm font-semibold text-foreground"
            >
              Manage
              <MoreHorizontal className="h-4 w-4" />
            </button>
          )}
        </div>
        <ResponsiveSheet
          open={open}
          onOpenChange={setOpen}
          title={b.classes?.name ?? "Booking"}
          description={dancerLine(b)}
        >
          <div className="space-y-2 pb-1">
            {list.map((act) => (
              <button
                key={act.id}
                type="button"
                onClick={() => {
                  setOpen(false);
                  act.run();
                }}
                className={cn(
                  "pressable flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors",
                  act.tone === "destructive"
                    ? "border-destructive/30 bg-destructive/5 text-[hsl(var(--destructive-strong))]"
                    : act.tone === "primary"
                      ? "border-primary/40 bg-primary/10 text-foreground"
                      : "border-border bg-card text-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                    act.tone === "destructive" ? "bg-destructive/10" : act.tone === "primary" ? "bg-primary/15 text-primary" : "bg-muted",
                  )}
                >
                  {act.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold">{act.label}</span>
                  <span className={cn("block text-[13px]", act.tone === "destructive" ? "text-[hsl(var(--destructive-strong))]/80" : "text-muted-foreground")}>
                    {act.hint}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 opacity-50" />
              </button>
            ))}
          </div>
        </ResponsiveSheet>
      </>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-center justify-end gap-1.5", className)}>
      <Button
        size="sm"
        variant={detailsOpen ? "secondary" : "outline"}
        className="whitespace-nowrap"
        onClick={() => a.toggleBreakdown(b.id)}
      >
        Breakdown
        <ChevronDown className={cn("ml-1 h-3.5 w-3.5 transition-transform", detailsOpen && "rotate-180")} />
      </Button>
      {list.map((act) => (
        <Button
          key={act.id}
          size="sm"
          variant={act.tone === "primary" ? "default" : "outline"}
          className={cn(
            "whitespace-nowrap",
            act.tone === "destructive" && "border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive",
          )}
          onClick={act.run}
        >
          {act.id === "cancel" ? "Cancel" : act.id === "confirm" ? "Confirm" : act.label}
        </Button>
      ))}
    </div>
  );
}

export default BookingActions;
