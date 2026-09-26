# Blender scroll scene — 26 September 2026

The user requested an original Blender scene with 3D elements anchored to the page and animated by scrolling. The homepage now includes a blue sound-system sculpture between class discovery and the school story, at `/#turn-it-up`.

## Assets and behaviour

- Created locally in Blender 5.2.1 LTS from `design/blender/create_sound_stage.py`. The editable project is `design/blender/tde-sound-stage.blend`; the original transparent render is also retained there.
- The original mesh has enamel blue speaker cabinets, metallic drivers, a tape deck, equalizer bars, a carry handle and two sound-wave rings. No third-party model or generated brand/logo was used.
- `public/models/tde-sound-stage.glb` is the runtime model (approximately 724 KB). `public/media/tde-sound-stage.webp` is the lightweight still fallback. Design source files are excluded from Vercel upload.
- A native sticky section holds the scene for 210 viewport-height units on desktop or 175 on phones. Scroll turns the sculpture, separates the speakers, tilts the ring, highlights three captions and fills a progress line. Scrolling upwards reverses the choreography; the section releases into the school story at its end.
- Normal browser scrolling stays intact. The section has its own Pause/Play control sharing the homepage motion setting and a link that skips to the story. Existing imagery, class links and booking behaviour remain intact.
- Three.js is dynamically imported only near the stage. Rendering happens on scroll or resize, with a capped pixel ratio and no continuous render loop. Off-screen scroll updates stop. Navigation aborts model loading and disposes geometry, materials, the environment and renderer.
- Reduced motion loads only the still image, without requesting the GLB or scene runtime. Failed WebGL/model loads and context loss restore that image and remove the pinned duration. The scene is decorative; all text and navigation remain HTML.

## Verification

- Application TypeScript and changed-file ESLint pass. All 301 tests across 38 files pass, including WebGL failure, reduced motion and scene disposal tests. Client and server builds pass.
- Local browser screenshots at 1440px and 390px show the 3D sculpture, readable HTML text, blue palette and no horizontal overflow.
- At scroll progress 0.5 the stage stays at top 0 and the speakers separate. Pause holds the measured progress while scrolling; Play resumes updates.
- Additional release, accessibility, context-loss and deployed checks are recorded below after completion.

Preview only; no production, domain or database change is included.

Final local checks confirm progress 0.9 remains pinned at top 0; progress 1.0 releases the stage into normal document flow. Simulated WebGL context loss removed the canvas and restored a visible poster. The scene WCAG A/AA scan is clear after correcting its caption group's semantics. A fresh reduced-motion production browser requested neither the GLB nor the scene chunk and created no WebGL canvas. The 3D runtime is a separate lazy chunk (approximately 157 KB gzip); it is not part of initial page rendering.

## Verified Vercel preview

Code commit `2e4951c` is deployed as `dpl_8P7qLCmF6okiXwSsJR1gQy7vY4TG` (READY): https://the-dance-exclusive-fcz3w2mv4-nullshift.vercel.app/#turn-it-up.

The deployed scene was visually checked in the in-app browser. Its original blue Blender sculpture renders successfully; scrolling changes the model from joined cabinets to separated, rotated speakers while keeping the heading and scene anchored, and advances the caption/progress indicator. The preview was left open for review. The production website and deployment protection remain unchanged.
