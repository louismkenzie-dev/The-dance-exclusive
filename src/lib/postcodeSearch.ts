export type PostcodeCoordinates = { lat: number; lon: number };

/** Shared by the booking browser and homepage: the existing free postcode lookup. */
export async function searchPostcode(postcode: string, signal?: AbortSignal): Promise<PostcodeCoordinates> {
  const cleaned = postcode.trim().replace(/\s+/g, " ");
  let response: Response;
  try {
    response = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(cleaned)}`, { signal });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error("Could not search postcode. Please try again.");
  }
  if (response.status === 404 || response.status === 400) throw new Error("Postcode not found. Please try again.");
  if (!response.ok) throw new Error("Could not search postcode. Please try again.");
  const json = await response.json();
  if (json.status !== 200 || !Number.isFinite(json.result?.latitude) || !Number.isFinite(json.result?.longitude)) {
    throw new Error("Postcode not found. Please try again.");
  }
  return { lat: json.result.latitude, lon: json.result.longitude };
}
