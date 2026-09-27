// Keep these widths and quality in sync with vercel.json. Restrict optimisation
// to public booking artwork; private/signed and unrelated URLs stay untouched.
export function bookingCoverImage(src: string, sizes: string, enabled = import.meta.env.PROD) {
  if (!enabled) return null;
  let url: URL;
  try { url = new URL(src); } catch { return null; }
  if (url.origin !== "https://suwaetnsszlpaaykhpif.supabase.co" ||
      !url.pathname.startsWith("/storage/v1/object/public/workshop-media/") ||
      !/\.(jpe?g|png|webp)$/i.test(url.pathname)) return null;
  const resized = (width: number) => `/_vercel/image?url=${encodeURIComponent(src)}&w=${width}&q=80`;
  return {
    src: resized(768),
    srcSet: [480, 768, 1080, 1440, 1920].map(width => `${resized(width)} ${width}w`).join(", "),
    sizes,
  };
}
