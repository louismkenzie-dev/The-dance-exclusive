# Homepage V2 — moving line field

Reference: https://wodniack.dev/ and the user-supplied screenshot /Users/louismckenzie/taste-vault/images/antoine-wodniack.webp. Viewed 27 September 2026. This is an original implementation borrowing composition and visual treatment, not source code or portfolio claims.

## Direction contract
THESIS: The rhythm becomes the image. A dense live line field makes the first screen move, while real dancers and current classes give the page its purpose.

OWN-WORLD: TDE blue (#48b5dd) and near-black (#080e16), one-pixel ruled cells, square frames, oversized condensed caps, small monospace rhythm strips. Original TDE logo untouched. Pink reserved for adults; full-colour photography remains below the abstract hero.

STORY: Understand this is street/commercial dance for children and adults in Essex, choose the right audience, filter real classes, and book without changing visual identity.

FIRST VIEWPORT: A ruled header holds the original logo, navigation and class CTA. A wide line field fills roughly the upper half of the remaining viewport. A small rhythm strip separates it from a monumental single-band STEP IN. / STAND OUT. headline, followed by direct children/adult actions. On mobile the headline becomes two compact rows and the primary actions remain immediately below it.

FORM: User-pinned Neon Brutalist / Editorial Chaos reference; code-led implementation of real canvas wave geometry, not a generated static picture. No speculative concept round or substitute visual direction is needed. Existing photo blocks, timetable and Founder-first team grid carry the ruled treatment down the page.

SIGNATURE INTERACTION: Smooth ripple displacement changes with time, pointer position and native scroll. Pause stops all homepage motion; reduced-motion renders static linework. Animation stops offscreen and while the tab is hidden. No scroll hijacking, fake loading status or unrelated binary claims.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## V1 checkpoint
- Git tag: tde-public-v1
- Backup branch: codex/dance-exclusive-v1
- Commit: 2eb56f8
- Preview: https://the-dance-exclusive-lg1pfgf05-nullshift.vercel.app/
Both git refs were pushed to origin before V2 edits. Recover in a new worktree or branch; do not reset unrelated work.

## Asset provenance
Existing photos: TDE Assets, mapped by src/lib/tdePhotos.json and docs/WEBSITE_ASSETS.md. Existing logo is the client's original artwork. Existing dance film and Blender scene remain. Anton is sourced from google/fonts/ofl/anton under the accompanying OFL licence. The wave field and four-point divider are original code geometry; no generated raster is needed for this reference.

## Verification — 27 September 2026
- 331 tests across 47 files passed, including static-canvas fallback, pause cleanup and reduced-motion coverage. TypeScript, targeted ESLint, production build and diff whitespace checks passed.
- Browser checked at 1280 × 900 and 390 × 844. Hero actions, photo panels, team and footer inspected; no horizontal overflow. Mobile navigation opens correctly.
- Children's CTA opens a filtered directory; White Court Street Dance retains its image and £91/term price. Booking opens sign-in inline on the class page. No account was created and no purchase was made.
- One Impeccable detector run returned no findings. Fresh finish reviewer identified three inherited contrast regressions; all were corrected and scored resolved in a verdict pass with disposition SHIP for that visual scope. Completed authenticated checkout is outside this review.
- Valid viewport captures are local in .impeccable/review/v2 (gitignored). The browser's stitched full-page images were malformed and excluded; desktop/mobile hero plus section captures were used instead.
- Production remains unchanged; this branch is a preview implementation.
- Deployed preview: https://the-dance-exclusive-22o8mm8pz-nullshift.vercel.app/ — opened successfully in the browser, live timetable/team content present and no console errors observed.

## Video and scroll choreography refinement
The supplied reference HTML linked public `/_astro/hoisted.BvNyQ0G_.js` and `/_astro/index.MJ9FiCyD.css`; both were available for inspection. The original source project is not needed to identify the effects. Source analysis found Lenis wheel interpolation, GSAP masked/character entrances, a sticky expanding aperture, travelling portfolio imagery and repeated lettering. TDE recreates these techniques with original component code, TDE type and supplied media; the reference bundle is not redistributed.

Implemented: blue dance-video hero underlay, masked letter entrance, scroll-reactive star/ticker/video, and a reversible sticky dance-photo sequence. Native touch and keyboard scrolling, dialog bypass, pause and reduced-motion fallbacks remain. Reference-only cursor toys, developer loading messages and portfolio content are not included.

Verification: 331 regression tests, TypeScript, targeted ESLint and production build passed. Desktop 1280×900 and mobile 390×844 inspected; no horizontal overflow. Video played with readyState 4, pause stopped videos and reverted sticky effects, scroll positions changed mask and image transforms, reverse scrolling restored preceding scene states. Detector advisories concern literal type sizes; new scene sizes are intentional and documented; existing type-ramp documentation drift was not redesigned.

## Full-bleed rhythm scene — 27 September 2026

The user requested that the moving DANCE field expand beyond its framed panel.
The scene now breaks out of the shared page gutter; its aperture covers the entire
sticky viewport behind the heading, controls and links. It opens with the existing
scroll-driven mask, then stays fully expanded through the travelling-photo sequence
instead of contracting again at the end. Three oversized type rows fill the viewport
height, including portrait mobile. Dark interface backplates maintain legibility.

Browser verified at 1440×900 and 390×844: expanded aperture is exactly viewport-sized,
starts at (0,0), has zero clip inset and creates no horizontal overflow. Pause removes
the enhanced layout and restores the static photo layout. Build, TypeScript and
component ESLint passed. Existing reduced-motion guard and GSAP cleanup retained.
