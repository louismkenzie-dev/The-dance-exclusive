// Public: a family enquires about a birthday party.
//
// The enquiry used to be inserted straight from the browser, which meant no
// email reached the studio — Amie only saw it if she happened to look. This
// records the enquiry with the service role and then sends both emails: the
// studio notification (so nothing is missed) and the family's acknowledgement.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const str = (v: unknown, max: number): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s.slice(0, max) : null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json();

    const parentName = str(body.parent_name, 120);
    const email = str(body.email, 200);
    const childName = str(body.birthday_child_name, 120);
    if (!parentName || !email || !childName) {
      return jsonResponse({ error: "Please give your name, email and the birthday child's name." }, 400);
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return jsonResponse({ error: "That email address doesn't look right." }, 400);
    }

    const age = Number(body.birthday_child_age);
    const guests = Number(body.guest_count);
    const date = str(body.preferred_date, 10);
    const row = {
      parent_name: parentName,
      email,
      phone: str(body.phone, 40),
      birthday_child_name: childName,
      birthday_child_age: Number.isFinite(age) && age > 0 && age < 30 ? Math.round(age) : null,
      preferred_date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
      preferred_time: str(body.preferred_time, 60),
      venue_preference: str(body.venue_preference, 200),
      guest_count: Number.isFinite(guests) && guests > 0 && guests < 500 ? Math.round(guests) : null,
      party_package_id: str(body.party_package_id, 40),
      selected_extras: Array.isArray(body.selected_extras)
        ? body.selected_extras.filter((e: unknown) => typeof e === "string").slice(0, 20)
        : [],
      notes: str(body.notes, 2000),
    };

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: inquiry, error } = await supabase
      .from("party_inquiries")
      .insert(row)
      .select("id")
      .single();
    if (error || !inquiry) {
      console.error("submit-party-inquiry insert failed:", error);
      return jsonResponse({ error: "We couldn't save your enquiry — please try again." }, 500);
    }

    // Look up the names behind the ids so both emails read properly.
    const { data: pkg } = row.party_package_id
      ? await supabase.from("party_packages").select("name").eq("id", row.party_package_id).maybeSingle()
      : { data: null };
    const packageName = (pkg as any)?.name ?? null;

    let extraNames: string[] = [];
    if (row.selected_extras.length > 0) {
      const { data: extras } = await supabase
        .from("party_extras")
        .select("name")
        .in("id", row.selected_extras);
      extraNames = ((extras as any[]) ?? []).map((e) => e.name);
    }

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const studioEmail = Deno.env.get("ADMIN_NOTIFY_EMAIL") || "hello@thedanceexclusive.co.uk";

    // Emails must never lose the enquiry: it's already saved, so failures here
    // are logged and reported as a flag, not as an error to the family.
    const send = async (template: string, to: string, data: unknown) => {
      const { error: err } = await supabase.functions.invoke("send-email", {
        headers: { "x-internal-auth": serviceKey },
        body: { template, to, data },
      });
      if (err) console.error(`submit-party-inquiry ${template} email failed:`, err);
      return !err;
    };

    const [studioSent, parentSent] = await Promise.all([
      send("party_inquiry_admin", studioEmail, {
        inquiryId: inquiry.id,
        parentName: row.parent_name,
        email: row.email,
        phone: row.phone,
        childName: row.birthday_child_name,
        childAge: row.birthday_child_age,
        preferredDate: row.preferred_date,
        preferredTime: row.preferred_time,
        venuePreference: row.venue_preference,
        guestCount: row.guest_count,
        packageName,
        extras: extraNames,
        notes: row.notes,
      }),
      send("party_inquiry_received", row.email, {
        parentName: row.parent_name,
        childName: row.birthday_child_name,
        packageName: packageName ?? undefined,
        preferredDate: row.preferred_date ?? undefined,
      }),
    ]);

    return jsonResponse({ success: true, id: inquiry.id, studioSent, parentSent });
  } catch (e: any) {
    console.error("submit-party-inquiry error:", e);
    return jsonResponse({ error: "We couldn't save your enquiry — please try again." }, 500);
  }
});
