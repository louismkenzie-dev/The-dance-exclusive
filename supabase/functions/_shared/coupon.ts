import { createClient } from "npm:@supabase/supabase-js@2";

export interface CartItemInput {
  classId: string;
  classType?: "children" | "adult";
  pricingPlan: string;
  totalPrice: number;
  /** "class" | "camp" | "pass" — coupons only ever apply to camp (holiday workshop) items. */
  itemKind?: string;
  campId?: string | null;
}

export async function validateAndCompute(
  supabase: ReturnType<typeof createClient>,
  code: string,
  userId: string,
  items: CartItemInput[],
) {
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

  if (coupon.usage_limit_total != null) {
    const { count, error: cErr } = await supabase
      .from("coupon_redemptions")
      .select("*", { count: "exact", head: true })
      .eq("coupon_id", coupon.id);
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
      .eq("user_id", userId);
    if (uErr) return { error: "Failed to check user usage" };
    if ((count ?? 0) >= coupon.usage_limit_per_user) {
      return { error: "You have already used this coupon the maximum number of times" };
    }
  }

  const campIds: string[] = coupon.applies_to_camp_ids || [];

  // Coupons are only valid for holiday workshops (camps) — never regular
  // class bookings or passes. Optionally narrowed to specific camps.
  const eligible = items.filter((item) => {
    if (item.pricingPlan === "trial" || Number(item.totalPrice) <= 0) return false;
    if ((item.itemKind ?? "class") !== "camp" || !item.campId) return false;
    if (campIds.length > 0 && !campIds.includes(item.campId)) return false;
    return true;
  });

  if (eligible.length === 0) {
    return { error: "Coupons only apply to holiday workshops — there are none in your basket this code covers" };
  }

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

  if (finalTotal > 0 && finalTotal < 0.30) {
    return { error: "Discounted total is below the £0.30 minimum charge" };
  }

  return {
    couponId: coupon.id as string,
    code: coupon.code as string,
    discountType: coupon.discount_type as string,
    discountValue: Number(coupon.discount_value),
    discountAmount,
    eligibleSubtotal: Math.round(eligibleSubtotal * 100) / 100,
    finalTotal,
  };
}
