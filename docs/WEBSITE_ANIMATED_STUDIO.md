# Actual Blender dance studio — 26 September 2026

The user corrected the previous photographic projection: they want a moving Blender scene, with dance-related content inside the studio. This revision replaces the active photographic assets with actual modelled geometry and animation. No Higgsfield connection is needed for this implementation.

- Original studio geometry: sprung floor and board joints, navy walls, tinted panels, a rear bench, cyan light strips and a ceiling.
- A deliberately stylised faceless ceramic/blue mannequin has independently articulated arms, legs, body, head, hands and trainers. Five street-dance poses are baked into approximately four seconds of Blender animation, exported as 27 synchronized object clips. There are 76 meshes; the runtime GLB is about 550 KB and contains no photographic plate.
- Scroll position sets animation time in every clip and moves the camera. Forward and reverse scrolling change the actual body poses. The section pins and releases using native document scrolling. Pause/Play, the skip link, lazy loading, cancellation and WebGL cleanup remain.
- Desktop and phone camera framing differ to keep the full figure visible. The original logo and page text remain HTML. Reduced-motion and failed-WebGL visitors receive actual Blender renders of this modelled studio.

## Source and runtime assets

- `design/blender/create_animated_studio.py` — complete reproducible scene and choreography.
- `design/blender/tde-animated-studio.blend` — editable model, lights, cameras and keyframes.
- `public/models/tde-animated-studio.glb` — real studio geometry and body animation.
- `public/media/tde-animated-studio.jpg` and `tde-animated-studio-mobile.jpg` — Blender-rendered still fallbacks.
- `src/lib/danceStudio.ts` — lighting, animation scrubbing, camera and resource lifecycle.

The old studio-photo and sound-system files are retained as earlier design iterations, but the active section no longer loads them. `WEBSITE_DANCE_STUDIO.md` describes the superseded photographic version, not this implementation.

## Verification

302 tests across 39 files pass, along with application TypeScript, changed-file ESLint and the client/server build. The new asset-level regression reads the real GLB and verifies studio meshes and varying hand-position keyframes, rather than relying only on mocked rendering.

Browser checks show different body poses at the beginning and midpoint: scroll 0.5 corresponds to animation time approximately 2.018 seconds and the section stays at top 0. The 390px layout keeps the figure within frame and its scene WCAG A/AA scan is clear. Desktop and phone screenshots confirm actual geometry, blue branding and the original logo. Deployment verification is recorded below once complete.

This revision is preview only; no production, domain, database or booking changes are included.

The browser also verifies reverse scrubbing (3.026 seconds down to 1.006 seconds), Pause holding 1.006 seconds while scrolling, and the final 4.033-second pose releasing the pinned stage by 200px. No overflow or runtime errors were reported. The production build loads all 27 animation clips. A fresh reduced-motion production browser creates no canvas and requests no GLB.
