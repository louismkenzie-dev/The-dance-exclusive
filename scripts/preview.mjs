import { createServer } from "node:http";
import { createReadStream, readFileSync, statSync } from "node:fs";
import { resolve, extname, sep } from "node:path";
import handler from "../api/render.js";

const base = resolve("dist");
const { redirects = [] } = JSON.parse(readFileSync("vercel.json", "utf8"));
const types = {
  ".css": "text/css",
  ".js": "text/javascript",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
  ".txt": "text/plain",
};
const port = Number(process.env.PORT || 4180);
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    const redirect = redirects.find((item) => item.source === url.pathname);
    if (redirect) {
      const destination = new URL(redirect.destination, url);
      url.searchParams.forEach((value, key) => {
        if (!destination.searchParams.has(key)) destination.searchParams.set(key, value);
      });
      res.statusCode = redirect.permanent ? 308 : 307;
      res.setHeader("Location", destination.pathname + destination.search);
      res.end();
      return;
    }
    const file = resolve(base, "." + decodeURIComponent(url.pathname));
    let stat;
    if (file.startsWith(base + sep)) {
      try {
        stat = statSync(file);
      } catch {}
    }
    if (stat?.isFile()) {
      res.setHeader(
        "Content-Type",
        types[extname(file)] || "application/octet-stream",
      );
      res.setHeader("Accept-Ranges", "bytes");
      let start = 0,
        end = stat.size - 1;
      const range = req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
      if (range) {
        start = Number(range[1]);
        end = range[2] ? Math.min(Number(range[2]), end) : end;
        if (start > end) {
          res.statusCode = 416;
          res.end();
          return;
        }
        res.statusCode = 206;
        res.setHeader("Content-Range", `bytes ${start}-${end}/${stat.size}`);
      }
      res.setHeader("Content-Length", end - start + 1);
      if (req.method === "HEAD") res.end();
      else createReadStream(file, { start, end }).pipe(res);
      return;
    }
    req.query = Object.fromEntries(url.searchParams);
    req.query.path ||= url.pathname;
    await handler(req, res);
  } catch (error) {
    console.error(error);
    res.statusCode = 500;
    res.end("Preview error");
  }
}).listen(port, "127.0.0.1", () =>
  console.log(`Production preview: http://127.0.0.1:${port}`),
);
