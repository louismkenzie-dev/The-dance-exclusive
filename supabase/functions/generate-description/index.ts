// Admin-only: draft a short, on-brand description for a class, workshop,
// camp or class pass. The studio fills in the facts (name, style, ages,
// length); this turns them into a couple of sentences a parent would read on
// the booking site. Always a DRAFT — the admin edits and saves it themselves.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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

/** House style, so drafts sound like the studio rather than a brochure. */
const SYSTEM_PROMPT = [
  "You write short descriptions for The Dance Exclusive, a street-dance and",
  "commercial dance school in Essex (Kelvedon, Braintree, White Notley,",
  "Chelmsford, Clacton). The reader is a parent choosing a class for their",
  "child, or an adult choosing a class for themselves.",
  "",
  "Rules:",
  "- 2 to 3 sentences, under 60 words. No headings, no bullet points, no emoji.",
  "- Warm, energetic and down to earth. British English.",
  "- Say what they'll actually do and how it will feel. Welcoming to beginners",
  "  unless told otherwise.",
  "- Use ONLY the facts given. Never invent prices, times, venues, teacher",
  "  names, ages or qualifications that were not provided.",
  "- No exclamation marks beyond one, and never use the words 'unleash',",
  "  'journey', 'passion' or 'vibrant'.",
  "- Output the description text only, with no surrounding quotes.",
].join("\n");

/**
 * Practical text (how to find the hall, where to park, where to drop off) has
 * a different job from selling a class: a parent reads it in the car. Nudge
 * the model towards plain instructions and, above all, away from inventing
 * directions that don't exist.
 */
const PRACTICAL_PROMPT = [
  "",
  "This one is practical information a parent reads on their way to the venue,",
  "not marketing copy. Extra rules for it:",
  "- Give clear, plain instructions in the order someone would follow them.",
  "- NEVER invent a road name, landmark, car park, entrance, gate, door code,",
  "  cost or restriction that was not given to you. If a detail is missing,",
  "  leave it out entirely rather than guessing.",
  "- Up to 4 short sentences is fine here.",
].join("\n");

/** Does this draft describe how to get somewhere rather than what happens? */
const isPracticalKind = (kind: string) =>
  /direction|parking|drop-?off|access|how to find/i.test(kind);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      return jsonResponse({
        error: "The description writer isn't switched on yet.",
        code: "not_configured",
      }, 503);
    }

    // Admin only — this spends API credit.
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
    if (!adminRole) return jsonResponse({ error: "Only admins can use this" }, 403);

    const body = await req.json().catch(() => ({}));
    const kind = typeof body.kind === "string" ? body.kind.slice(0, 40) : "class";
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
    if (!name) {
      return jsonResponse({ error: "Give it a name first and I'll draft something." }, 400);
    }

    // Free-form facts the admin has already filled in, e.g. style, ages,
    // length, level. Anything missing is simply left out of the prompt.
    const facts: string[] = [];
    const addFact = (label: string, value: unknown) => {
      if (value == null) return;
      const text = String(value).trim();
      if (text) facts.push(`${label}: ${text.slice(0, 200)}`);
    };
    addFact("Name", name);
    addFact("What it is", kind);
    addFact("Dance style", body.danceStyle);
    addFact("Who it's for", body.audience);
    addFact("Ages", body.ages);
    addFact("Class length", body.durationMinutes ? `${body.durationMinutes} minutes` : null);
    addFact("Level", body.level);
    addFact("Venue", body.venue);
    addFact("Extra notes from the studio", body.notes);
    if (typeof body.existing === "string" && body.existing.trim()) {
      addFact("Rewrite and improve this existing text", body.existing);
    }

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: isPracticalKind(kind) ? SYSTEM_PROMPT + PRACTICAL_PROMPT : SYSTEM_PROMPT,
          },
          { role: "user", content: facts.join("\n") },
        ],
        max_tokens: 200,
        temperature: 0.8,
      }),
    });

    if (!aiRes.ok) {
      const detail = await aiRes.text().catch(() => "");
      console.error("generate-description upstream error:", aiRes.status, detail.slice(0, 400));
      return jsonResponse({
        error: "Couldn't write one just now — please try again in a moment.",
      }, 502);
    }

    const payload = await aiRes.json();
    const description = String(payload?.choices?.[0]?.message?.content ?? "")
      .replace(/^["'\s]+|["'\s]+$/g, "")
      .slice(0, 600);
    if (!description) {
      return jsonResponse({ error: "Couldn't write one just now — please try again." }, 502);
    }

    return jsonResponse({ success: true, description });
  } catch (e: any) {
    console.error("generate-description error:", e);
    return jsonResponse({ error: e?.message ?? "Something went wrong" }, 500);
  }
});
