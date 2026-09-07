import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronDown, Pencil, Trash2, X } from "lucide-react";
import { useCart, type PricingPlan, type CartItem } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useIsPhone } from "@/hooks/useMediaQuery";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { EmptyState, ResponsiveSheet } from "@/components/booking";
import { formatDay, formatPrice, formatTimeRange } from "@/lib/bookingFormat";
import { cn } from "@/lib/utils";
import { EditCartItemDialog } from "./EditCartItemDialog";

const PLAN_LABEL: Record<PricingPlan, string> = {
  trial: "Trial class",
  session: "Pay as you go",
  monthly: "Monthly membership",
  term: "Pay for the term",
  yearly: "Pay for the year",
  pass: "Class pass",
};

const iconButtonClass =
  "pressable inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background";

interface BasketRowProps {
  item: CartItem;
  datesOpen: boolean;
  onToggleDates: () => void;
  onEdit: () => void;
  onRemove: () => void;
}

/** One line in the basket: what, for whom, when, on which plan, and the price. */
const BasketRow = ({ item, datesOpen, onToggleDates, onEdit, onRemove }: BasketRowProps) => {
  const dates = item.selectedSessionDates ?? [];
  const hasDates = dates.length > 0;
  const showDatesUI = item.pricingPlan === "session" || item.pricingPlan === "trial";
  const isMembership = item.pricingPlan === "monthly" || item.pricingPlan === "term" || item.pricingPlan === "yearly";
  // Drop-in/trial items edit their dates; children's membership
  // items can switch plan (monthly/termly/yearly) in place.
  const canEdit = showDatesUI ||
    ((item.itemKind ?? "class") === "class" && isMembership && item.classType === "children");
  const kind = item.itemKind ?? "class";

  const audience = item.classType === "adult" ? "Adult class" : "Children's class";
  const forWhom = item.studentName ? `For ${item.studentName}` : audience;
  const when = (kind === "pass"
    ? [item.venueName]
    : [
        kind === "class" ? formatDay(item.dayOfWeek, "plural") : formatDay(item.dayOfWeek),
        formatTimeRange(item.startTime, item.endTime),
        item.venueName,
      ]
  ).filter(Boolean).join(" · ");

  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold leading-snug text-foreground">{item.className}</p>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{forWhom}</p>
          {when && <p className="text-[13px] text-muted-foreground">{when}</p>}
        </div>
        <div className="-mr-3 -mt-2 flex shrink-0 items-center">
          {canEdit && (
            <button
              type="button"
              className={iconButtonClass}
              onClick={onEdit}
              aria-label={showDatesUI ? `Edit dates for ${item.className}` : `Change plan for ${item.className}`}
              title={showDatesUI ? "Edit dates" : "Change plan"}
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            className={cn(iconButtonClass, "hover:text-destructive")}
            onClick={onRemove}
            aria-label={`Remove ${item.className} from basket`}
            title="Remove"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {showDatesUI && hasDates && (
        <Collapsible open={datesOpen} onOpenChange={onToggleDates}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="mt-1.5 inline-flex min-h-[32px] items-center gap-1 text-[13px] font-medium text-foreground underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
            >
              View dates ({dates.length})
              <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", datesOpen && "rotate-180")} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-1.5">
            <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
              {dates.map((d, idx) => (
                <li key={idx} className="text-[13px] tabular-nums text-muted-foreground">{d}</li>
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      )}

      <div className="mt-2.5 flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-medium text-muted-foreground">{PLAN_LABEL[item.pricingPlan]}</span>
        <span className="text-[15px] font-semibold tabular-nums text-foreground">{formatPrice(item.totalPrice)}</span>
      </div>
      {item.termDiscountPercent && item.pricingPlan === "term" && (
        <p className="mt-1 text-[13px] text-success">Saving {item.termDiscountPercent}% with term booking</p>
      )}
    </li>
  );
};

const CartDrawer = () => {
  const { items, removeItem, isOpen, setIsOpen, totalAmount, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isPhone = useIsPhone();
  const [editingItem, setEditingItem] = useState<CartItem | null>(null);
  const [openDates, setOpenDates] = useState<Record<string, boolean>>({});

  const handleCheckout = () => {
    if (!user) {
      toast({ title: "Sign in required", description: "Please sign in to complete your booking.", variant: "destructive" });
      setIsOpen(false);
      navigate("/auth");
      return;
    }
    setIsOpen(false);
    navigate("/checkout");
  };

  const toggleDates = (id: string) => setOpenDates(prev => ({ ...prev, [id]: !prev[id] }));

  const countLabel = items.length === 0
    ? "Nothing added yet"
    : `${items.length} ${items.length === 1 ? "item" : "items"}`;

  const body = items.length === 0 ? (
    <EmptyState
      className="py-10 sm:py-12"
      title="Your basket is empty"
      body="Classes you add will appear here, ready to check out."
      action={
        <Button asChild variant="soft" className="rounded-full">
          <Link to="/classes/children" onClick={() => setIsOpen(false)}>Browse classes</Link>
        </Button>
      }
    />
  ) : (
    <ul className="divide-y divide-border">
      {items.map(item => (
        <BasketRow
          key={item.id}
          item={item}
          datesOpen={!!openDates[item.id]}
          onToggleDates={() => toggleDates(item.id)}
          onEdit={() => setEditingItem(item)}
          onRemove={() => removeItem(item.id)}
        />
      ))}
    </ul>
  );

  const footer = items.length > 0 ? (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <span className="text-[15px] text-muted-foreground">Total</span>
        <span className="text-xl font-semibold tabular-nums text-foreground">{formatPrice(totalAmount)}</span>
      </div>
      <Button size="xl" className="w-full rounded-full" onClick={handleCheckout}>
        Continue to checkout
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="w-full text-muted-foreground hover:text-foreground"
        onClick={() => { clearCart(); setIsOpen(false); }}
      >
        Clear basket
      </Button>
    </div>
  ) : undefined;

  return (
    <>
      {isPhone ? (
        <ResponsiveSheet
          open={isOpen}
          onOpenChange={setIsOpen}
          title="Your basket"
          description={countLabel}
          footer={footer}
          themeClass="portal-ui"
        >
          {body}
        </ResponsiveSheet>
      ) : (
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetContent
            side="right"
            className="portal-ui flex w-full flex-col gap-0 border-l border-border bg-card p-0 text-card-foreground sm:max-w-md [&>button]:hidden"
          >
            <div className="flex shrink-0 items-start justify-between gap-4 px-6 pb-4 pt-6">
              <div className="min-w-0">
                <SheetTitle className="text-xl font-semibold tracking-tight text-foreground">Your basket</SheetTitle>
                <SheetDescription className="mt-1 text-sm text-muted-foreground">{countLabel}</SheetDescription>
              </div>
              <SheetClose
                className="pressable -mr-2 -mt-2 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </SheetClose>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">{body}</div>
            {footer && <div className="shrink-0 border-t border-border bg-card px-6 py-4">{footer}</div>}
          </SheetContent>
        </Sheet>
      )}

      <EditCartItemDialog
        open={!!editingItem}
        onOpenChange={(o) => { if (!o) setEditingItem(null); }}
        item={editingItem}
      />
    </>
  );
};

export default CartDrawer;
