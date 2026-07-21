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
        <ShoppingCart className="h-5 w-5" />
        {itemCount > 0 && (
          <span
            key={itemCount}
            className={`absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground ${bump ? "animate-badge-pop" : ""}`}
          >
            {itemCount}
          </span>
        )}
      </Button>

      {/* Anchored toast card with arrow pointing up to the basket icon */}
      {showPopup && lastAdded && (
        <div className="pointer-events-none absolute right-0 top-full z-50 mt-3 animate-fade-in">
          {/* Arrow */}
          <div className="absolute -top-1 right-4 h-3 w-3 rotate-45 rounded-[3px] bg-card dark:border-l dark:border-t dark:border-border/60" />
          <div className="relative w-64 rounded-2xl border border-transparent bg-card px-4 py-3 shadow-soft-lg dark:border-border/60">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-success/10 text-success">
                <Check className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="eyebrow">Added to basket</p>
                <p className="mt-0.5 truncate text-sm font-semibold text-foreground">
                  {lastAdded.item.className}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
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
