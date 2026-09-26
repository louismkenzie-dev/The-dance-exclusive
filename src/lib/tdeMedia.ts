import photos from "./tdePhotos.json";

export type SchoolPhoto = (typeof photos)[number];
export const schoolPhotos = photos;
export const tdePhoto = (key: string): SchoolPhoto => photos.find(photo => photo.key === key) ?? photos[0];
export const photoFromSrc = (src: string): SchoolPhoto | undefined => photos.find(photo => photo.src === src);
export const photoSrcSet = (photo: SchoolPhoto): string =>
  `${photo.src.replace(".webp", "-640.webp")} ${photo.smallWidth}w, ${photo.src} ${photo.width}w`;

/** Representative school photography, not a claim that a photo depicts this specific class.
 * Stable IDs keep the same photograph through filtering, SSR and the booking handoff. */
export function classPhoto(item: { id: string; class_type?: string; age_max?: number | null; school_year_max?: number | null }): SchoolPhoto {
  const keys = item.class_type === "adult"
    ? ["studio-energy", "studio-moves"]
    : (item.age_max != null && item.age_max <= 8) || (item.school_year_max != null && item.school_year_max <= 3)
      ? ["young-crew", "first-moves", "next-generation", "stage-together"]
      : ["street-crew", "stage-energy", "crew-lineup", "floorwork", "showtime", "red-jacket-crew", "take-a-bow"];
  const hash = Array.from(item.id).reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 0);
  return tdePhoto(keys[hash % keys.length]);
}
