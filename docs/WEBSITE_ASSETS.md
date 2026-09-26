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
