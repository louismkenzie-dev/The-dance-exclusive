# Amie's design direction — 26 September 2026

The user supplied Amie's direct feedback: the first impression should be **street dance, current/modern and fun**. Keep the blue identity, use pink only on adult content, and remove the white newspaper/blog feeling. This supersedes the earlier request to distribute blue and pink across the public site.

## This revision

- Restores the visual language of the original booking homepage: dark stage backgrounds, blue lighting, the existing white logo, bold display typography and immediate children's/adult class choices.
- Keeps the school's original Intro Black Alt face, live class data, real school performance film and photography. The opening film, bounded parallax, staggered reveals, moving ticker and image movement remain; hover/press feedback makes the discovery cards responsive.
- Moves class discovery directly below the opening video. The school story follows it. Class rows become individual dark cards instead of a white editorial table.
- Uses blue throughout shared navigation, school headings, the Founder feature and general content. Pink is explicitly scoped to adult buttons, panels, listings and detail pages. Small adult labels use a lighter pink for contrast.
- Rebuilds location discovery around a photographic dance introduction and a responsive venue-card grid. Cards prefer the published exterior photo, then the venue's existing hero artwork. Venue imagery is displayed in blue monochrome to avoid the existing artwork's pink lighting; no source assets or database records are altered. Missing imagery uses a city graphic rather than an invented venue photograph.
- Adds matching photo introductions to class and event discovery. Dance-style shortcuts use the existing URL-backed search filter. Amie remains Founder, centrally above the rest of the team.
- Keeps private booking, staff and admin layouts outside these public styles. No database migration, production deployment or domain change belongs to this revision.

## Verification

- All 296 existing tests pass. TypeScript checked against `tsconfig.app.json`, changed-component lint and the client/server production build pass.
- Browser review at 1440px and 390px confirms dark surfaces, original typography, working media and no horizontal overflow. The location directory contains 15 live venue cards. Amie remains Founder and the live team remains available.
- Automated WCAG A/AA scans pass for the homepage (including all content revealed by Pause motion), locations, team, adult class directory, children class directory, child class details, about, contact, events and information pages. The adult-label contrast issue found during review was corrected.
- Commercial style selection updates the URL and filters the adult timetable to three matching classes. The mobile menu opens and Escape closes it.
- Pause motion stops every video and running animation and reveals all content. A fresh reduced-motion production browser loads zero videos, requests no MP4s and has no running animations or hidden entrances.
- Local production SSR returns HTTP 200 with meaningful initial content on the homepage, locations, adult directory and team. Production browser review reports no runtime errors.

The final deployed preview is recorded below after remote verification.
