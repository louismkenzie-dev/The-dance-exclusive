/**
 * Choosing which product photo is the front and which is the back.
 *
 * `is_primary` already means "the tile image", which is the front, so only the back is new.
 * `is_back` is optional here on purpose: the column ships in its own migration, and until that is
 * applied the field is simply absent on every row. In that case we fall back to "the second
 * distinct photo by sort order", which is how the existing galleries are already ordered — so the
 * flip works the day the photos are attached, and gets more precise once the column exists.
 *
 * A product with one photo has no back, and `backMedia` returns undefined. Callers must treat that
 * as "this tile does not flip" rather than flipping to the same image.
 */

export type MerchMediaLike = {
  file_path: string;
  is_primary?: boolean | null;
  is_back?: boolean | null;
  sort_order?: number | null;
};

/** Stable ordering: sort_order ascending, nulls last, then by path so the result never wobbles. */
function ordered<M extends MerchMediaLike>(media: M[]): M[] {
  return [...media].sort((a, b) => {
    const ao = a.sort_order ?? Number.MAX_SAFE_INTEGER;
    const bo = b.sort_order ?? Number.MAX_SAFE_INTEGER;
    if (ao !== bo) return ao - bo;
    return a.file_path.localeCompare(b.file_path);
  });
}

/** The tile / hero image. Prefers an explicit primary, never returns a photo marked as the back. */
export function frontMedia<M extends MerchMediaLike>(media: M[] | null | undefined): M | undefined {
  if (!media?.length) return undefined;
  const list = ordered(media);
  const notBack = list.filter((m) => !m.is_back);
  const pool = notBack.length ? notBack : list;
  return pool.find((m) => m.is_primary) ?? pool[0];
}

/**
 * The reverse of the garment, or undefined when there isn't one.
 * Explicit `is_back` wins; otherwise the first photo that isn't the front.
 */
export function backMedia<M extends MerchMediaLike>(media: M[] | null | undefined): M | undefined {
  if (!media?.length) return undefined;
  const list = ordered(media);
  const front = frontMedia(list);
  if (!front) return undefined;

  // An explicit back wins — unless it is the only photo, in which case it is already the front and
  // flipping would swap the image for itself.
  const flagged = list.find((m) => m.is_back && m.file_path !== front.file_path);
  if (flagged) return flagged;

  return list.find((m) => m.file_path !== front.file_path);
}

/** Whether a tile should animate at all. */
export function hasFlip(media: MerchMediaLike[] | null | undefined): boolean {
  return backMedia(media) !== undefined;
}
