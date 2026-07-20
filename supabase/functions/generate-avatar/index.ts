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

// Structured, high-detail prompt tuned for a great result on the FIRST pass
// (there is no regenerate in the UI). The character is stylised; the logo is
// explicitly excluded from stylisation and must stay a hyperreal, faithful
// screen print of the official mark.
const AVATAR_PROMPT =
  "You are given two input images. IMAGE 1 is a real photograph of a person. IMAGE 2 is the OFFICIAL logo of " +
  "The Dance Exclusive, a UK street-dance school: a bright cyan-blue paint-splat with bold white capital " +
  "letters reading 'THE DANCE EXCLUSIVE' and a small white crown above the lettering.\n\n" +
  "CHARACTER — Transform the person from IMAGE 1 into a premium 3D animated-movie character (modern " +
  "Pixar/DreamWorks feature-film quality). Preserve their real identity so they are instantly recognisable: " +
  "exact face shape, exact hairstyle, hairline and hair texture, exact skin tone, eye colour, eyebrows and " +
  "natural smile, plus distinctive features such as glasses, freckles or dimples if present. Keep their " +
  "apparent age, gender presentation, ethnicity and body proportions — apply only gentle, tasteful cartoon " +
  "stylisation (slightly larger expressive eyes, soft rounded forms). Warm, joyful, confident expression.\n\n" +
  "T-SHIRT AND LOGO — The character wears a plain black crew-neck cotton t-shirt. Printed large and centred " +
  "on the chest is the logo from IMAGE 2, reproduced with HYPERREALISTIC fidelity as a crisp professional " +
  "screen print: identical splat silhouette, identical letterforms and spelling ('THE DANCE EXCLUSIVE'), " +
  "identical crown, identical cyan-blue and white colours, correct aspect ratio, razor-sharp edges, fully " +
  "legible, facing the viewer with only the minimal natural curve of fabric drape. The logo is the ONE " +
  "element that must NOT be cartoonised: do not redesign, redraw, recolour, re-letter, warp, tilt, crop, " +
  "blur, simplify or stylise it, and do not add any other text or graphics to the shirt. Keep both arms and " +
  "hands completely clear of the chest so the entire logo is visible.\n\n" +
  "POSE AND SCENE — Dynamic mid-move street-dance freeze full of energy (for example one arm pointing " +
  "skyward, body angled, knees bent), torso squarely towards camera so the chest print reads clearly. " +
  "Setting: a live performance stage — dramatic deep-blue and magenta stage lighting with a coloured rim " +
  "light on the character, gentle atmospheric haze, soft out-of-focus crowd glow in the darkness behind, " +
  "subtle glossy reflection on the stage floor.\n\n" +
  "RENDER QUALITY — Cinematic studio render: high detail, soft subsurface skin shading, clean silhouette, " +
  "sharp focus on the character, vibrant but balanced colour grade that flatters the blue/magenta palette. " +
  "Family-friendly. Correct anatomy, five fingers per hand, no duplicate limbs, no watermarks, no captions " +
  "and no text anywhere in the image other than the t-shirt logo.";

// Adults (self profiles) don't get the cartoon: they get a hyperrealistic
// professional dance-studio portrait — dark backdrop with the brand's
// pink/magenta gradient lighting.
const ADULT_PROMPT =
  "You are given two input images. IMAGE 1 is a real photograph of a person. IMAGE 2 is the OFFICIAL logo of " +
  "The Dance Exclusive, a UK street-dance school: a bright cyan-blue paint-splat with bold white capital " +
  "letters reading 'THE DANCE EXCLUSIVE' and a small white crown above the lettering.\n\n" +
  "PORTRAIT — Recreate the person from IMAGE 1 as a HYPERREALISTIC professional dance-studio portrait " +
  "photograph — this is a real photo look, NOT a cartoon or illustration. Preserve their identity exactly: " +
  "same face shape, same hairstyle, hairline and hair texture, same skin tone, eye colour, eyebrows and " +
  "natural smile, plus distinctive features such as glasses, freckles or dimples if present. Photorealistic " +
  "skin with natural texture and pores, realistic individual hair detail, true-to-life body proportions, " +
  "apparent age, gender presentation and ethnicity unchanged. Expression: warm, confident, ready to dance. " +
  "Framing: polished head-and-shoulders to mid-torso editorial portrait, shot on an 85mm portrait lens at a " +
  "wide aperture — tack-sharp focus on the eyes, gentle falloff, shallow depth of field.\n\n" +
  "WARDROBE — A plain black crew-neck cotton t-shirt. Printed centred on the chest is the logo from IMAGE 2 " +
  "as a crisp professional screen print: identical splat silhouette, identical letterforms and spelling " +
  "('THE DANCE EXCLUSIVE'), identical crown, identical cyan-blue and white colours, sharp edges, fully " +
  "legible, with only the natural curve of fabric drape. Do not redesign, recolour, re-letter, warp or crop " +
  "the logo, and add no other text or graphics to the shirt.\n\n" +
  "LIGHTING AND BACKGROUND — The Dance Exclusive signature look: a dark, moody studio backdrop (near-black " +
  "charcoal) with a soft on-brand PINK-TO-MAGENTA gradient glow sweeping across it — brighter hot-pink haze " +
  "to one side fading into deep darkness on the other. A pink-magenta rim light traces the hair and " +
  "shoulders; a subtle cool cyan kicker on the opposite side adds contrast; gentle atmospheric haze catches " +
  "the light. Cinematic editorial dance-photography feel.\n\n" +
  "QUALITY — Hyperrealistic photographic detail throughout, professional colour grade flattering the " +
  "pink/magenta palette, clean composition, family-friendly. No text or graphics anywhere in the image other " +
  "than the t-shirt logo, no watermarks, no artifacts, correct anatomy.";

const ADULT_PROMPT_NO_LOGO =
  "Recreate the person in this real photograph as a HYPERREALISTIC professional dance-studio portrait " +
  "photograph — a real photo look, NOT a cartoon. Preserve their identity exactly: same face shape, " +
  "hairstyle, hairline and hair texture, skin tone, eye colour, eyebrows and natural smile, plus distinctive " +
  "features such as glasses or freckles. Photorealistic skin texture, realistic hair detail, unchanged age, " +
  "gender presentation, ethnicity and proportions. Warm, confident expression; polished head-and-shoulders " +
  "to mid-torso editorial framing, 85mm portrait-lens look with tack-sharp eyes and shallow depth of field. " +
  "They wear a plain black crew-neck t-shirt printed centred on the chest with the official school logo as a " +
  "crisp screen print: a bright cyan-blue paint splat behind bold white capital letters reading 'THE DANCE " +
  "EXCLUSIVE' with a small white crown above — sharp, legible, unaltered, no other text or graphics on the " +
  "shirt. Setting: dark near-black studio backdrop with a soft on-brand pink-to-magenta gradient glow " +
  "sweeping across it, pink-magenta rim light on hair and shoulders, a subtle cool cyan kicker opposite, " +
  "gentle haze. Hyperrealistic detail, professional colour grade, family-friendly, no watermarks and no " +
  "text anywhere except the t-shirt logo.";

// Fallback when the app couldn't attach the logo image: same brief, with the
// logo described as precisely as words allow.
const AVATAR_PROMPT_NO_LOGO =
  "Transform the person in this real photograph into a premium 3D animated-movie character (modern " +
  "Pixar/DreamWorks feature-film quality) for The Dance Exclusive, a UK street-dance school. Preserve their " +
  "real identity so they are instantly recognisable: exact face shape, hairstyle, hairline and hair texture, " +
  "skin tone, eye colour, eyebrows and natural smile, plus distinctive features such as glasses or freckles. " +
  "Keep their apparent age, gender presentation, ethnicity and body proportions — only gentle, tasteful " +
  "cartoon stylisation. They wear a plain black crew-neck t-shirt printed large and centred on the chest " +
  "with the official school logo rendered as a hyperrealistic crisp screen print: a bright cyan-blue paint " +
  "splat behind bold white capital letters reading 'THE DANCE EXCLUSIVE' with a small white crown above — " +
  "sharp-edged, fully legible, not stylised, with no other text or graphics on the shirt and both arms kept " +
  "clear of the chest. Pose: dynamic mid-move street-dance freeze, torso towards camera. Scene: live " +
  "performance stage with deep-blue and magenta lighting, rim light, gentle haze, soft crowd glow behind and " +
  "a subtle glossy floor reflection. Cinematic studio render, high detail, family-friendly, correct anatomy, " +
  "no watermarks and no text anywhere except the t-shirt logo.";

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

    // Resolve the source photo (and where to save the avatar). Adults — the
    // account holder's own profile, or a student row marked is_self — get the
    // hyperreal studio-portrait style; children get the cartoon.
    let sourceUrl: string | null = null;
    let isAdult = false;
    if (studentId) {
      const { data: student } = await admin
        .from("students")
        .select("id, parent_id, profile_photo, is_self")
        .eq("id", studentId)
        .maybeSingle();
      if (!student || student.parent_id !== userId) {
        return json({ error: "Attendee profile not found on your account." }, 404);
      }
      sourceUrl = student.profile_photo;
      isAdult = !!student.is_self;
    } else {
      const { data: profile } = await admin
        .from("profiles")
        .select("profile_photo")
        .eq("user_id", userId)
        .maybeSingle();
      sourceUrl = profile?.profile_photo ?? null;
      isAdult = true;
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
    const prompt = isAdult
      ? (logoBlob ? ADULT_PROMPT : ADULT_PROMPT_NO_LOGO)
      : (logoBlob ? AVATAR_PROMPT : AVATAR_PROMPT_NO_LOGO);
    form.append("prompt", prompt);
    form.append("size", "1024x1024");
    // One-shot generation (no regenerate in the UI), so spend on quality:
    // input_fidelity high preserves the face and the logo artwork faithfully.
    form.append("quality", "high");
    form.append("input_fidelity", "high");

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
