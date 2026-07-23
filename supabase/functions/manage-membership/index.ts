// Membership self-service: cancel with one month's written notice.
// Per the club's terms: one more monthly payment is taken on the next
// billing date (the "final payment"), the membership stays active for the
// month that payment covers, then the Stripe subscription ends automatically.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  type StripeEnv,
  connectRequestOptions,
  createStripeClient,
} from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const addOneMonth = (unixSeconds: number): Date => {
  const d = new Date(unixSeconds * 1000);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: "You must be signed in to manage a membership" }, 401);
    }

    const { action, membershipId, environment } = await req.json();
    if (action !== "cancel") {
      return jsonResponse({ error: "Unknown action" }, 400);
    }
    if (!membershipId || typeof membershipId !== "string") {
      return jsonResponse({ error: "No membership selected" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: membership } = await supabase
      .from("memberships")
      .select("*")
      .eq("id", membershipId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) return jsonResponse({ error: "Membership not found" }, 404);
    if (membership.status === "cancel_scheduled") {
      return jsonResponse({ error: "This membership is already scheduled to end" }, 400);
    }
    if (membership.status === "cancelled") {
      return jsonResponse({ error: "This membership has already ended" }, 400);
    }
    if (membership.status === "incomplete") {
      return jsonResponse({ error: "This membership hasn't started yet" }, 400);
    }

    const env = (environment || "sandbox") as StripeEnv;
    const stripe = createStripeClient(env);
    const connectOpts = connectRequestOptions(env);

    const sub = await stripe.subscriptions.retrieve(
      membership.stripe_subscription_id,
      {},
      connectOpts,
    );
    if (!sub || sub.status === "canceled") {
      // Stripe already ended it — sync our side.
      await supabase
        .from("memberships")
        .update({ status: "cancelled", cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", membership.id);
      return jsonResponse({ error: "This membership has already ended" }, 400);
    }

    // One month's notice: the NEXT renewal still charges (final payment on
    // the usual billing day), the membership stays active for the month that
    // payment covers, and the subscription ends at the close of that month.
    const finalPaymentDate = new Date(sub.current_period_end * 1000);
    const endDate = addOneMonth(sub.current_period_end);

    // Count the family's active memberships on this subscription — if this is
    // the only one left, schedule the whole subscription to end; otherwise the
    // daily maintenance job removes just this item once its final month is up.
    const { data: siblings } = await supabase
      .from("memberships")
      .select("id")
      .eq("stripe_subscription_id", membership.stripe_subscription_id)
      .in("status", ["active", "past_due", "paused"]);
    const isLastActive = (siblings ?? []).filter((m: any) => m.id !== membership.id).length === 0;

    if (isLastActive) {
      await stripe.subscriptions.update(
        membership.stripe_subscription_id,
        { cancel_at: Math.floor(endDate.getTime() / 1000) },
        connectOpts,
      );
    }

    const nowIso = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("memberships")
      .update({
        status: "cancel_scheduled",
        cancel_requested_at: nowIso,
        final_payment_date: finalPaymentDate.toISOString(),
        cancel_at: endDate.toISOString(),
        updated_at: nowIso,
      })
      .eq("id", membership.id);
    if (updateError) throw updateError;

    // Confirmation email (best effort).
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("user_id", user.id)
        .maybeSingle();
      const [{ data: student }, { data: cls }] = await Promise.all([
        membership.student_id
          ? supabase.from("students").select("first_name, last_name").eq("id", membership.student_id).maybeSingle()
          : Promise.resolve({ data: null }),
        membership.class_id
          ? supabase.from("classes").select("name").eq("id", membership.class_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      if (profile?.email) {
        await supabase.functions.invoke("send-email", {
          body: {
            template: "membership_cancel_requested",
            to: profile.email,
            data: {
              parentName: profile.full_name,
              studentName: student ? `${student.first_name} ${student.last_name}` : null,
              className: cls?.name ?? "your class",
              monthlyAmount: Number(membership.monthly_amount),
              finalPaymentDate: finalPaymentDate.toISOString(),
              endDate: endDate.toISOString(),
            },
          },
        });
      }
    } catch (e) {
      console.error("Cancel-confirmation email failed:", e);
    }

    return jsonResponse({
      success: true,
      finalPaymentDate: finalPaymentDate.toISOString(),
      endDate: endDate.toISOString(),
    });
  } catch (error: any) {
    console.error("manage-membership error:", error);
    return jsonResponse({ error: error.message }, 500);
  }
});
