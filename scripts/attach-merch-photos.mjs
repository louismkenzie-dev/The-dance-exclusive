#!/usr/bin/env node
/**
 * Attach the product photos sitting unused in public/merch/ to their merchandise_items rows.
 *
 * Twelve cut-out product photos were committed to the repo but never linked to a product, so eight
 * of the thirteen live garments show a placeholder. This uploads each one to the merchandise-media
 * bucket and writes the merchandise_media row.
 *
 * Safe by default: prints what it would do and changes nothing. Pass --apply to write.
 * Idempotent: a photo already attached to its product is skipped, so re-running is harmless.
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/attach-merch-photos.mjs
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/attach-merch-photos.mjs --apply
 *
 * The service-role key is read from the environment and never logged.
 */
import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MERCH_DIR = path.join(HERE, "..", "public", "merch");
const BUCKET = "merchandise-media";
const APPLY = process.argv.includes("--apply");

/**
 * file in public/merch  ->  exact merchandise_items.name
 *
 * Matched on the live catalogue read 24 Sep 2026. Exact names, because a fuzzy match that attaches
 * the wrong photo to the wrong garment is worse than not running at all.
 */
const MAPPING = [
  ["joggers.png", "The Dance Exclusive Joggers"],
  ["shorts.png", "The Dance Exclusive Shorts"],
  ["limited-edition-hoodie.png", "Limited Edition Hoodie (EST 2019) Globe Logo"],
  ["splat-front-hoodie.png", "Splat Front Hoodie with Name Down Sleeve"],
  ["oversized-drop-shoulder-tshirt.png", "Oversized Drop Shoulder Splat Front"],
  ["splat-front-long-sleeve.jpeg", "Splat front long sleeved t-shirt"],
  ["contrast-sports-tee.png", "Contrast Sports Tee"],
  ["short-sleeve-crop-top.png", "Short sleeve splat front crop top"],
  ["splat-racer-back-crop-top.png", "Splat Racer Back Crop Top"],
  ["splat-front-tshirt.png", "Splat T-shirt"],
];

/**
 * Deliberately not mapped — these need a human decision, and the script will not guess.
 *
 * - high-neck-sleeveless-tee.png is a single photo showing BOTH the black and the white high-neck
 *   tops, but they are two separate products. Attaching it to both gives two tiles with an
 *   identical, confusing image; attaching it to one leaves the other blank. Amie should either
 *   split the shot or supply one photo per colour.
 * - bucket-hat.png has no product behind it at all. Either the product was never created or it was
 *   deleted; creating it is a catalogue decision, not a script's.
 * - "Dance Exclusive Fleece" (£22) has no photo anywhere in the repo, so it still needs one shot.
 */
const UNRESOLVED = [
  ["high-neck-sleeveless-tee.png", "shows two products at once (Black + White High Neck Sleeveless)"],
  ["bucket-hat.png", "no matching product exists in the catalogue"],
];
const MISSING_PHOTO = ["Dance Exclusive Fleece"];

const CONTENT_TYPE = { ".png": "image/png", ".jpeg": "image/jpeg", ".jpg": "image/jpeg", ".webp": "image/webp" };

function need(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing ${name}. Set it in the environment and re-run.`);
    process.exit(1);
  }
  return v;
}

const supabase = createClient(need("SUPABASE_URL"), need("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});

const plan = { attach: [], skip: [], missing: [] };

const { data: items, error: itemsError } = await supabase
  .from("merchandise_items")
  .select("id, name, merchandise_media(id, file_path, is_primary, sort_order)");

if (itemsError) {
  console.error("Could not read merchandise_items:", itemsError.message);
  process.exit(1);
}

const byName = new Map(items.map((i) => [i.name, i]));

for (const [file, productName] of MAPPING) {
  const item = byName.get(productName);
  if (!item) {
    plan.missing.push(`${file} -> no product named "${productName}"`);
    continue;
  }
  const storagePath = `items/${item.id}/${file}`;
  const already = (item.merchandise_media ?? []).some((m) => m.file_path === storagePath);
  if (already) {
    plan.skip.push(`${productName} — already has ${file}`);
    continue;
  }
  plan.attach.push({ file, item, storagePath, isFirst: (item.merchandise_media ?? []).length === 0 });
}

console.log(`\n${APPLY ? "APPLYING" : "DRY RUN — nothing will change"}\n`);

if (plan.attach.length) {
  console.log(`Will attach ${plan.attach.length} photo(s):`);
  for (const a of plan.attach) {
    console.log(`  + ${a.item.name}\n      ${a.file}${a.isFirst ? "  (becomes the tile image)" : "  (extra photo)"}`);
  }
}
if (plan.skip.length) console.log(`\nAlready done (${plan.skip.length}):\n  ${plan.skip.join("\n  ")}`);
if (plan.missing.length) console.log(`\nCould not match (${plan.missing.length}):\n  ${plan.missing.join("\n  ")}`);

console.log("\nNeeds a decision from Amie — not touched by this script:");
for (const [file, why] of UNRESOLVED) console.log(`  ? ${file} — ${why}`);
for (const name of MISSING_PHOTO) console.log(`  ? "${name}" — no photo exists in the repo; still needs one taken`);

if (!APPLY) {
  console.log("\nRe-run with --apply to write these changes.\n");
  process.exit(0);
}

let ok = 0;
for (const a of plan.attach) {
  const abs = path.join(MERCH_DIR, a.file);
  let bytes;
  try {
    bytes = await readFile(abs);
  } catch {
    console.error(`  ! ${a.file} — not found at ${abs}, skipped`);
    continue;
  }

  const contentType = CONTENT_TYPE[path.extname(a.file).toLowerCase()] ?? "application/octet-stream";
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(a.storagePath, bytes, { contentType, upsert: true });
  if (upErr) {
    console.error(`  ! ${a.item.name} — upload failed: ${upErr.message}`);
    continue;
  }

  const sortOrder = (a.item.merchandise_media ?? []).length + 1;
  const { error: insErr } = await supabase.from("merchandise_media").insert({
    item_id: a.item.id,
    file_path: a.storagePath,
    is_primary: a.isFirst,
    sort_order: sortOrder,
  });
  if (insErr) {
    console.error(`  ! ${a.item.name} — row insert failed: ${insErr.message}`);
    continue;
  }

  console.log(`  ✓ ${a.item.name} <- ${a.file}`);
  ok += 1;
}

console.log(`\nAttached ${ok} of ${plan.attach.length}.\n`);
