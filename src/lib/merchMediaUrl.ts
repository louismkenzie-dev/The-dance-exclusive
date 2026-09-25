import { supabase } from "@/integrations/supabase/client";

/**
 * Resolve a merchandise photo to a URL.
 *
 * `merchandise_media.file_path` is a storage path (items/<id>/...), not a URL, so it has to go
 * through the public bucket. Absolute paths and full URLs are passed through untouched, which is
 * what lets bag items keep whatever was stored against them.
 *
 * Kept out of merchMedia.ts on purpose: that module stays dependency-free so its tests do not need
 * a Supabase client.
 */
export const getMediaUrl = (path: string | null | undefined) => {
  if (!path) return "/placeholder.svg";
  if (path.startsWith("http") || path.startsWith("/")) return path;
  const { data } = supabase.storage.from("merchandise-media").getPublicUrl(path);
  return data?.publicUrl || "/placeholder.svg";
};
