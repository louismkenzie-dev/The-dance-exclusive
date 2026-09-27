---
name: The Dance Exclusive — Public V2
description: TDE blue, ruled frames and a live rhythm field around authentic dance content.
colors:
  tde-blue: "#48b5dd"
  ink: "#080e16"
  rule: "#48b5dd70"
  body-light: "#e9f6fb"
  adult-panel: "#ef87b8"
  adult-hover: "#ff80bb"
  button-ink: "#101014"
  white: "#fff"
  field-bg: "#061a2d"
  field-text: "#eff9ff"
  field-border: "#7fabbf"
  chip-blue: "#00b0e0"
  chip-ink: "#031322"
  chip-adult: "#f49abc"
  chip-adult-ink: "#281020"
typography:
  display:
    fontFamily: '"TDE Condensed", sans-serif'
    fontSize: "clamp(64px, 12.8vw, 210px)"
    fontWeight: 400
    lineHeight: 1.08
    letterSpacing: "-.025em"
  headline:
    fontFamily: '"TDE Condensed", sans-serif'
    fontSize: "clamp(56px, 7.2vw, 112px)"
    fontWeight: 400
    lineHeight: 1.02
    letterSpacing: "-.015em"
  panel-title:
    fontFamily: '"TDE Condensed", sans-serif'
    fontSize: "clamp(38px, 4.2vw, 65px)"
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: "-.015em"
  body:
    fontFamily: "Inter, sans-serif"
    fontSize: "1rem"
    lineHeight: 1.7
    letterSpacing: "-.02em"
  label:
    fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace'
    fontSize: "10px"
    lineHeight: 1
    letterSpacing: ".035em"
rounded:
  public-frame: "0"
  town-select: "8px"
spacing:
  frame-desktop: "12px"
  frame-mobile: "8px"
  section-desktop: "64px 4%"
  section-mobile: "40px 16px"
  panel-copy: "24px"
components:
  button-primary:
    backgroundColor: "{colors.tde-blue}"
    textColor: "{colors.button-ink}"
    rounded: "{rounded.public-frame}"
    padding: "15px 24px"
  button-primary-hover:
    backgroundColor: "{colors.white}"
    textColor: "#111"
  header-cta:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.tde-blue}"
    rounded: "{rounded.public-frame}"
    padding: "20px"
    height: "100%"
  header-cta-hover:
    backgroundColor: "{colors.tde-blue}"
    textColor: "{colors.ink}"
  panel-copy:
    backgroundColor: "{colors.tde-blue}"
    textColor: "{colors.ink}"
    rounded: "{rounded.public-frame}"
    padding: "24px"
  panel-copy-adult:
    backgroundColor: "{colors.adult-panel}"
    textColor: "{colors.ink}"
  town-select:
    backgroundColor: "{colors.field-bg}"
    textColor: "{colors.field-text}"
    rounded: "{rounded.town-select}"
    padding: "12px"
    width: "100%"
  audience-chip-selected:
    backgroundColor: "{colors.chip-blue}"
    textColor: "{colors.chip-ink}"
    rounded: "{rounded.public-frame}"
    padding: "10px 20px"
  audience-chip-adult-selected:
    backgroundColor: "{colors.chip-adult}"
    textColor: "{colors.chip-adult-ink}"
    rounded: "{rounded.public-frame}"
    padding: "10px 20px"
---

# Design System: The Dance Exclusive — Public V2

## Overview

**Creative North Star: "The rhythm becomes the image"**

The rhythm becomes the image. TDE blue, near-black grounds, ruled cells and condensed headlines give the public site a direct street-dance character. Real school photography carries the human story below the original moving line field. The original TDE logo remains the identity asset.

This documents the implemented V2 public shell and homepage, plus the shared public patterns they reuse. It does not redefine the booking application: authentication, eligibility, attendee selection and payment behavior remain governed by the existing components. The selected reference is Antoine Wodniack’s warped hairline field and separated headline composition; the canvas, divider geometry and TDE content are original implementation.

**Key Characteristics:**

- TDE blue and near-black, with pink restricted to adult-oriented content.
- One-pixel rules, square public frames and oversized condensed headings.
- Authentic TDE media and practical class discovery.
- User-controlled motion with static reduced-motion rendering.

Implementation authority: `src/styles/public-v2.css`, loaded after `public-site.css` and `public-brand.css` by `PublicSiteShell.tsx`. The homepage direction and reference provenance are recorded in `docs/design/home-v2.md`; durable brand constraints are in `PRODUCT.md`. This is a code-extracted system record, not a claim that every route or accessibility criterion has passed review.

## Colors

### Primary

**TDE blue** fills the header, hero and footer, supplies dark-section headings and rules, and colors primary public actions. **Ink** is the foreground on these blue bands and the main dark ground. The lighter V2 blue overrides the earlier public blue within the V2 wrapper.

### Secondary

**Adult panel pink** belongs to the adult audience panel; **adult hover pink** appears on the adult hero action when hovered. The inherited audience switch uses its existing selected blue and adult pink values. These are contextual variants, not replacements for the school identity.

### Neutral

**Body light** carries homepage section copy. **Rule** is the translucent blue used on class, team and timetable borders. White and button ink remain part of inherited public action states. Town-select colors preserve the existing dark form surface, pale text and blue-grey stroke.

**The Adult Context Rule.** Pink is reserved for adult-oriented content.

## Typography

**Display font:** locally hosted Anton, registered as “TDE Condensed,” with sans-serif fallback. Its font file is `public/fonts/anton.ttf`; the Google Fonts OFL license is `public/fonts/anton-OFL.txt`.

**Body font:** Inter, shared with booking. **Labels:** the system monospace stack recorded above. The existing “TDE Intro” face remains in legacy or unoverridden public components; V2 does not globally replace every heading.

Condensed capitals deliver the poster scale; Inter keeps descriptions, prices and booking choices readable. Monospace labels separate navigation and rhythm information from promotional copy. Hero, section and panel-title roles use the frontmatter values. The hero becomes two rows on mobile, using 20vw type and 1.1 line height; desktop widths above 1700px use 12.8vw. Homepage section headings become 58px at the mobile breakpoint; panel titles become 43px. Labels are uppercase where implemented; body copy retains normal case.

## Layout

The public shell has a thin dark outer frame. Its header is a ruled grid, 94px high on desktop: logo, locality/style signal, navigation and account/class controls. At 1100px the signal disappears. At 760px the shell frame tightens, the header becomes 76px high, desktop navigation and its class CTA disappear, and the account link plus menu remain.

The homepage hero keeps artwork, rhythm strip, headline and audience actions in separate bands. Artwork height is `clamp(260px, 41svh, 500px)` on desktop and `clamp(210px, 29svh, 310px)` on mobile. The action grid changes from four columns to three at 1100px, then two audience columns beneath the intro at 760px. Homepage wheel scrolling uses Lenis (lerp 0.085), with native touch and keyboard scrolling. It is removed on pause, reduced motion and route exit; dialogs and form controls bypass smoothing.

Below the hero, sections use the frontmatter padding values. Children's and adult photo panels share a ruled boundary and stack on mobile. Their image rows are 330px on desktop and 280px on mobile. The intro portrait changes from 4:5 to square. This composition belongs to the homepage; other routes retain their own functional layouts inside the updated shell.

## Elevation & Depth

The new hero and ruled public frames are flat. Contrast, one-pixel rules, photographic crops and moving linework provide separation. V2 explicitly removes shadows from audience panels, class photo cards, team photo cards and timetable surfaces. Some inherited components still have their existing depth treatment; this is not a global shadow reset.

## Shapes

Square public frames connect the header, audience panels, team portraits, location imagery, class cards, class banners and inline booking containers. Most timetable surfaces and switches are also squared. This does not imply every nested control is square: the town selector retains its existing gently rounded corners and class audience badges retain their pill shape. One-pixel rules divide content bands. The original four-point SVG divider is decorative and hidden from assistive technology.

## Components

### Buttons and audience actions

Primary public buttons use blue with dark text, square corners, a 54px minimum height and the recorded padding. Their inherited hover state becomes white with dark text. The header CTA reverses to blue text on ink and inverts on hover. Hero audience actions occupy full ruled cells; their hover state becomes ink with blue text, with pink confined to the adult action. The mobile hero actions have a 58px minimum height.

### Navigation

The desktop header uses uppercase monospace links with underlined hover states. The right-side sheet retains the existing numbered all-pages navigation and closes when the pathname or query changes. It is a separate portal surface and keeps its existing dark palette. The original logo is used in ink on blue and white on the dark sheet; do not redraw its geometry. The shell retains the skip link and labelled navigation landmarks.

### Cards and media

Audience panels separate label, authentic photo and colored copy into distinct rows. Hover underlines the panel title. Team and class cards retain content and data behavior while adopting square public frames. Class photo cards retain their existing border response, slight hover lift and image zoom, disabled under reduced motion.

TDE photographs are mapped by `src/lib/tdePhotos.json`; provenance is documented in `docs/WEBSITE_ASSETS.md`. Existing dance film and Blender media remain separate assets. The line field and four-point star are original code geometry, not generated raster assets. The selected visual reference is [Antoine Wodniack](https://wodniack.dev/), viewed on 27 September 2026; it supplies composition and treatment, not source code, identity or portfolio claims.

### Inputs and audience switches

The public timetable venue select retains its existing booking-theme background, foreground, input stroke and 48px minimum height; V2 changes its radius. The town selector retains its existing dark fill, blue-grey border, 56px minimum height and rounded corners. Audience buttons retain their existing selected blue/adult-pink states, 44px minimum height and `aria-pressed` behavior, with square V2 corners. Authentication, booking fields, error states, eligibility rules and payments are inherited from their existing components; this document introduces no new interaction rules for them.

### Rhythm field and motion controls

The hero film `/media/tde-hero-film.mp4` plays muted beneath the transparent hairline canvas, blue-tinted through a color blend. GSAP sequences a 1.25s aperture reveal and 1.05s masked letter rolls with 25ms stagger. The scroll-linked star, ticker and video scale use 0.7–0.8s scrub smoothing.

`DanceScrollScene` is the reference-inspired focal scroll sequence: a 260svh desktop / 220svh mobile track holds a 100svh sticky viewport. An elliptical aperture opens onto counter-moving DANCE rows and three supplied photos travelling across the frame. A 0.8s scrub reverses with scroll. Its heading uses `clamp(38px, 5vw, 76px)` / 36px mobile, controls 11px / 10px, mobile links 13px. Pause and reduced motion revert to a normal-flow photo grid; scene actions remain stationary. Video pauses offscreen and in hidden tabs.

`RhythmField.tsx` renders decorative canvas linework and an SVG fallback when canvas is unavailable. Animation combines time, non-touch pointer movement and native scroll displacement. It targets 30 frames per second, caps canvas pixel ratio at 2, and suspends animation outside the viewport or in a hidden tab.

The hero's labelled pause/play button controls the homepage motion state. The same state is passed to homepage motion components. Reduced-motion preference forces static rendering and labels the disabled control “Reduced motion.” Decorative canvas, rhythm strip and star are hidden from assistive technology; the real heading and actions remain semantic HTML. Do not infer a no-JavaScript application guarantee from the SVG fallback.

Keyboard focus uses a visible two-pixel outline. Dark sections use blue; header, hero and footer override it to ink on blue, while the ink header CTA uses blue. Preserve those contextual inversions. Footer title/top/links and team heading emphasis have explicit V2 color overrides so inherited V1 colors do not erase contrast.

## Do's and Don'ts

### Do:

- **Do** preserve the original logo geometry and recognisable blue identity.
- **Do** use real TDE photographs and preserve their source mapping.
- **Do** maintain readable ink-on-blue shell text and blue-on-dark headings, including emphasized words.
- **Do** retain native touch/keyboard scrolling, visible keyboard focus, the skip link and motion controls.
- **Do** keep booking inputs, theme tokens and interaction behavior consistent with the existing booking components.

### Don't:

- **Don’t** use pink as a general school-wide accent; reserve it for adult-oriented content.
- **Don’t** replace the selected code-driven line field with a generated raster or copy the reference site’s source or claims.
- **Don’t** turn the public site into the previously rejected white editorial/blog treatment.
- **Don’t** treat this public-shell document as evidence of a complete account or checkout redesign.
