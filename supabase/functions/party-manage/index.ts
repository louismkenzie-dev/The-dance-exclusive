// Admin-only: reply to a party enquiry and raise its invoices.
//
// Two actions:
//   respond — record what was agreed (or proposed), set the enquiry status and
//             email the family; optionally raise an invoice in the same step.
//   invoice — raise the deposit or the balance on its own (e.g. the balance a
//             fortnight before the party).
//
// Invoices are real Stripe invoices on The Dance Exclusive's connected
// account: Stripe emails a hosted payment page, the family pays by card, and
// the payments-webhook marks it paid here.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  connectRequestOptions,
  createStripeClient,
  getPlatformFeePercent,
  platformFeePence,
} from "../_shared/stripe.ts";
import { getActiveStripeEnv } from "../_shared/paymentsMode.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const KIND_LABEL: Record<string, string> = {
  deposit: "Deposit — secures your party date",
  balance: "Balance — remaining party payment",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) return jsonResponse({ error: "Not signed in" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: adminRole } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!adminRole) return jsonResponse({ error: "Only admins can manage party enquiries" }, 403);

    const body = await req.json();
    const { action, inquiryId } = body;
    if (!inquiryId || typeof inquiryId !== "string") {
      return jsonResponse({ error: "Which enquiry?" }, 400);
    }

    const { data: inquiry } = await supabase
      .from("party_inquiries")
      .select("*, party_packages:party_package_id(name)")
      .eq("id", inquiryId)
      .maybeSingle();
    if (!inquiry) return jsonResponse({ error: "Enquiry not found" }, 404);

    const packageName = (inquiry as any).party_packages?.name ?? null;

    /** Raise one invoice in Stripe and record it. Returns the stored row. */
    const raiseInvoice = async (kind: string, amountRaw: unknown, dueDateRaw: unknown) => {
      if (kind !== "deposit" && kind !== "balance") {
        throw new Error("An invoice is either a deposit or a balance");
      }
      const amount = Number(amountRaw);
      if (!Number.isFinite(amount) || amount < 1) {
        throw new Error("Set an invoice amount of at least £1");
      }
      const dueDate = typeof dueDateRaw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dueDateRaw)
        ? dueDateRaw
        : null;

      const env = await getActiveStripeEnv(supabase);
      const stripe = createStripeClient(env);
      const connect = connectRequestOptions(env);
      const pence = Math.round(amount * 100);

      // One customer per family email on the connected account.
      const existing = await stripe.customers.list(
        { email: (inquiry as any).email, limit: 1 },
        connect,
      );
      const customer = existing.data[0] ?? await stripe.customers.create(
        { email: (inquiry as any).email, name: (inquiry as any).parent_name },
        connect,
      );

      const partyLabel = `${(inquiry as any).birthday_child_name}'s party${packageName ? ` — ${packageName}` : ""}`;

      await stripe.invoiceItems.create(
        {
          customer: customer.id,
          amount: pence,
          currency: "gbp",
          description: `${KIND_LABEL[kind]} · ${partyLabel}`,
        },
        connect,
      );

      const feePercent = getPlatformFeePercent();
      const fee = platformFeePence(pence, feePercent);
      const invoice = await stripe.invoices.create(
        {
          customer: customer.id,
          collection_method: "send_invoice",
          ...(dueDate
            ? { due_date: Math.floor(new Date(`${dueDate}T12:00:00Z`).getTime() / 1000) }
            : { days_until_due: 7 }),
          description: partyLabel,
          metadata: {
            party_inquiry_id: inquiryId,
            party_payment_kind: kind,
          },
          ...(fee > 0 && connect.stripeAccount ? { application_fee_amount: fee } : {}),
        },
        connect,
      );

      const finalized = await stripe.invoices.finalizeInvoice(invoice.id, connect);
      // Stripe emails the hosted invoice to the family.
      const sent = await stripe.invoices.sendInvoice(finalized.id, connect);

      const { data: row, error: rowErr } = await supabase
        .from("party_payments")
        .insert({
          inquiry_id: inquiryId,
          kind,
          amount,
          due_date: dueDate,
          stripe_invoice_id: sent.id,
          stripe_env: env,
          hosted_invoice_url: sent.hosted_invoice_url ?? finalized.hosted_invoice_url ?? null,
        })
        .select("*")
        .single();
      if (rowErr) {
        console.error("party-manage payment insert failed:", rowErr);
        throw new Error("The invoice went out but we couldn't record it — check Stripe before resending.");
      }
      return row;
    };

    if (action === "invoice") {
      const row = await raiseInvoice(body.kind, body.amount, body.dueDate);
      return jsonResponse({ success: true, payment: row });
    }

    if (action === "respond") {
      const outcome = body.outcome;
      if (!["confirmed", "proposed", "declined"].includes(outcome)) {
        return jsonResponse({ error: "Choose confirm, propose or decline" }, 400);
      }

      let payment: any = null;
      if (body.invoice) {
        payment = await raiseInvoice(
          body.invoice.kind,
          body.invoice.amount,
          body.invoice.dueDate,
        );
      }

      const agreedDate = typeof body.agreedDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.agreedDate)
        ? body.agreedDate
        : null;
      const quotedTotal = Number(body.quotedTotal);

      const { error: updateErr } = await supabase
        .from("party_inquiries")
        .update({
          status: outcome,
          agreed_date: agreedDate,
          agreed_time: typeof body.agreedTime === "string" ? body.agreedTime.trim().slice(0, 60) || null : null,
          agreed_venue: typeof body.agreedVenue === "string" ? body.agreedVenue.trim().slice(0, 200) || null : null,
          quoted_total: Number.isFinite(quotedTotal) && quotedTotal > 0 ? quotedTotal : null,
          admin_notes: typeof body.adminNotes === "string" ? body.adminNotes.trim().slice(0, 2000) || null : null,
          responded_at: new Date().toISOString(),
        })
        .eq("id", inquiryId);
      if (updateErr) {
        console.error("party-manage update failed:", updateErr);
        return jsonResponse({ error: "Couldn't save the response" }, 500);
      }

      const { error: emailErr } = await supabase.functions.invoke("send-email", {
        headers: { "x-internal-auth": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")! },
        body: {
          template: "party_response",
          to: (inquiry as any).email,
          data: {
            parentName: (inquiry as any).parent_name,
            childName: (inquiry as any).birthday_child_name,
            outcome,
            packageName,
            partyDate: agreedDate ?? (inquiry as any).preferred_date,
            partyTime: body.agreedTime ?? (inquiry as any).preferred_time,
            venue: body.agreedVenue ?? (inquiry as any).venue_preference,
            quotedTotal: Number.isFinite(quotedTotal) && quotedTotal > 0 ? quotedTotal : null,
            message: typeof body.message === "string" ? body.message.trim() : null,
            invoice: payment
              ? {
                kind: payment.kind,
                amount: Number(payment.amount),
                dueDate: payment.due_date,
                url: payment.hosted_invoice_url,
              }
              : null,
          },
        },
      });
      if (emailErr) console.error("party-manage response email failed:", emailErr);

      return jsonResponse({ success: true, emailSent: !emailErr, payment });
    }

    return jsonResponse({ error: `Unknown action "${action}"` }, 400);
  } catch (e: any) {
    console.error("party-manage error:", e);
    return jsonResponse({ error: e?.message ?? "Something went wrong" }, 500);
  }
});
