# Public website media

The existing Dance Exclusive logo assets are unchanged. Amie's 26 September feedback sets the current direction: blue school branding (HSL 193 100% 44%), with pink (HSL 330 90% 55%) reserved for adult content. Dark stage backgrounds, the original Intro Black Alt face, white crown wordmark, live school footage and bold blue graphics carry the public site. Inter remains on controls and task-oriented cards. See `WEBSITE_STREET_DIRECTION.md` for the current brief and `WEBSITE_BRAND_AUDIT.md` for the original source-site analysis.

The following media was retrieved from the school's current public Wix site, `https://www.thedanceexclusive.co.uk/`, on 25 September 2026. These are actual school performance images/footage, not generated images. The clips are silent, H.264, 24 fps, 1024 pixels wide, with fast-start metadata. They load and play near the viewport, pause outside it, and fall back to stills for reduced motion or a video error.

| Local asset | Source |
| --- | --- |
| `public/media/tde-community.jpg` | `https://static.wixstatic.com/media/923365_f7e03fed92534f64aca22c3774c35fb9~mv2.jpg` |
| `public/media/tde-film-poster.jpg` | `https://static.wixstatic.com/media/923365_71e7ec3236b24f55ae5fe77a172f2b21f000.jpg` |
| `public/media/tde-school.jpg` | `https://static.wixstatic.com/media/923365_9fb6a7d3ffca4a90860f6383c7313356~mv2.jpg` |
| `public/media/tde-hero-film.mp4` | First 14 seconds of `https://video.wixstatic.com/video/923365_71e7ec3236b24f55ae5fe77a172f2b21/720p/mp4/file.mp4` |
| `public/media/tde-performance-film.mp4` | Seconds 18–30 of the same film |
| `public/media/tde-children-stage.jpg` | Children page: `https://static.wixstatic.com/media/923365_9655dc08dd9d4111b15129f458684082~mv2.jpg` (Wix delivery sized to 1400 pixels) |
| `public/media/tde-class-confidence.jpg` | Children page: `https://static.wixstatic.com/media/923365_5bad6b9e161442b08e21a75b3d435d48~mv2.png` (Wix JPEG delivery, 900 × 1200) |
| `public/media/tde-adult-community.jpg` | Adult page: `https://static.wixstatic.com/media/923365_0ae3767f575049cebd4c54df697951a9~mv2.jpg` (Wix delivery sized to 1200 pixels) |
| `public/fonts/tde-intro-black-alt.woff2` | Existing website font: `https://static.wixstatic.com/ufonts/22ac3a_d47e2f0ea32c4d47877de7b7ce1f4b14/woff2/file.woff2` |

The homepage children/adult category images now use actual school photographs. The inherited artwork in `public/img/` is retained for any existing consumers. The local font is the same asset served by the current website; this records provenance, not a new font licence. Public coach portraits and venue photographs continue to come from the platform's published records. No testimonials, awards, instructor identities or fixed school statistics have been invented for the new homepage.

## Editorial provenance

The new /about, /schools and /results pages paraphrase the school's existing published information, checked on 25 September 2026:

- https://www.thedanceexclusive.co.uk/about-us — founder/principal and teaching focus.
- https://www.thedanceexclusive.co.uk/schools — PPA cover, clubs, workshops, choreography and teacher development.
- https://www.thedanceexclusive.co.uk/dance-competitions — four published 2024/2025 achievements. No legacy placeholder trophy totals or pass rates were carried forward.

Contact details and social accounts come from the booking system's public email_address, phone_number, social_instagram and social_facebook settings. Parent information links to current booking options and published calendars without copying stale hardcoded prices or inventing school policies. The real party enquiry and shop checkout flows are preserved.

## Schools page refinement — 26 September 2026

Amie identified the existing schools page as a favourite. The revised page keeps its classroom group-photo opening, school-performance imagery, service categories and expandable questions, with the shared blue/dark branding and bounded image movement. Source: https://www.thedanceexclusive.co.uk/schools, checked 26 September 2026.

| Local asset | Original school asset |
| --- | --- |
| `public/media/tde-schools-banner.jpg` | `https://static.wixstatic.com/media/923365_2ed806d71e43437984e2e305261b5fee~mv2.jpeg` |
| `public/media/tde-schools-group.jpg` | `https://static.wixstatic.com/media/923365_0e3c5c4f6da6497ba418b86578e1ba8a~mv2.png` (delivered as JPEG bytes) |

These are unaltered first-party images, not generated replacements. Services and FAQ answers paraphrase the current schools page; enquiries open an email addressed to the published school contact. No form submission or email is sent automatically.

## Blender sound stage — 26 September 2026

`public/models/tde-sound-stage.glb` and `public/media/tde-sound-stage.webp` are original assets created in Blender for the scroll-responsive homepage section. The source project, modelling script and transparent render are retained in `design/blender/`. The still uses the same sculpture and materials as the interactive scene. See `WEBSITE_3D_SCROLL.md` for implementation and verification details.

## Photorealistic studio concept — 26 September 2026

The active scroll section now uses `tde-dance-studio.jpg` and its mobile companion instead of the sound-system sculpture. These are generated concept images of a fictional adult dancer and studio, not actual school footage. Blender projection scenes preserve a bounded scroll camera move. Exact prompts, files, motion limitations and verification are in `WEBSITE_DANCE_STUDIO.md`. The existing logo remains the original separate asset.

## Actual animated Blender studio — latest revision

The user rejected the photographic approximation. The current scroll section uses `public/models/tde-animated-studio.glb`: a fully modelled blue studio with an animated stylised mannequin. Its fallback images (`tde-animated-studio.jpg` and mobile companion) are Blender renders, not generated photography. The source `.blend`, modelling/animation script and verification are documented in `WEBSITE_ANIMATED_STUDIO.md`. Earlier photograph assets are no longer loaded by this section.

## Supplied photo library — 27 September 2026

Source: the user's `Downloads/TDE Assets` folder. Twenty distinct photographs
are now served from `public/media/tde/`, with descriptions, source filenames,
dimensions and focal points in `src/lib/tdePhotos.json`. `IMG_1551.JPG` is an
alternate of the group portrait in `IMG_1550.JPG`; the latter is used to avoid
near-duplicate gallery entries. Originals remain untouched. Delivered WebP
copies have EXIF orientation applied, metadata stripped and a smaller responsive
variant. Combined size is approximately 3.55 MB for all 40 variants; images below
the fold load lazily.

New photos cover the home category panels, first-session inset, location section,
class directory hero, every public class card and class detail banner, the
booking browser and class booking page, event cards/details, about, competition
and gallery pages. Bespoke workshop covers retain priority in booking. Existing
coach portraits, venue photography, schools-page photos and homepage films stay
in use where they accurately describe those specific subjects.

Class photographs are representative school imagery, assigned consistently by
class ID and audience, not evidence of a particular venue, instructor or class.
The gallery displays uncropped photo proportions. No identities or awards are
inferred from the supplied files.

The class directory now uses three-column photo cards (two on tablet, one on
phone), with labelled age, location, day and time icons. Class detail pages use
an image-led banner. Headlines show the lowest payable enabled standard option
with its billing period; trial/session-equivalent rates are excluded for children,
and ended term options are excluded. This changes price presentation only, not
checkout pricing or available plans.

Validation for this pass: 306 tests passed across 40 files; TypeScript and both
production builds passed. Browser review covered the 45-class directory, live
White Court class banner and term price, phone search cards, adult tablet cards
and the 20-photo gallery at 390, 820 and 1280 pixels. Reviewed surfaces had no
horizontal overflow or broken visible photos; browser error log was empty.
Changed public components passed ESLint. The two existing portal files retain
50 pre-existing lint findings, with zero new findings versus HEAD. Impeccable
flagged two existing Inter declarations; these are retained to match the booking
system typography requested by the user.

## Uniform blue coach portraits — 27 September 2026

All 12 published coach photos have separate GPT Image edits with rectangular
4:5 framing and a shared blue studio backdrop. These are AI-edited versions of
the real source portraits; original uploads remain unchanged. Prompt set,
provenance and delivery details: [coach portraits](design/coach-portraits/prompts.md).
The public website uses the edits only while each coach's original source path
matches the manifest, so a later staff photo change is not hidden by an override.


## Mobile homepage and HD hero — 27 September 2026

The homepage no longer mounts the “Turn it up” Blender studio. Its source and
assets remain in the repository, but the homepage does not load its WebGL code
or model.

A higher-quality rendition of the original school film was available at:
`https://video.wixstatic.com/video/923365_71e7ec3236b24f55ae5fe77a172f2b21/1080p/mp4/file.mp4`
The source is 1920 × 1080, native 30 fps, 35.87 seconds. The hero keeps the same
first 14-second excerpt. New delivery assets:

- `tde-hero-film-hd.mp4`: 1920 × 1080, 30 fps, approximately 7 MB.
- `tde-hero-film-mobile.mp4`: 1280 × 720, 30 fps, approximately 3.5 MB; selected
  once on mount for viewports at or below 760px, avoiding two video downloads.
- `tde-hero-poster-hd.jpg`: frame at 3 seconds from the 1080p source.

Both films use H.264/yuv420p, CRF 23, slow preset, 60-frame keyframe interval,
no audio and fast-start metadata. Desktop maxrate/bufsize: 4M/8M; mobile: 2M/4M.
The mobile encode also uses `scale=1280:720`. No frame interpolation or AI
upscaling. For a further quality increase, use the original camera/export
master instead of another social-media or website-compressed copy.

Phones and coarse-pointer tablets use native scrolling, a static hero line
field and no image parallax. The mobile star scene follows scroll directly;
pause freezes it without changing document height. Its height is reserved in
SSR/CSS, with an ordinary photo layout for reduced motion. Films pause offscreen
and retain their source when scrolling back. Autoplay remains muted and inline;
reduced motion and playback errors retain a still image.

Mobile navigation has four persistent destinations and safe-area clearance.
The homepage presents four coaches, including Amie first, and links to the full
team grid. First-session details and location browsing remain on their dedicated
pages. The class directory opens with compact imagery and its existing filters.
Inputs remain at least 16px through tablet sizes to prevent iOS focus zoom;
pinch zoom is retained.

## Booking artwork on public listings — 27 September 2026

Public class and camp reads now include the related workshop's `cover_image`,
`cover_position`, `cover_zoom` and `cover_fit`, using the existing public read
permissions. `ClassMedia` applies these through the same `WorkshopCover`
renderer used in booking. Homepage event cards, event listings/details, class
listings and class detail banners all prefer this attached artwork. Storage
paths resolve in `workshop-media`; legacy full URLs are retained. General school
photographs are used only if the attachment is missing or fails to load.

Verified anonymously: NEXUS and IGNITE use their attached logos with `contain`;
MOVE.HER uses its workshop photograph; White Court classes use their attached
covers with saved crop/zoom. Halloween and the Christmas party currently have
no cover attached and retain their photo fallbacks. No database or storage
permissions were changed.

### Responsive booking covers — 27 September 2026

Public class/workshop cards and banners now serve supported booking-cover uploads through Vercel image optimisation (WebP, quality 80, 480–1920px responsive widths). The original attachment and admin framing remain authoritative. Only this project's public `workshop-media` bucket is allowlisted; private/signed and external URLs are not proxied. New attachment URLs work without a rebuild. Local development uses originals; optimisation errors retry the original, then the existing school-photo fallback.

The first three class covers load eagerly; subsequent covers stay lazy. Images reveal after load/decode rather than painting JPEG scan lines, including cached images during hydration. Existing card geometry reserves the image area.

Verification: 13 focused tests, TypeScript, lint and client/SSR build passed. Preview desktop and 390px mobile checked with actual attached covers. White Court Street Dance original: 6,528,747 bytes / 5000×3333; the observed 480px mobile WebP: 13,604 bytes (99.79% smaller). Higher-density screens select larger candidates. These are measured asset sizes, not a claim of equivalent page-load-time reduction or physical-device benchmarking.
