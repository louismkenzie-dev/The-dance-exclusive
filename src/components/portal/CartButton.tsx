import { useEffect, useRef, useState } from "react";
import { useCart } from "@/contexts/CartContext";
import { ShoppingBag, Check } from "lucide-react";
import { cn } from "@/lib/utils";

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
      <button
        type="button"
        className={cn(
          "pressable relative inline-flex h-11 w-11 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
          bump && "animate-cart-bump",
        )}
        onClick={() => setIsOpen(true)}
        aria-label={itemCount > 0 ? `Open basket, ${itemCount} ${itemCount === 1 ? "item" : "items"}` : "Open basket"}
      >
        <ShoppingBag className="h-[22px] w-[22px]" strokeWidth={1.75} />
        {itemCount > 0 && (
          <span
            key={itemCount}
            className={cn(
              "absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[11px] font-semibold leading-none text-primary-foreground ring-2 ring-background",
              bump && "animate-badge-pop",
            )}
            aria-hidden
          >
            {itemCount}
          </span>
        )}
      </button>

      {/* Anchored confirmation with an arrow pointing up to the basket icon */}
      {showPopup && lastAdded && (
        <div className="pointer-events-none absolute right-0 top-full z-50 mt-3 animate-fade-in" role="status">
          <div className="absolute -top-1.5 right-4 h-3 w-3 rotate-45 border-l border-t border-border bg-card" aria-hidden />
          <div className="surface relative w-64 px-3.5 py-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success/10">
                <Check className="h-3.5 w-3.5 text-success" strokeWidth={3} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-muted-foreground">Added to basket</p>
                <p className="truncate text-[15px] font-semibold text-foreground">{lastAdded.item.className}</p>
                <p className="text-[13px] text-muted-foreground">
                  {lastAdded.item.classType === "adult" ? "Adult class" : "Children's class"}
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
