import { useState } from "react";
import { useCart, type PricingPlan, type CartItem } from "@/contexts/CartContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ShoppingCart, Trash2, CreditCard, Pencil, CalendarDays, ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
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
    trial: "Free Trial",
    session: "Per Session",
    monthly: "Monthly",
    term: "Full Term",
  };

  const toggleDates = (id: string) => setOpenDates(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <>
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent className="w-full sm:max-w-md flex flex-col">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Your Basket
              {items.length > 0 && (
                <Badge variant="secondary" className="ml-auto">{items.length} item{items.length !== 1 ? "s" : ""}</Badge>
              )}
            </SheetTitle>
          </SheetHeader>

          {items.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Your basket is empty
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto space-y-3 py-4">
                {items.map(item => {
                  const dates = item.selectedSessionDates ?? [];
                  const hasDates = dates.length > 0;
                  const showDatesUI = item.pricingPlan === "session" || item.pricingPlan === "trial";
                  const canEdit = item.pricingPlan === "session" || item.pricingPlan === "trial";
                  return (
                    <div key={item.id} className="bg-muted/30 rounded-lg p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-foreground truncate">
                            {item.className} <span className="text-muted-foreground font-normal">({item.classType === "adult" ? "Adults" : "Children"})</span>
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
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-primary"
                              onClick={() => setEditingItem(item)}
                              title="Edit dates"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => removeItem(item.id)}
                            title="Remove"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>

                      {showDatesUI && hasDates && (
                        <Collapsible open={!!openDates[item.id]} onOpenChange={() => toggleDates(item.id)}>
                          <CollapsibleTrigger asChild>
                            <button className="flex items-center gap-1 text-[11px] text-primary hover:underline">
                              <CalendarDays className="w-3 h-3" />
                              View dates ({dates.length})
                              <ChevronDown className={`w-3 h-3 transition-transform ${openDates[item.id] ? "rotate-180" : ""}`} />
                            </button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="pt-1.5">
                            <ul className="grid grid-cols-2 gap-1 pl-4">
                              {dates.map((d, idx) => (
                                <li key={idx} className="text-[11px] text-muted-foreground flex items-center gap-1">
                                  <span className="w-1 h-1 rounded-full bg-primary/60" /> {d}
                                </li>
                              ))}
                            </ul>
                          </CollapsibleContent>
                        </Collapsible>
                      )}

                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-[10px]">{planLabel[item.pricingPlan]}</Badge>
                        <span className="font-bold text-foreground">£{item.totalPrice.toFixed(2)}</span>
                      </div>
                      {item.termDiscountPercent && item.pricingPlan === "term" && (
                        <p className="text-[10px] text-green-400">Saving {item.termDiscountPercent}% with term booking</p>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-border pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Total</span>
                  <span className="text-xl font-bold text-foreground">£{totalAmount.toFixed(2)}</span>
                </div>
                <Button onClick={handleCheckout} className="w-full gap-2" size="lg">
                  <CreditCard className="w-4 h-4" />
                  Proceed to Checkout
                </Button>
                <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground" onClick={() => { clearCart(); setIsOpen(false); }}>
                  Clear Basket
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
