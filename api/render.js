import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderPublicRequest } from "../dist-ssr/entry-server.js";

const template = readFileSync(join(process.cwd(), "dist/app.html"), "utf8");

export default async function handler(req, res) {
  if (!["GET", "HEAD"].includes(req.method || "GET")) {
    res.setHeader("Allow", "GET, HEAD");
    res.statusCode = 405;
    res.end("Method not allowed");
    return;
  }
  const incoming = new URL(req.url, "https://www.thedanceexclusive.co.uk");
  const route =
    req.query?.path ?? incoming.searchParams.get("path") ?? incoming.pathname;
  const path = Array.isArray(route) ? "/" + route.join("/") : route;
  if (
    typeof path !== "string" ||
    !path.startsWith("/") ||
    path.startsWith("//")
  ) {
    res.statusCode = 400;
    res.end("Invalid path");
    return;
  }
  incoming.searchParams.delete("path");
  const query = incoming.searchParams.toString();
  try {
    const result = await renderPublicRequest(
      path + (query ? "?" + query : ""),
      template,
    );
    res.statusCode = result.status;
    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Cache-Control", result.cache);
    if (result.noindex || process.env.VERCEL_ENV === "preview")
      res.setHeader("X-Robots-Tag", "noindex, follow");
    res.end(req.method === "HEAD" ? undefined : result.body);
  } catch (error) {
    console.error(
      "Public page unavailable:",
      error instanceof Error ? error.message : "data request failed",
    );
    res.statusCode = 503;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Retry-After", "30");
    res.setHeader("X-Robots-Tag", "noindex, follow");
    res.end(
      req.method === "HEAD"
        ? undefined
        : template.replace(
            "<!--app-html-->",
            "<p>We could not load the latest class details. Please try again in a moment.</p>",
          ),
    );
  }
}
