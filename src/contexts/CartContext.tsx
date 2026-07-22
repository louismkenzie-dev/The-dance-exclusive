import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type PricingPlan = "trial" | "session" | "monthly" | "term" | "yearly" | "pass";

/** What kind of product the basket row is: a class booking, a holiday
 *  workshop (camp) booking, or an adult multi-class pass. */
export type CartItemKind = "class" | "camp" | "pass";

export interface CartItem {
  id: string; // unique cart item id
  /** null for camp/pass items */
  classId: string | null;
  className: string;
  classType: "children" | "adult";
  danceStyle: string | null;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  venueName: string | null;
  studentId: string | null;
  studentName: string | null;
  pricingPlan: PricingPlan;
  unitPrice: number;
  totalPrice: number;
  sessionsCount: number | null; // for term plan, how many sessions
  termDiscountPercent: number | null;
  workshopImage: string | null;
  selectedSessionIds?: string[]; // for drop-in: which specific session dates
  selectedSessionDates?: string[]; // human-readable dates for display
  itemKind?: CartItemKind; // defaults to "class" for legacy items
  campId?: string | null; // for holiday workshop (camp) items
  /** for pass items: which adult pass is being bought (week_2 | pack_4 | pack_6 | pack_8) */
  passType?: string | null;
}

export const cartItemKind = (item: Pick<CartItem, "itemKind">): CartItemKind =>
  item.itemKind ?? "class";

interface CartContextType {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  updateItemPlan: (id: string, plan: PricingPlan, unitPrice: number, totalPrice: number) => void;
  updateItem: (id: string, patch: Partial<CartItem>) => void;
  clearCart: () => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  isHydrating: boolean;
  totalAmount: number;
  itemCount: number;
  lastAdded: { item: CartItem; at: number } | null;
}

const CartContext = createContext<CartContextType | undefined>(undefined);
const STORAGE_KEY = "tde_cart_v1";

const readLocalCart = (): CartItem[] => {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeLocalCart = (items: CartItem[]) => {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore quota/privacy mode errors
  }
};

const clearLocalCart = () => {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore privacy mode errors
  }
};

const getCartUniquenessKey = (
  item: Pick<CartItem, "classId" | "studentId" | "itemKind" | "campId" | "passType">,
) => {
  const kind = cartItemKind(item);
  if (kind === "camp") return `camp:${item.campId}::${item.studentId ?? "self"}`;
  if (kind === "pass") return `pass:${item.passType}::${item.studentId ?? "self"}`;
  return `${item.classId}::${item.studentId ?? "self"}`;
};

const mergeCartItems = (primary: CartItem[], secondary: CartItem[]) => {
  const merged = new Map(primary.map((item) => [getCartUniquenessKey(item), item]));

  secondary.forEach((item) => {
    const key = getCartUniquenessKey(item);
    if (!merged.has(key)) merged.set(key, item);
  });

  return Array.from(merged.values());
};

const coercePricingPlan = (value: string): PricingPlan => {
  if (
    value === "trial" || value === "session" || value === "monthly" ||
    value === "term" || value === "yearly" || value === "pass"
  ) {
    return value;
  }

  return "session";
};

const coerceItemKind = (value: string | null | undefined): CartItemKind => {
  if (value === "camp" || value === "pass") return value;
  return "class";
};

const mapRowToCartItem = (row: any): CartItem => ({
  id: row.cart_item_id,
  classId: row.class_id,
  className: row.class_name,
  classType: row.class_type,
  danceStyle: row.dance_style,
  dayOfWeek: row.day_of_week,
  startTime: row.start_time,
  endTime: row.end_time,
  venueName: row.venue_name,
  studentId: row.student_id,
  studentName: row.student_name,
  pricingPlan: coercePricingPlan(row.pricing_plan),
  unitPrice: Number(row.unit_price ?? 0),
  totalPrice: Number(row.total_price ?? 0),
  sessionsCount: row.sessions_count,
  termDiscountPercent: row.term_discount_percent == null ? null : Number(row.term_discount_percent),
  workshopImage: row.workshop_image,
  selectedSessionIds: row.selected_session_ids ?? [],
  selectedSessionDates: row.selected_session_dates ?? [],
  itemKind: coerceItemKind(row.item_kind),
  campId: row.camp_id ?? null,
  passType: row.pass_type ?? null,
});

const mapCartItemToRow = (userId: string, item: CartItem) => ({
  user_id: userId,
  cart_item_id: item.id,
  class_id: item.classId,
  class_name: item.className,
  class_type: item.classType,
  dance_style: item.danceStyle,
  day_of_week: item.dayOfWeek,
  start_time: item.startTime,
  end_time: item.endTime,
  venue_name: item.venueName,
  student_id: item.studentId,
  student_name: item.studentName,
  pricing_plan: item.pricingPlan,
  unit_price: item.unitPrice,
  total_price: item.totalPrice,
  sessions_count: item.sessionsCount,
  term_discount_percent: item.termDiscountPercent,
  workshop_image: item.workshopImage,
  selected_session_ids: item.selectedSessionIds ?? [],
  selected_session_dates: item.selectedSessionDates ?? [],
  item_kind: cartItemKind(item),
  camp_id: item.campId ?? null,
  pass_type: item.passType ?? null,
});

const syncRemoteCart = async (userId: string, items: CartItem[]) => {
  const table = supabase.from("cart_items") as any;

  if (items.length === 0) {
    const { error } = await table.delete().eq("user_id", userId);
    if (error) console.error("Failed to clear remote cart", error);
    return;
  }

  const payload = items.map((item) => mapCartItemToRow(userId, item));
  const { error: upsertError } = await table.upsert(payload, { onConflict: "user_id,cart_item_id" });

  if (upsertError) {
    console.error("Failed to sync remote cart", upsertError);
    return;
  }

  const cartIds = items.map((item) => item.id);
  const { error: deleteError } = await table
    .delete()
    .eq("user_id", userId)
    .not("cart_item_id", "in", `(${cartIds.map((id) => JSON.stringify(id)).join(",")})`);

  if (deleteError) {
    console.error("Failed to prune remote cart", deleteError);
  }
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be inside CartProvider");
  return ctx;
};

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  // Initialise from localStorage synchronously so the cart is never momentarily
  // empty between renders (which could otherwise be persisted back to storage).
  const [items, setItems] = useState<CartItem[]>(() => readLocalCart());
  const [isOpen, setIsOpen] = useState(false);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [lastAdded, setLastAdded] = useState<{ item: CartItem; at: number } | null>(null);
  // Track which user (if any) the current `items` state belongs to. Prevents
  // the sync effect from wiping the remote cart of user A with user B's items
  // during the auth transition window.
  const [itemsOwnerId, setItemsOwnerId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;

    let cancelled = false;

    const hydrateCart = async () => {
      if (!user?.id) {
        // Logged out: keep whatever is in localStorage. Do NOT clear in-memory
        // items here — the user may simply have signed out and we want their
        // basket to persist locally until they sign back in.
        if (!cancelled) {
          const localItems = readLocalCart();
          setItems(localItems);
          setItemsOwnerId(null);
          setHasHydrated(true);
        }
        return;
      }

      try {
        const localItems = readLocalCart();
        const { data, error } = await (supabase.from("cart_items") as any)
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true });

        if (error) throw error;

        const remoteItems = (data ?? []).map(mapRowToCartItem);
        // Merge: remote takes precedence on conflicts, but anything still in
        // local storage (added while signed out) is brought in.
        const mergedItems = mergeCartItems(remoteItems, localItems);

        if (!cancelled) {
          setItems(mergedItems);
          setItemsOwnerId(user.id);
          setHasHydrated(true);
        }

        clearLocalCart();
      } catch (error) {
        console.error("Failed to hydrate cart", error);
        if (!cancelled) {
          setItems(readLocalCart());
          setItemsOwnerId(null);
          setHasHydrated(true);
        }
      }
    };

    void hydrateCart();

    return () => {
      cancelled = true;
    };
  }, [user?.id, authLoading]);

  useEffect(() => {
    if (!hasHydrated) return;

    if (!user?.id) {
      // Always mirror the in-memory cart to localStorage when signed out so it
      // survives refreshes, tab closures, and signing back in.
      writeLocalCart(items);
      return;
    }

    // Only sync to the remote cart once we know `items` actually corresponds
    // to this signed-in user. This guards against the brief window where the
    // user just changed but the hydrate effect hasn't replaced `items` yet —
    // without this we could overwrite user A's saved cart with user B's items.
    if (itemsOwnerId !== user.id) return;

    void syncRemoteCart(user.id, items);
  }, [items, hasHydrated, user?.id, itemsOwnerId]);

  const addItem = useCallback((item: CartItem) => {
    let didAdd = false;
    setItems((prev) => {
      const exists = prev.find((existing) => getCartUniquenessKey(existing) === getCartUniquenessKey(item));
      if (exists) return prev;
      didAdd = true;
      return [...prev, item];
    });
    if (didAdd) {
      setLastAdded({ item, at: Date.now() });
    }
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const updateItemPlan = useCallback((id: string, plan: PricingPlan, unitPrice: number, totalPrice: number) => {
    setItems((prev) => prev.map((item) => (
      item.id === id ? { ...item, pricingPlan: plan, unitPrice, totalPrice } : item
    )));
  }, []);

  const updateItem = useCallback((id: string, patch: Partial<CartItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    clearLocalCart();
    // Delete the remote cart immediately rather than relying on the sync
    // effect — after payment the return page may clear before hydration
    // finishes, and a stale remote cart would resurrect paid-for items.
    if (user?.id) {
      void (supabase.from("cart_items") as any).delete().eq("user_id", user.id);
    }
  }, [user?.id]);

  const totalAmount = items.reduce((sum, item) => sum + item.totalPrice, 0);
  const itemCount = items.length;

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateItemPlan, updateItem, clearCart, isOpen, setIsOpen, isHydrating: !hasHydrated, totalAmount, itemCount, lastAdded }}>
      {children}
    </CartContext.Provider>
  );
};
