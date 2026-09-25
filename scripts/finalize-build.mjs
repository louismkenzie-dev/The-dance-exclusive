import { renameSync } from "node:fs";
// A static index.html takes precedence over Vercel rewrites. Keep the template
// under a different filename so the front page always receives live HTML.
renameSync("dist/index.html", "dist/app.html");
