import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PORTAL_URL = Deno.env.get("STAFF_PORTAL_URL") || "https://thedanceexclusive.co.uk";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is an admin
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: callerRoles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    const isAdmin = callerRoles?.some((r: any) => r.role === "admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden — admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { staffId } = body;
    if (!staffId) {
      return new Response(JSON.stringify({ error: "Missing staffId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load the staff record
    const { data: staff, error: staffErr } = await admin
      .from("staff")
      .select("*")
      .eq("id", staffId)
      .single();
    if (staffErr || !staff) {
      return new Response(JSON.stringify({ error: "Staff member not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!staff.email) {
      return new Response(JSON.stringify({ error: "Staff member has no email address" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let userId = staff.user_id as string | null;

    // If staff has a user_id, verify the auth user still exists
    let authEmail: string | null = null;
    if (userId) {
      const { data: existingAuth, error: getErr } = await admin.auth.admin.getUserById(userId);
      if (getErr || !existingAuth?.user) {
        console.warn("Linked auth user missing, will recreate:", getErr?.message);
        userId = null;
      } else {
        authEmail = existingAuth.user.email ?? null;
      }
    }

    // 1) If no auth user yet, create or find one
    if (!userId) {
      // Check if a user with that email already exists
      const { data: existing } = await admin.auth.admin.listUsers({
        page: 1,
        perPage: 1,
      });
      // Above returns only the first user; use a direct lookup instead
      const { data: byEmail } = await admin
        .from("profiles")
        .select("user_id")
        .eq("email", staff.email)
        .maybeSingle();

      if (byEmail?.user_id) {
        userId = byEmail.user_id;
      } else {
        // Create the auth user with no password — the invite link sets it
        const tempPassword = crypto.randomUUID() + "Aa1!";
        const { data: created, error: createErr } = await admin.auth.admin.createUser({
          email: staff.email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { full_name: staff.full_name },
        });
        if (createErr || !created.user) {
          console.error("createUser error:", createErr);
          return new Response(JSON.stringify({ error: createErr?.message ?? "Failed to create user" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        userId = created.user.id;

        // Profile auto-created by trigger; ensure full_name + phone are right
        await admin.from("profiles").upsert(
          {
            user_id: userId,
            full_name: staff.full_name,
            email: staff.email,
            phone: staff.phone ?? null,
          },
          { onConflict: "user_id" },
        );
      }

      // Replace default 'parent' role with 'staff' (preserve admin if present)
      await admin.from("user_roles").delete().eq("user_id", userId).eq("role", "parent");
      const { data: existingStaffRole } = await admin
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .eq("role", "staff")
        .maybeSingle();
      if (!existingStaffRole) {
        await admin.from("user_roles").insert({ user_id: userId, role: "staff" });
      }

      // Link staff -> user
      await admin.from("staff").update({ user_id: userId, invited_at: new Date().toISOString() }).eq("id", staffId);
      authEmail = staff.email;
    }

    // 2) Generate a recovery (set-password) link
    const redirectTo = `${PORTAL_URL}/reset-password?source=staff-invite`;
    const recoveryEmail = authEmail ?? staff.email;
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: recoveryEmail,
      options: { redirectTo },
    });
    if (linkErr || !linkData?.properties?.action_link) {
      console.error("generateLink error:", linkErr);
      return new Response(JSON.stringify({ error: linkErr?.message ?? "Failed to generate invite link" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const inviteLink = linkData.properties.action_link;

    // 3) Send the branded onboarding email
    const emailRes = await admin.functions.invoke("send-email", {
      headers: { "x-internal-auth": serviceKey },
      body: {
        template: "staff_onboarding",
        to: staff.email,
        data: {
          fullName: staff.full_name,
          email: staff.email,
          inviteLink,
          role: staff.role,
        },
      },
    });
    if (emailRes.error) {
      console.error("send-email error:", emailRes.error);
      // Don't fail the whole invite — the account is provisioned and we can
      // surface the link to the admin so they can share it manually
      // (e.g. while Resend is still in test mode without a verified domain).
      await admin.from("staff").update({ last_invite_sent_at: new Date().toISOString() }).eq("id", staffId);
      return new Response(
        JSON.stringify({
          success: true,
          userId,
          emailSent: false,
          inviteLink,
          warning:
            "Account created but the onboarding email could not be sent. Share the invite link manually.",
          details: emailRes.error.message,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 4) Update last_invite_sent_at
    await admin.from("staff").update({ last_invite_sent_at: new Date().toISOString() }).eq("id", staffId);

    return new Response(JSON.stringify({ success: true, userId, emailSent: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("invite-staff error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});