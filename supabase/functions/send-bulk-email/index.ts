// Admin-only: send one studio-written message to a group of families or staff.
//
// The audience is resolved SERVER-SIDE from an audience description ("all
// parents", "the parents in this class", "everyone at this venue"), so the
// browser never sends a list of email addresses and nobody can use this to
// mail an arbitrary address from the studio's domain. Every send is recorded
// in email_broadcasts with a row per recipient, so the studio can see exactly
// what went out and to whom.
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

const MAX_SUBJECT = 150;
const MAX_BODY = 5000;

type Audience =
  | { kind: "all_parents" }
  | { kind: "class"; classId: string }
  | { kind: "camp"; campId: string }
  | { kind: "venue"; venueId: string }
  | { kind: "staff" };

interface Recipient {
  email: string;
  name: string | null;
  userId: string | null;
}

/** Everyone the studio has an active relationship with, per audience. */
async function resolveRecipients(supabase: any, audience: Audience): Promise<Recipient[]> {
  const byEmail = new Map<string, Recipient>();
  const add = (email: unknown, name: unknown, userId: unknown) => {
    const address = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (!address || !address.includes("@")) return;
    if (byEmail.has(address)) return;
    byEmail.set(address, {
      email: address,
      name: typeof name === "string" && name.trim() ? name.trim() : null,
      userId: typeof userId === "string" ? userId : null,
    });
  };

  if (audience.kind === "staff") {
    const { data } = await supabase
      .from("staff")
      .select("email, full_name, first_name, last_name")
      .eq("is_active", true);
    for (const s of data ?? []) {
      add(s.email, s.full_name ?? [s.first_name, s.last_name].filter(Boolean).join(" "), null);
    }
    return [...byEmail.values()];
  }

  if (audience.kind === "all_parents") {
    // Anyone with a confirmed booking — not every account that ever signed up.
    const { data: bookings } = await supabase
      .from("bookings")
      .select("parent_id")
      .eq("status", "confirmed");
    const parentIds = [...new Set((bookings ?? []).map((b: any) => b.parent_id).filter(Boolean))];
    for (const chunk of chunked(parentIds, 200)) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, email, full_name")
        .in("user_id", chunk);
      for (const p of profiles ?? []) add(p.email, p.full_name, p.user_id);
    }
    return [...byEmail.values()];
  }

  // Class / camp / venue: whoever holds a confirmed booking there.
  let classIds: string[] = [];
  let campIds: string[] = [];
  if (audience.kind === "class") {
    classIds = [audience.classId];
  } else if (audience.kind === "camp") {
    campIds = [audience.campId];
  } else {
    const [{ data: classes }, { data: camps }] = await Promise.all([
      supabase.from("classes").select("id").eq("venue_id", audience.venueId),
      supabase.from("camps").select("id").eq("venue_id", audience.venueId),
    ]);
    classIds = (classes ?? []).map((c: any) => c.id);
    campIds = (camps ?? []).map((c: any) => c.id);
  }

  const parentIds = new Set<string>();
  if (classIds.length > 0) {
    const { data } = await supabase
      .from("bookings")
      .select("parent_id")
      .in("class_id", classIds)
      .eq("status", "confirmed");
    for (const b of data ?? []) if (b.parent_id) parentIds.add(b.parent_id);
  }
  if (campIds.length > 0) {
    const { data } = await supabase
      .from("bookings")
      .select("parent_id")
      .in("camp_id", campIds)
      .eq("status", "confirmed");
    for (const b of data ?? []) if (b.parent_id) parentIds.add(b.parent_id);
  }

  for (const chunk of chunked([...parentIds], 200)) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, email, full_name")
      .in("user_id", chunk);
    for (const p of profiles ?? []) add(p.email, p.full_name, p.user_id);
  }
  return [...byEmail.values()];
}

function* chunked<T>(items: T[], size: number): Generator<T[]> {
  for (let i = 0; i < items.length; i += size) yield items.slice(i, i + size);
}

function parseAudience(raw: any): Audience | null {
  const kind = raw?.kind;
  if (kind === "all_parents" || kind === "staff") return { kind };
  if (kind === "class" && typeof raw.classId === "string") return { kind, classId: raw.classId };
  if (kind === "camp" && typeof raw.campId === "string") return { kind, campId: raw.campId };
  if (kind === "venue" && typeof raw.venueId === "string") return { kind, venueId: raw.venueId };
  return null;
}

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
    if (!adminRole) return jsonResponse({ error: "Only admins can send bulk emails" }, 403);

    const body = await req.json().catch(() => ({}));
    const audience = parseAudience(body.audience);
    if (!audience) return jsonResponse({ error: "Choose who this is going to" }, 400);

    const recipients = await resolveRecipients(supabase, audience);

    // Dry run: the composer asks how many people this would reach before the
    // admin commits to sending it.
    if (body.preview === true) {
      return jsonResponse({ recipientCount: recipients.length });
    }

    const subject = String(body.subject ?? "").trim().slice(0, MAX_SUBJECT);
    const messageBody = String(body.body ?? "").trim().slice(0, MAX_BODY);
    if (!subject) return jsonResponse({ error: "Give the email a subject" }, 400);
    if (!messageBody) return jsonResponse({ error: "Write a message to send" }, 400);
    if (recipients.length === 0) {
      return jsonResponse({ error: "Nobody in that group has an email address on file" }, 400);
    }

    const { data: broadcast, error: broadcastError } = await supabase
      .from("email_broadcasts")
      .insert({
        subject,
        body: messageBody,
        audience,
        audience_label: typeof body.audienceLabel === "string" ? body.audienceLabel.slice(0, 200) : null,
        sent_by: user.id,
        status: "sending",
      })
      .select("id")
      .single();
    if (broadcastError || !broadcast) {
      console.error("send-bulk-email: could not record broadcast", broadcastError);
      return jsonResponse({ error: "Could not start the send — please try again" }, 500);
    }

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    let sent = 0;
    let failed = 0;
    const recipientRows: any[] = [];

    for (const recipient of recipients) {
      const { error } = await supabase.functions.invoke("send-email", {
        headers: { "x-internal-auth": serviceKey },
        body: {
          template: "broadcast",
          to: recipient.email,
          data: {
            subject,
            body: messageBody,
            recipientName: recipient.name,
            ctaLabel: typeof body.ctaLabel === "string" ? body.ctaLabel.slice(0, 40) : null,
            ctaUrl: typeof body.ctaUrl === "string" ? body.ctaUrl.slice(0, 300) : null,
          },
        },
      });
      if (error) {
        failed++;
        console.error("Bulk email failed for", recipient.email, error);
      } else {
        sent++;
      }
      recipientRows.push({
        broadcast_id: broadcast.id,
        email: recipient.email,
        name: recipient.name,
        user_id: recipient.userId,
        status: error ? "failed" : "sent",
        error: error ? String(error.message ?? error).slice(0, 500) : null,
      });
    }

    for (const chunk of chunked(recipientRows, 200)) {
      const { error } = await supabase.from("email_broadcast_recipients").insert(chunk);
      if (error) console.error("Could not record broadcast recipients:", error);
    }

    await supabase
      .from("email_broadcasts")
      .update({
        recipient_count: sent,
        failed_count: failed,
        status: sent > 0 ? "sent" : "failed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", broadcast.id);

    return jsonResponse({ success: sent > 0, sent, failed, broadcastId: broadcast.id });
  } catch (e: any) {
    console.error("send-bulk-email error:", e);
    return jsonResponse({ error: e?.message ?? "Something went wrong" }, 500);
  }
});
