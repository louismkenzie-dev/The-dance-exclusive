// Dance Exclusive Avatar Studio.
// Takes the real photo a parent uploaded (child profile, or their own self
// profile) and generates an on-brand cartoon avatar: TDE merch, dancing on a
// stage under blue/magenta lights. Requires the OPENAI_API_KEY secret; until
// it is set the function responds 503 and the UI explains the studio is
// warming up.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AVATAR_PROMPT =
  "The first image is a real photo of a person. The second image is the OFFICIAL logo of The Dance Exclusive, " +
  "a UK street-dance school: a blue paint-splat with white 'THE DANCE EXCLUSIVE' lettering and a small crown. " +
  "Transform the person into a vibrant 3D cartoon avatar. Keep their recognisable features — hairstyle, skin " +
  "tone, face shape and smile. They are wearing a black t-shirt printed on the chest with the official logo " +
  "from the second image, reproduced EXACTLY as provided — do not redesign, recolour, reword or reinterpret " +
  "the logo in any way. Show them mid dance move, full of confident joyful energy, on a performance stage lit " +
  "by dramatic blue and magenta stage lights with a subtle crowd glow. Family-friendly, polished " +
  "animated-movie style, high quality.";

const AVATAR_PROMPT_NO_LOGO =
  "Transform the person in this photo into a vibrant 3D cartoon avatar for The Dance Exclusive, " +
  "a UK street-dance school. Keep their recognisable features — hairstyle, skin tone, face shape and smile. " +
  "They are wearing official Dance Exclusive merchandise: a black t-shirt with a blue paint-splat logo with " +
  "white 'THE DANCE EXCLUSIVE' lettering and a small crown. " +
  "Show them mid dance move, full of confident joyful energy, on a performance stage lit by dramatic blue and " +
  "magenta stage lights with a subtle crowd glow. Family-friendly, polished animated-movie style, high quality.";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      return json(
        { error: "The Avatar Studio isn't switched on yet — check back soon!", code: "not_configured" },
        503,
      );
    }

    // Caller must be signed in; we only ever work on THEIR photos.
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Please sign in first." }, 401);
    const userId = userData.user.id;

    const { studentId, logoDataUrl } = await req.json().catch(() => ({}));
    const admin = createClient(supabaseUrl, serviceKey);

    // The app sends the official TDE logo as a data URL so the generated
    // t-shirt carries the real brand mark, not an invented one.
    let logoBlob: Blob | null = null;
    if (typeof logoDataUrl === "string" && logoDataUrl.startsWith("data:image/")) {
      try {
        const b64 = logoDataUrl.split(",")[1] ?? "";
        const logoBytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        if (logoBytes.length > 0 && logoBytes.length < 2_000_000) {
          logoBlob = new Blob([logoBytes], { type: "image/png" });
        }
      } catch {
        logoBlob = null; // fall back to the descriptive prompt
      }
    }

    // Resolve the source photo (and where to save the avatar).
    let sourceUrl: string | null = null;
    if (studentId) {
      const { data: student } = await admin
        .from("students")
        .select("id, parent_id, profile_photo")
        .eq("id", studentId)
        .maybeSingle();
      if (!student || student.parent_id !== userId) {
        return json({ error: "Attendee profile not found on your account." }, 404);
      }
      sourceUrl = student.profile_photo;
    } else {
      const { data: profile } = await admin
        .from("profiles")
        .select("profile_photo")
        .eq("user_id", userId)
        .maybeSingle();
      sourceUrl = profile?.profile_photo ?? null;
    }
    if (!sourceUrl) {
      return json({ error: "Upload a photo first, then create the avatar from it." }, 400);
    }

    // Download the source photo.
    const photoRes = await fetch(sourceUrl);
    if (!photoRes.ok) return json({ error: "Couldn't read the uploaded photo." }, 400);
    const photoBlob = await photoRes.blob();

    // Generate via OpenAI image edit (keeps likeness from the input photo;
    // second reference image is the official logo when provided).
    const form = new FormData();
    form.append("model", "gpt-image-1");
    form.append("image[]", new File([photoBlob], "photo.png", { type: photoBlob.type || "image/png" }));
    if (logoBlob) {
      form.append("image[]", new File([logoBlob], "logo.png", { type: "image/png" }));
    }
    form.append("prompt", logoBlob ? AVATAR_PROMPT : AVATAR_PROMPT_NO_LOGO);
    form.append("size", "1024x1024");
    form.append("quality", "medium");

    const aiRes = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}` },
      body: form,
    });
    const aiData = await aiRes.json();
    if (!aiRes.ok) {
      console.error("OpenAI error:", aiRes.status, aiData);
      return json(
        { error: "Avatar generation failed — please try again in a moment.", details: aiData?.error?.message },
        502,
      );
    }
    const b64 = aiData?.data?.[0]?.b64_json;
    if (!b64) return json({ error: "Avatar generation returned no image." }, 502);
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

    // Store the avatar and remember it on the profile.
    const path = `${userId}/avatar-${studentId || "self"}-${Date.now()}.png`;
    const { error: uploadErr } = await admin.storage
      .from("student-photos")
      .upload(path, bytes, { contentType: "image/png", upsert: true });
    if (uploadErr) {
      console.error("Avatar upload failed:", uploadErr);
      return json({ error: "Couldn't save the generated avatar." }, 500);
    }
    const { data: pub } = admin.storage.from("student-photos").getPublicUrl(path);
    const avatarUrl = pub.publicUrl;

    if (studentId) {
      await admin.from("students").update({ avatar_url: avatarUrl }).eq("id", studentId);
    } else {
      await admin.from("profiles").update({ avatar_url: avatarUrl }).eq("user_id", userId);
    }

    return json({ avatarUrl });
  } catch (e) {
    console.error("generate-avatar error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});
