import { useEffect, useRef, useState } from "react";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Check } from "lucide-react";

const CartButton = () => {
  const { itemCount, setIsOpen, lastAdded } = useCart();
  const [bump, setBump] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const lastSeenAtRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!lastAdded) return;
    if (lastSeenAtRef.current === lastAdded.at) return;
    lastSeenAtRef.current = lastAdded.at;

    setBump(true);
    setShowPopup(true);

    const bumpTimer = window.setTimeout(() => setBump(false), 600);
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => setShowPopup(false), 2800);

    return () => {
      window.clearTimeout(bumpTimer);
    };
  }, [lastAdded]);

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className={`relative text-foreground hover:text-primary transition-transform ${bump ? "animate-cart-bump" : ""}`}
        onClick={() => setIsOpen(true)}
        aria-label="Open basket"
      >
        <ShoppingCart className="w-5 h-5" />
        {itemCount > 0 && (
          <span
            key={itemCount}
            className={`absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center ${bump ? "animate-badge-pop" : ""}`}
          >
            {itemCount}
          </span>
        )}
      </Button>

      {/* Anchored popup with arrow pointing UP to the basket icon */}
      {showPopup && lastAdded && (
        <div className="absolute right-0 top-full mt-3 z-50 animate-fade-in pointer-events-none">
          {/* Arrow */}
          <div
            className="absolute -top-1.5 right-4 w-3 h-3 rotate-45 border-l border-t border-primary/40"
            style={{ background: "hsl(var(--card))" }}
          />
          <div className="relative w-64 rounded-lg border border-primary/40 bg-card shadow-xl shadow-primary/20 px-3 py-2.5">
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                <Check className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-primary">Added to basket</p>
                <p className="text-sm font-semibold text-foreground truncate">
                  {lastAdded.item.className}{" "}
                  <span className="text-muted-foreground font-normal text-xs">
                    ({lastAdded.item.classType === "adult" ? "Adults" : "Children"})
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CartButton;
