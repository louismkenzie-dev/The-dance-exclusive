---
name: The Dance Exclusive — Public V2 & Customer Journey
description: TDE blue and ink connect authentic dance discovery with clear customer booking tools.
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
  customer-background: "hsl(214 47% 6%)"
  customer-foreground: "hsl(197 69% 95%)"
  customer-card: "hsl(205 45% 12%)"
  customer-primary: "hsl(196 69% 57%)"
  customer-secondary: "hsl(205 35% 18%)"
  customer-muted: "hsl(207 32% 16%)"
  customer-muted-text: "hsl(201 28% 75%)"
  customer-accent: "hsl(203 45% 20%)"
  customer-accent-text: "hsl(196 84% 80%)"
  customer-border: "hsl(202 30% 29%)"
  customer-input: "hsl(201 28% 42%)"
  customer-success: "hsl(151 61% 66%)"
  customer-warning: "hsl(39 95% 70%)"
  customer-danger: "hsl(0 85% 74%)"
  customer-adult-primary: "hsl(332 76% 73%)"
  customer-adult-accent: "hsl(330 30% 19%)"
  customer-adult-accent-text: "hsl(332 90% 87%)"
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
  customer-page:
    fontFamily: '"TDE Condensed", sans-serif'
    fontSize: "48px"
    fontWeight: 400
    lineHeight: 1.12
    letterSpacing: "-.015em"
  customer-page-mobile:
    fontFamily: '"TDE Condensed", sans-serif'
    fontSize: "36px"
    fontWeight: 400
    lineHeight: 1.12
    letterSpacing: "-.015em"
  customer-section:
    fontFamily: "Inter, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-.02em"
  customer-body:
    fontFamily: "Inter, sans-serif"
    fontSize: "15px"
    lineHeight: 1.6
    letterSpacing: "-.01em"
  customer-input-mobile:
    fontFamily: "Inter, sans-serif"
    fontSize: "16px"
rounded:
  customer-control: "6px"
  customer-panel: "8px"
  public-frame: "0"
  town-select: "8px"
spacing:
  customer-page-top: "24px"
  customer-page-top-mobile: "12px"
  payment-field: "14px 16px"
  frame-desktop: "12px"
  frame-mobile: "8px"
  section-desktop: "64px 4%"
  section-mobile: "40px 16px"
  panel-copy: "24px"
components:
  customer-button:
    backgroundColor: "{colors.customer-primary}"
    textColor: "{colors.customer-background}"
    rounded: "{rounded.customer-control}"
    padding: "8px 16px"
  customer-input:
    backgroundColor: "{colors.customer-background}"
    textColor: "{colors.customer-foreground}"
    rounded: "{rounded.customer-control}"
    padding: "8px 12px"
    width: "100%"
  customer-panel:
    backgroundColor: "{colors.customer-card}"
    textColor: "{colors.customer-foreground}"
    rounded: "{rounded.customer-panel}"
  payment-input:
    backgroundColor: "{colors.customer-card}"
    textColor: "{colors.customer-foreground}"
    rounded: "{rounded.customer-control}"
    padding: "14px 16px"
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

# Design System: The Dance Exclusive — Public V2 & Customer Journey

## Overview

**Creative North Star: "The rhythm becomes the image"**

The rhythm becomes the image. TDE blue, near-black grounds, ruled cells and condensed headlines give the public site a direct street-dance character. Real school photography carries the human story below the original moving line field. The original TDE logo remains the identity asset.

This documents the implemented V2 public shell and homepage, together with its extension across customer booking, account, timetable, basket, checkout, confirmation, standalone authentication and recovery. These tools share the blue/ink identity while retaining their functional layouts. Authentication, eligibility, attendee selection, pricing and payment behavior remain governed by the existing components; admin and staff management are outside this visual scope. The selected reference is Antoine Wodniack’s warped hairline field and separated headline composition; the canvas, divider geometry and TDE content are original implementation.

**Key Characteristics:**

- TDE blue and near-black, with pink restricted to adult-oriented content.
- One-pixel rules and square public frames, with gently rounded customer controls and panels.
- Condensed page titles paired with Inter for customer forms, dates, prices and task navigation.
- Authentic TDE media and practical class discovery.
- User-controlled motion with static reduced-motion rendering.

Implementation authority: `src/styles/public-v2.css` and `src/styles/customer-system.css`, loaded after `public-site.css` and `public-brand.css` by `PublicSiteShell.tsx`. `PortalLayout.tsx` selects the customer and focused-checkout shell; `src/lib/checkoutAppearance.ts` maps semantic theme values into Stripe Elements. The homepage direction and reference provenance are recorded in `docs/design/home-v2.md`; durable brand constraints are in `PRODUCT.md`. This is a code-extracted system record, not a claim that every route or accessibility criterion has passed review.

Implementation and visual evidence are separate: actual classes, calendar, authentication and basket routes were captured at desktop and 390px mobile widths. Plan, attendee, booking-summary and confirmation components were visually inspected with synthetic data. Authenticated account/timetable journeys and a complete live Stripe checkout remain unverified in the browser. No payments were submitted and no production release is implied.

## Colors

### Primary

**TDE blue** fills the header, hero and footer, supplies dark-section headings and rules, and colors primary public actions. **Ink** is the foreground on these blue bands and the main dark ground. The lighter V2 blue overrides the earlier public blue within the V2 wrapper.

### Secondary

**Adult panel pink** belongs to the adult audience panel; **adult hover pink** appears on the adult hero action when hovered. The inherited audience switch uses its existing selected blue and adult pink values. These are contextual variants, not replacements for the school identity.

### Neutral

**Body light** carries homepage section copy. **Rule** is the translucent blue used on class, team and timetable borders. White and button ink remain part of inherited public action states. Town-select colors preserve the existing dark form surface, pale text and blue-grey stroke.

Customer tools use the semantic HSL tokens in the frontmatter: background and card/popover establish dark layers; foreground and muted text carry content; input and border separate fields and panels. Primary supplies actions and focus rings. Success, warning and danger remain semantic status colors. Popovers share the card colors, secondary text shares foreground, and primary/status foregrounds use the background color. Strong status variants in the stylesheet support existing emphasis states.

The customer theme is applied to the shell and document body while the shell is mounted, so body-portalled dialogs and drawers inherit the same dark tokens. Theme classes are removed on shell cleanup. Adult class routes and explicitly adult booking sections override primary, accent and ring; general account and checkout tools default to blue.

**The Adult Context Rule.** Pink is reserved for adult-oriented content.

## Typography

**Display font:** locally hosted Anton, registered as “TDE Condensed,” with sans-serif fallback. Its font file is `public/fonts/anton.ttf`; the Google Fonts OFL license is `public/fonts/anton-OFL.txt`.

**Body font:** Inter, shared with booking. **Labels:** the system monospace stack recorded above. The existing “TDE Intro” face remains in legacy or unoverridden public components; V2 does not globally replace every heading.

Condensed capitals deliver the poster scale; Inter keeps descriptions, prices and booking choices readable. Monospace labels separate navigation and rhythm information from promotional copy. Hero, section and panel-title roles use the frontmatter values. The hero becomes two rows on mobile, using 20vw type and 1.1 line height; desktop widths above 1700px use 12.8vw. Homepage section headings become 58px at the mobile breakpoint; panel titles become 43px. Labels are uppercase where implemented; body copy retains normal case.

Customer page titles use the recorded desktop/mobile condensed roles; section headings use Inter at 24px, with subordinate headings at 18px and 16px. Functional copy uses the customer body role. Inputs are 16px on mobile. Dialog headings remain Inter in normal case; monospace promotional labels do not become the form-label system.

**The Task Type Rule.** Use condensed type for customer page titles and Inter for controls, forms, dates, prices and dialog headings.

## Layout

The public shell has a thin dark outer frame. Its header is a ruled grid, 94px high on desktop: logo, locality/style signal, navigation and account/class controls. At 1100px the signal disappears. At 760px the shell frame tightens, the header becomes 76px high, desktop navigation and its class CTA disappear, and the account link plus menu remain.

The homepage hero keeps artwork, rhythm strip, headline and audience actions in separate bands. Artwork height is `clamp(260px, 41svh, 500px)` on desktop and `clamp(210px, 29svh, 310px)` on mobile. The action grid changes from four columns to three at 1100px, then two audience columns beneath the intro at 760px. Homepage wheel scrolling uses Lenis (lerp 0.085), with native touch and keyboard scrolling. It is removed on pause, reduced motion and route exit; dialogs and form controls bypass smoothing.

Below the hero, sections use the frontmatter padding values. Children's and adult photo panels share a ruled boundary and stack on mobile. Their image rows are 330px on desktop and 280px on mobile. The intro portrait changes from 4:5 to square. This composition belongs to the homepage; other routes retain their own functional layouts inside the updated shell.

Customer pages preserve their booking layouts inside the public header, with compact Classes, Timetable and My bookings navigation and a quiet help footer. Checkout uses a focused header and footer. Public quick-navigation tabs are hidden on booking and focused-checkout routes to avoid competing with their bottom actions. Task pages use native scrolling; homepage scroll choreography does not extend into forms, accounts or checkout. Customer mobile adjustments use the 767px breakpoint, independently of the public shell's 760px breakpoint.

## Elevation & Depth

The new hero and ruled public frames are flat. Contrast, one-pixel rules, photographic crops and moving linework provide separation. V2 explicitly removes shadows from audience panels, class photo cards, team photo cards and timetable surfaces. Customer surfaces and elevated cards remove shadows and use semantic panel tones and borders; interactive customer surfaces change border color without lifting. Focus rings remain visible. Inherited components outside these scoped selectors may retain depth; this is not a global shadow reset.

## Shapes

Square public frames connect the header, audience panels, team portraits, location imagery, class cards, class banners and inline booking containers. Most timetable surfaces and switches are also squared. This does not imply every nested control is square: the town selector retains its existing gently rounded corners and class audience badges retain their pill shape. One-pixel rules divide content bands. The original four-point SVG divider is decorative and hidden from assistive technology.

Customer controls use the recorded control radius and customer panels use the panel radius; the square promotional frame remains around them. This distinction preserves the public character while keeping dense forms and schedules legible.

## Components

### Buttons and audience actions

Primary public buttons use blue with dark text, square corners, a 54px minimum height and the recorded padding. Their inherited hover state becomes white with dark text. The header CTA reverses to blue text on ink and inverts on hover. Hero audience actions occupy full ruled cells; their hover state becomes ink with blue text, with pink confined to the adult action. The mobile hero actions have a 58px minimum height.

### Navigation

The desktop header uses uppercase monospace links with underlined hover states. The right-side sheet retains the existing numbered all-pages navigation and closes when the pathname or query changes. It is a separate portal surface and inherits the customer body theme, retaining the dark navigation treatment. The original logo is used in ink on blue and white on the dark sheet; do not redraw its geometry. The shell retains the skip link and labelled navigation landmarks.

### Cards and media

Audience panels separate label, authentic photo and colored copy into distinct rows. Hover underlines the panel title. Team and class cards retain content and data behavior while adopting square public frames. Class photo cards retain their existing border response, slight hover lift and image zoom, disabled under reduced motion.

TDE photographs are mapped by `src/lib/tdePhotos.json`; provenance is documented in `docs/WEBSITE_ASSETS.md`. Existing dance film and Blender media remain separate assets. The line field and four-point star are original code geometry, not generated raster assets. The selected visual reference is [Antoine Wodniack](https://wodniack.dev/), viewed on 27 September 2026; it supplies composition and treatment, not source code, identity or portfolio claims.

### Inputs and audience switches

The public timetable venue select retains its existing booking-theme background, foreground, input stroke and 48px minimum height; V2 changes its radius. The town selector retains its existing dark fill, blue-grey border, 56px minimum height and rounded corners. Audience buttons retain their existing selected blue/adult-pink states, 44px minimum height and `aria-pressed` behavior, with square V2 corners. Customer inputs inherit semantic dark field colors and the control radius. Shared action buttons use Inter, a 44px minimum target, normal case and short state transitions; selected customer options use primary fill with ink text. Authentication, error states, eligibility rules and payment logic remain in their existing components.

### Customer panels, dialogs and payment fields

Customer panels use a card-tone fill, thin semantic border and gently rounded corners without shadows. Body-scoped theme tokens also reach attendee dialogs, basket drawers and other portalled surfaces; dialog headings use Inter. Focus states remain explicit, with the shared input/button focus ring preserved. Reduced motion removes customer pressable/button transitions.

Stripe appearance reads computed semantic values from the themed root and selects its night theme on this dark background. Fields use Inter (16px), labels above the field (13px), the shared control radius, semantic input borders and the recorded payment padding. Focus changes the border to primary and adds a three-pixel translucent primary ring; invalid inputs use danger. Tabs and accordion rows share the control radius and semantic border. This is an appearance adapter, not evidence of payment completion or a new checkout flow.

### Rhythm field and motion controls

The hero film `/media/tde-hero-film.mp4` plays muted beneath the transparent hairline canvas, blue-tinted through a color blend. GSAP sequences a 1.25s aperture reveal and 1.05s masked letter rolls with 25ms stagger. The scroll-linked star, ticker and video scale use 0.7–0.8s scrub smoothing.

`DanceScrollScene` is the reference-inspired focal scroll sequence: a 260svh desktop / 220svh mobile track holds a 100svh sticky viewport. An elliptical aperture opens onto counter-moving DANCE rows and three supplied photos travelling across the frame. A 0.8s scrub reverses with scroll. Its heading uses `clamp(38px, 5vw, 76px)` / 36px mobile, controls 11px / 10px, mobile links 13px. Pause and reduced motion revert to a normal-flow photo grid; scene actions remain stationary. Video pauses offscreen and in hidden tabs.

`RhythmField.tsx` renders decorative canvas linework and an SVG fallback when canvas is unavailable. Animation combines time, non-touch pointer movement and native scroll displacement. It targets 30 frames per second, caps canvas pixel ratio at 2, and suspends animation outside the viewport or in a hidden tab.

The hero's labelled pause/play button controls the homepage motion state. The same state is passed to homepage motion components. Reduced-motion preference forces static rendering and labels the disabled control “Reduced motion.” Decorative canvas, rhythm strip and star are hidden from assistive technology; the real heading and actions remain semantic HTML. Do not infer a no-JavaScript application guarantee from the SVG fallback.

Keyboard focus uses a visible two-pixel outline. Dark sections use blue; header, hero and footer override it to ink on blue, while the ink header CTA uses blue. Preserve those contextual inversions. Footer title/top/links and team heading emphasis have explicit V2 color overrides so inherited V1 colors do not erase contrast.

### Venue map and media tour
The /venues directory pairs a blue heading band with an ink geographic map and a real venue-photo preview beneath its hero. Desktop uses a 1.45:1 split; mobile stacks map, native venue select and preview. Nearby overlapping 44px pin targets group into named venue choices; a native select also reaches every published venue. Individual numbers match the venue select. Page scrolling stays native, with wheel and touch map zoom disabled and explicit zoom controls available.

The 5.5-second tour follows admin gallery order and primary photos, then legacy venue photos, then saved hero artwork only where no photos exist. Media keeps a 4:3 frame and fixed-height detail area while changing. Manual selection pauses the tour; hover, keyboard focus, offscreen state, hidden tabs and reduced motion suspend automatic progression. Images show loading/error states and production delivery uses responsive WebP optimisation. Public records and galleries refresh through the existing public-school query.

Provenance: venue images are existing booking-admin uploads in the public venue-photos bucket, not generated assets. Basemap is OpenStreetMap with visible copyright attribution. Saved admin coordinates take priority; postcodes.io supplies explicitly approximate postcode pins when coordinates are missing. No coordinates or media are written back to live records by the map. No business-home/private address is requested.

## Do's and Don'ts

### Do:

- **Do** preserve the original logo geometry and recognisable blue identity.
- **Do** use real TDE photographs and preserve their source mapping.
- **Do** maintain readable ink-on-blue shell text and blue-on-dark headings, including emphasized words.
- **Do** retain native touch/keyboard scrolling, visible keyboard focus, the skip link and motion controls.
- **Do** reuse the customer semantic tokens across booking, accounts, calendars, dialogs and payment appearance while preserving existing business behavior.
- **Do** keep customer tasks natively scrollable, with mobile field text at 16px and one bottom navigation/action layer at a time.

### Don't:

- **Don’t** use pink as a general school-wide accent; reserve it for adult-oriented content.
- **Don’t** replace the selected code-driven line field with a generated raster or copy the reference site’s source or claims.
- **Don’t** turn the public site into the previously rejected white editorial/blog treatment.
- **Don’t** extend homepage scroll choreography or oversized display typography into customer forms and payment controls.
