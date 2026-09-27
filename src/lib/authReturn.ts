/** Keep sign-in, OAuth and confirmation returns on this application's origin. */
export function safeReturnPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || [...value].some(char => char.charCodeAt(0) < 32)) return "/";
  try {
    const url = new URL(value, "https://tde.invalid");
    return url.origin === "https://tde.invalid" ? `${url.pathname}${url.search}${url.hash}` : "/";
  } catch { return "/"; }
}
