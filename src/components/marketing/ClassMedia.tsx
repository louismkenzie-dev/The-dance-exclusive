import { useState } from "react";
import WorkshopCover from "@/components/WorkshopCover";
import { supabase } from "@/integrations/supabase/client";
import type { PublicWorkshopCover } from "@/lib/publicSchool";
import { classPhoto } from "@/lib/tdeMedia";
import { SchoolPhoto } from "./SchoolPhoto";

type MediaClass = Parameters<typeof classPhoto>[0] & {
  name: string;
  workshops?: PublicWorkshopCover | null;
};

/** Booking-system cover and framing take priority over representative school photos. */
export function ClassMedia({ item, eager = false, decorative = false, sizes }: {
  item: MediaClass;
  eager?: boolean;
  decorative?: boolean;
  sizes?: string;
}) {
  const cover = item.workshops;
  const path = cover?.cover_image?.trim();
  const src = path ? (/^https?:\/\//i.test(path) ? path : supabase.storage.from("workshop-media").getPublicUrl(path).data.publicUrl) : null;
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const attached = src && src !== failedSource;
  return <div className="tde-class-media" data-attached={attached ? "true" : undefined}>
    {attached ? <WorkshopCover src={src} alt={decorative ? "" : `${item.name} — class artwork`}
      cover_position={cover?.cover_position} cover_zoom={cover?.cover_zoom} cover_fit={cover?.cover_fit}
      loading={eager ? "eager" : "lazy"} onError={() => setFailedSource(src)} />
      : <SchoolPhoto photo={classPhoto(item)} eager={eager} decorative={decorative} sizes={sizes} />}
  </div>;
}
