import { supabase } from "@/integrations/supabase/client";

export const coachPhotoUrl = (path: string | null) =>
  path?.startsWith("http") ? path : path
    ? supabase.storage.from("staff-photos").getPublicUrl(path).data.publicUrl
    : null;
