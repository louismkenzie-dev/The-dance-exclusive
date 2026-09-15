// What actually happened to the emails we sent.
//
// send-email records a row the moment Resend accepts an email, but accepting
// is not delivering. This endpoint is where the truth arrives afterwards:
// delivered, opened, bounced, marked as spam. Without it the studio can only
// say "we sent it", which is exactly the thing Amie could already say.
//
// Resend signs each delivery with Svix headers. We verify them before
// believing a word of it — this endpoint is public (verify_jwt = false), so
// anyone can POST to it, and an unverified body could mark a bounced email as
// opened and hide a real delivery problem.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Webhook } from "npm:svix@1.42.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
};

let _admin: ReturnType<typeof createClient> | null = null;
function admin() {
  if (!_admin) {
    _admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
  }
  return _admin;
}

/** Same resolution order as send-email: platform env first, then Vault. */
async function getSecret(name: string): Promise<string | null> {
  const env = Deno.env.get(name);
  if (env) return env;
  try {
    const { data, error } = await admin().rpc("internal_get_secret", { secret_name: name });
    if (!error && typeof data === "string" && data.length > 0) return data;
  } catch (e) {
    console.error("getSecret(", name, ") failed:", e);
  }
  return null;
}

/**
 * Resend's event names, mapped onto the columns we keep.
 *
 * Ordered worst-to-best below by `rank`: a delivery report can arrive after an
 * open (providers do not promise order), and a late 'delivered' must not
 * overwrite the fact that somebody read it. Bounces and complaints always win,
 * because those are the ones the studio needs to act on.
 */
const EVENTS: Record<string, { status: string; at?: string; rank: number }> = {
  "email.sent": { status: "sent", rank: 0 },
  "email.delivered": { status: "delivered", at: "delivered_at", rank: 1 },
  "email.opened": { status: "opened", at: "opened_at", rank: 2 },
  "email.clicked": { status: "clicked", at: "clicked_at", rank: 3 },
  "email.delivery_delayed": { status: "sent", rank: 0 },
  "email.bounced": { status: "bounced", at: "failed_at", rank: 4 },
  "email.complained": { status: "complained", at: "failed_at", rank: 4 },
};

const RANK: Record<string, number> = {
  sent: 0,
  delivered: 1,
  opened: 2,
  clicked: 3,
  failed: 4,
  bounced: 4,
  complained: 4,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const raw = await req.text();

  // Verify before trusting. No secret configured means we cannot tell a real
  // Resend delivery from anyone else's POST, so refuse rather than record
  // fiction — a wrong delivery record is worse than no delivery record.
  const secret = await getSecret("RESEND_WEBHOOK_SECRET");
  if (!secret) {
    console.error("resend-webhook: RESEND_WEBHOOK_SECRET is not configured");
    return new Response(JSON.stringify({ error: "Webhook secret not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let event: { type?: string; data?: Record<string, unknown> };
  try {
    const wh = new Webhook(secret);
    event = wh.verify(raw, {
      "svix-id": req.headers.get("svix-id") ?? "",
      "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
      "svix-signature": req.headers.get("svix-signature") ?? "",
    }) as typeof event;
  } catch (e) {
    console.error("resend-webhook: signature rejected:", e instanceof Error ? e.message : e);
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const mapped = EVENTS[event.type ?? ""];
  if (!mapped) {
    // Not an event we track. 200 so Resend stops retrying it.
    return new Response(JSON.stringify({ ignored: event.type ?? null }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const data = event.data ?? {};
  const providerId = typeof data.email_id === "string"
    ? data.email_id
    : typeof (data as { id?: unknown }).id === "string"
    ? (data as { id: string }).id
    : null;
  if (!providerId) {
    return new Response(JSON.stringify({ ignored: "no email id" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: existing, error: readErr } = await admin()
    .from("email_log")
    .select("id, status")
    .eq("provider_id", providerId)
    .maybeSingle();

  if (readErr) {
    console.error("resend-webhook: lookup failed:", readErr.message);
    // 500 so Resend retries — better than silently losing the event.
    return new Response(JSON.stringify({ error: "Lookup failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!existing) {
    // An email sent before this log existed, or from another project.
    return new Response(JSON.stringify({ ignored: "unknown email", providerId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const at = typeof data.created_at === "string" ? data.created_at : new Date().toISOString();
  const row = existing as { id: string; status: string };
  const patch: Record<string, unknown> = {};

  // Always stamp the timestamp for this event — an open is a fact worth
  // keeping even if a bounce later takes over the headline status.
  if (mapped.at) patch[mapped.at] = at;
  if (mapped.status === "bounced" || mapped.status === "complained") {
    const reason = typeof data.reason === "string"
      ? data.reason
      : typeof (data as { bounce?: { message?: unknown } }).bounce?.message === "string"
      ? (data as { bounce: { message: string } }).bounce.message
      : null;
    if (reason) patch.error = reason.slice(0, 500);
  }
  // Only move the headline status forward.
  if (mapped.rank >= (RANK[row.status] ?? 0)) patch.status = mapped.status;

  if (Object.keys(patch).length > 0) {
    const { error: updErr } = await admin().from("email_log").update(patch).eq("id", row.id);
    if (updErr) {
      console.error("resend-webhook: update failed:", updErr.message);
      return new Response(JSON.stringify({ error: "Update failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  console.log("resend-webhook:", event.type, providerId, "→", patch.status ?? row.status);
  return new Response(JSON.stringify({ ok: true, status: patch.status ?? row.status }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
