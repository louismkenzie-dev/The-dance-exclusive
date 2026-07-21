import { useState } from "react";
import { useCart, type PricingPlan, type CartItem } from "@/contexts/CartContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ShoppingCart, Trash2, CreditCard, Pencil, CalendarDays, ChevronDown, Music } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Stagger } from "@/components/motion";
import { EditCartItemDialog } from "./EditCartItemDialog";

const CartDrawer = () => {
  const { items, removeItem, isOpen, setIsOpen, totalAmount, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
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

  const planLabel: Record<PricingPlan, string> = {
    trial: "Free trial",
    session: "Per session",
    monthly: "Monthly",
    term: "Full term",
  };

  const toggleDates = (id: string) => setOpenDates(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <>
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent className="flex w-full flex-col sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <ShoppingCart className="h-5 w-5" />
              </span>
              Your basket
              {items.length > 0 && (
                <Badge variant="secondary" className="ml-auto">{items.length} item{items.length !== 1 ? "s" : ""}</Badge>
              )}
            </SheetTitle>
          </SheetHeader>

          {items.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
                <ShoppingCart className="h-5 w-5" />
              </span>
              <p className="text-sm text-muted-foreground">Your basket is empty</p>
            </div>
          ) : (
            <>
              <Stagger className="flex-1 space-y-3 overflow-y-auto py-4" step={60}>
                {items.map(item => {
                  const dates = item.selectedSessionDates ?? [];
                  const hasDates = dates.length > 0;
                  const showDatesUI = item.pricingPlan === "session" || item.pricingPlan === "trial";
                  const canEdit = item.pricingPlan === "session" || item.pricingPlan === "trial";
                  return (
                    <div key={item.id} className="space-y-3 rounded-2xl bg-secondary/50 p-4">
                      <div className="flex items-start gap-3">
                        <span
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                            item.classType === "adult" ? "bg-accent/10 text-accent" : "bg-primary/10 text-primary"
                          }`}
                        >
                          <Music className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {item.className} <span className="font-normal text-muted-foreground">({item.classType === "adult" ? "Adults" : "Children"})</span>
                          </p>
                          {item.studentName && (
                            <p className="text-xs text-muted-foreground">for {item.studentName}</p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {item.dayOfWeek.charAt(0).toUpperCase() + item.dayOfWeek.slice(1)} · {item.startTime?.slice(0, 5)}–{item.endTime?.slice(0, 5)}
                          </p>
                          {item.venueName && (
                            <p className="text-xs text-muted-foreground">{item.venueName}</p>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-primary"
                              onClick={() => setEditingItem(item)}
                              title="Edit dates"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => removeItem(item.id)}
                            title="Remove"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      {showDatesUI && hasDates && (
                        <Collapsible open={!!openDates[item.id]} onOpenChange={() => toggleDates(item.id)}>
                          <CollapsibleTrigger asChild>
                            <button className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
                              <CalendarDays className="h-3.5 w-3.5" />
                              View dates ({dates.length})
                              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${openDates[item.id] ? "rotate-180" : ""}`} />
                            </button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="pt-2">
                            <ul className="grid grid-cols-2 gap-1.5 pl-1">
                              {dates.map((d, idx) => (
                                <li key={idx} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <span className="h-1 w-1 rounded-full bg-primary/60" /> {d}
                                </li>
                              ))}
                            </ul>
                          </CollapsibleContent>
                        </Collapsible>
                      )}

                      <div className="flex items-center justify-between">
                        <Badge variant="secondary" className="bg-card">{planLabel[item.pricingPlan]}</Badge>
                        <span className="font-display font-bold tabular-nums text-foreground">£{item.totalPrice.toFixed(2)}</span>
                      </div>
                      {item.termDiscountPercent && item.pricingPlan === "term" && (
                        <p className="text-[11px] font-medium text-success">Saving {item.termDiscountPercent}% with term booking</p>
                      )}
                    </div>
                  );
                })}
              </Stagger>

              <div className="space-y-3 border-t border-border/50 pt-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Total</span>
                  <span className="font-display text-2xl font-bold tabular-nums text-foreground">£{totalAmount.toFixed(2)}</span>
                </div>
                <Button onClick={handleCheckout} className="w-full gap-2" size="lg">
                  <CreditCard className="h-4 w-4" />
                  Proceed to checkout
                </Button>
                <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground" onClick={() => { clearCart(); setIsOpen(false); }}>
                  Clear basket
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <EditCartItemDialog
        open={!!editingItem}
        onOpenChange={(o) => { if (!o) setEditingItem(null); }}
        item={editingItem}
      />
    </>
  );
};

export default CartDrawer;
