// No Deno-only imports here: the app's unit tests exercise this engine too.
// Only the query-builder surface actually used is required of the client.
// deno-lint-ignore no-explicit-any
type SupabaseLike = { from: (table: string) => any };

export interface CartItemInput {
  classId: string;
  classType?: "children" | "adult";
  pricingPlan: string;
  totalPrice: number;
  /** "class" | "camp" | "pass" (basket item kind). */
  itemKind?: string;
  campId?: string | null;
}

/**
 * What a code can be used on (coupons.applies_to_kinds):
 *  - camp    — holiday workshops
 *  - class   — class bookings: trials, pay-as-you-go, termly, yearly
 *  - monthly — the FIRST payment of a new monthly membership (renewals are
 *              never discounted by a code; use a membership adjustment)
 *  - pass    — adult class passes
 */
export type CouponKind = "camp" | "class" | "monthly" | "pass";

const KIND_LABELS: Record<CouponKind, string> = {
  camp: "holiday workshops",
  class: "class bookings",
  monthly: "a new monthly membership's first payment",
  pass: "adult class passes",
};

/** Reservations older than this are treated as abandoned checkouts. */
export const RESERVATION_TTL_MS = 2 * 60 * 60 * 1000;
export const reservationCutoff = (now: Date = new Date()) => new Date(now.getTime() - RESERVATION_TTL_MS);

/** Which coupon kind a basket item falls under. */
export function couponKindOf(item: { itemKind?: string | null; pricingPlan?: string | null }): CouponKind {
  const kind = item.itemKind ?? "class";
  if (kind === "camp") return "camp";
  if (kind === "pass") return "pass";
  return item.pricingPlan === "monthly" ? "monthly" : "class";
}

export interface CouponResult {
  couponId: string;
  code: string;
  discountType: string;
  discountValue: number;
  discountAmount: number;
  eligibleSubtotal: number;
  finalTotal: number;
  /** Positions (in the items array passed in) the discount applies to. */
  eligibleIndexes: number[];
}

export async function validateAndCompute(
  supabase: SupabaseLike,
  code: string,
  userId: string,
  items: CartItemInput[],
): Promise<CouponResult | { error: string }> {
  if (!code || typeof code !== "string") {
    return { error: "Coupon code is required" };
  }
  if (!Array.isArray(items) || items.length === 0) {
    return { error: "No items to apply coupon to" };
  }

  const normalized = code.trim().toUpperCase();

  const { data: coupon, error } = await supabase
    .from("coupons")
    .select("*")
    .eq("code", normalized)
    .maybeSingle();

  if (error) return { error: "Failed to look up coupon" };
  if (!coupon) return { error: "Invalid coupon code" };
  if (!coupon.is_active) return { error: "This coupon is not active" };

  const now = new Date();
  if (coupon.valid_from && new Date(coupon.valid_from) > now) {
    return { error: "This coupon is not yet valid" };
  }
  if (coupon.valid_until && new Date(coupon.valid_until) < now) {
    return { error: "This coupon has expired" };
  }

  // Personal credit codes belong to one family's account.
  if (coupon.restricted_to_email) {
    if (!userId) return { error: "Please sign in to use this code" };
    const { data: prof } = await supabase
      .from("profiles")
      .select("email")
      .eq("user_id", userId)
      .maybeSingle();
    const want = String(coupon.restricted_to_email).trim().toLowerCase();
    const have = String(prof?.email ?? "").trim().toLowerCase();
    if (!have || have !== want) {
      return { error: "This code belongs to a different account" };
    }
  }

  // Uses = completed redemptions plus live reservations (a checkout priced
  // with the code in the last two hours that hasn't been paid or cancelled
  // yet), so one single-use credit can't be applied to two baskets at once.
  const usesFilter = `status.eq.completed,and(status.eq.reserved,redeemed_at.gt.${reservationCutoff().toISOString()})`;

  if (coupon.usage_limit_total != null) {
    const { count, error: cErr } = await supabase
      .from("coupon_redemptions")
      .select("*", { count: "exact", head: true })
      .eq("coupon_id", coupon.id)
      .or(usesFilter);
    if (cErr) return { error: "Failed to check usage" };
    if ((count ?? 0) >= coupon.usage_limit_total) {
      return { error: "This coupon has reached its usage limit" };
    }
  }

  if (coupon.usage_limit_per_user != null && userId) {
    const { count, error: uErr } = await supabase
      .from("coupon_redemptions")
      .select("*", { count: "exact", head: true })
      .eq("coupon_id", coupon.id)
      .eq("user_id", userId)
      .or(usesFilter);
    if (uErr) return { error: "Failed to check user usage" };
    if ((count ?? 0) >= coupon.usage_limit_per_user) {
      return { error: "You have already used this coupon the maximum number of times" };
    }
  }

  // Codes made before kinds existed default to holiday workshops only.
  const kinds = (Array.isArray(coupon.applies_to_kinds) && coupon.applies_to_kinds.length > 0
    ? coupon.applies_to_kinds
    : ["camp"]) as CouponKind[];
  const campIds: string[] = coupon.applies_to_camp_ids || [];

  const eligibleIndexes: number[] = [];
  items.forEach((item, index) => {
    if (Number(item.totalPrice) <= 0) return;
    const kind = couponKindOf(item);
    if (!kinds.includes(kind)) return;
    if (kind === "camp") {
      if (!item.campId) return;
      if (campIds.length > 0 && !campIds.includes(item.campId)) return;
    }
    eligibleIndexes.push(index);
  });

  if (eligibleIndexes.length === 0) {
    const what = kinds.map((k) => KIND_LABELS[k] ?? k);
    const list = what.length <= 1
      ? what[0]
      : `${what.slice(0, -1).join(", ")} or ${what[what.length - 1]}`;
    return { error: `This code only works on ${list} — there's nothing in your basket it covers` };
  }

  const eligible = eligibleIndexes.map((i) => items[i]);
  const eligibleSubtotal = eligible.reduce(
    (sum, i) => sum + Number(i.totalPrice || 0),
    0,
  );
  const cartSubtotal = items.reduce(
    (sum, i) => sum + Number(i.totalPrice || 0),
    0,
  );

  let discountAmount = 0;
  if (coupon.discount_type === "percent") {
    discountAmount = (eligibleSubtotal * Number(coupon.discount_value)) / 100;
  } else {
    discountAmount = Math.min(Number(coupon.discount_value), eligibleSubtotal);
  }

  discountAmount = Math.round(discountAmount * 100) / 100;
  const finalTotal = Math.max(0, Math.round((cartSubtotal - discountAmount) * 100) / 100);

  // Card payments can't be £0 (or under Stripe's 30p minimum), so a code
  // covering the full cost cannot go through checkout at all. Say so in
  // plain words — the studio books full-scholarship places in directly.
  if (finalTotal < 0.30) {
    return {
      error:
        "This code covers the full cost, so there's nothing to pay — the studio will " +
        "book this in for you directly. Please drop them a message and they'll sort it.",
    };
  }

  return {
    couponId: coupon.id as string,
    code: coupon.code as string,
    discountType: coupon.discount_type as string,
    discountValue: Number(coupon.discount_value),
    discountAmount,
    eligibleSubtotal: Math.round(eligibleSubtotal * 100) / 100,
    finalTotal,
    eligibleIndexes,
  };
}

/**
 * Split a coupon's discount (pence) across the eligible items so each
 * booking records what was actually paid for it. Percent codes take their
 * share off every eligible item (rounding settled on the last one); fixed
 * amounts come off the eligible items in basket order. Returns pence off
 * per item, aligned with `itemPence`.
 */
export function allocateDiscount(
  itemPence: number[],
  eligibleIndexes: number[],
  discountPence: number,
  discountType: string,
  discountValue: number,
): number[] {
  const off = itemPence.map(() => 0);
  if (discountPence <= 0 || eligibleIndexes.length === 0) return off;

  let allocated = 0;
  if (discountType === "percent") {
    for (const idx of eligibleIndexes) {
      const share = Math.min(itemPence[idx], Math.round((itemPence[idx] * discountValue) / 100));
      const applied = Math.min(share, discountPence - allocated);
      off[idx] = Math.max(0, applied);
      allocated += off[idx];
    }
  }
  // Fixed amounts, and any rounding remainder from a percent split.
  for (const idx of eligibleIndexes) {
    if (allocated >= discountPence) break;
    const room = itemPence[idx] - off[idx];
    const add = Math.min(room, discountPence - allocated);
    if (add > 0) {
      off[idx] += add;
      allocated += add;
    }
  }
  return off;
}
