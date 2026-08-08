---
name: remotion
description: Create programmatic videos with Remotion (React-based video rendering). Use when asked to make, render, or edit a video — promo videos, class adverts, social clips, animated announcements, intro/outro stings — or when the user mentions Remotion, create-video, or video rendering. Produces real .mp4/.webm/.gif files rendered headlessly in this environment.
---

# Remotion — programmatic video in this environment

Remotion renders React components to video. It works fully inside Claude Code
cloud sessions **as long as you follow the environment rules below** — the
default `npx create-video` + `npx remotion render` flow will fail here without
them.

## Environment rules (verified working 8 Aug 2026)

1. **Never scaffold into the app repo root.** Create video projects in a
   subdirectory (e.g. `video/` if it should be committed) or the scratchpad
   (for one-off renders). The main repo is a live production site.
2. **npm install works** (registry.npmjs.org bypasses the egress proxy), but
   **Remotion's Chrome auto-download is BLOCKED** by the network policy.
   Always point Remotion at the pre-installed browser:
   ```bash
   BROWSER=$(ls -d /opt/pw-browsers/chromium_headless_shell-*/chrome-linux/headless_shell 2>/dev/null | head -1)
   [ -z "$BROWSER" ] && BROWSER=$(ls -d /opt/pw-browsers/chromium-*/chrome-linux/chrome | head -1)
   npx remotion render src/index.ts <CompositionId> out.mp4 --browser-executable="$BROWSER"
   ```
   (The version suffix in the path changes over time — always glob, never
   hard-code.)
3. `create-video@latest` is interactive and hangs in headless sessions.
   Scaffold manually instead (below) — it's four small files.
4. Google Fonts / remote assets may be blocked. Prefer system fonts or commit
   font files locally and load with `@remotion/fonts` `loadFont`. `staticFile()`
   assets from the project's `public/` folder always work.
5. Deliver finished videos to the user with the SendUserFile tool.

## Minimal scaffold (no interactivity)

`package.json`:
```json
{
  "name": "video",
  "private": true,
  "dependencies": {
    "@remotion/cli": "^4.0.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "remotion": "^4.0.0"
  }
}
```

`src/index.ts`:
```ts
import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root";
registerRoot(RemotionRoot);
```

`src/Root.tsx` — one `<Composition>` per video:
```tsx
import { Composition } from "remotion";
import { MyVideo } from "./MyVideo";

export const RemotionRoot: React.FC = () => (
  <Composition id="MyVideo" component={MyVideo} durationInFrames={150} fps={30} width={1920} height={1080} />
);
```

Then `npm install --no-audit --no-fund` and render with the
`--browser-executable` flag from rule 2. Useful extras: `--concurrency=2`
(container CPUs are limited), `--codec=h264` (default, .mp4), `--codec=gif`,
`--frames=0-59` for a quick preview render of a slice.

## Writing compositions

- `useCurrentFrame()` + `interpolate()`/`spring()` drive all animation.
- `<AbsoluteFill>` for full-bleed layers; `<Sequence from={n}>` to time-shift
  scenes; `<Series>` for back-to-back scenes; `<Audio src={staticFile(...)}>`
  for music.
- Portrait social format: width 1080 × height 1920. Square: 1080 × 1080.
- Brand palette for The Dance Exclusive: dark background `#0a0a14`, cyan
  `hsl(193,100%,44%)` (children/brand), hot pink `hsl(330,90%,55%)` (adults),
  bold uppercase display type.
- Assets from the live site (venue photos, merch shots, workshop art) live in
  Supabase storage buckets — download them into the project's `public/` dir
  and reference with `staticFile()` rather than hotlinking (remote URLs may be
  blocked at render time).

## Checking a render without watching it

Render a single still to inspect composition quickly:
```bash
npx remotion still src/index.ts <CompositionId> preview.png --browser-executable="$BROWSER" --frame=30
```
Read the PNG (it's an image) to review, iterate, then do the full render.
