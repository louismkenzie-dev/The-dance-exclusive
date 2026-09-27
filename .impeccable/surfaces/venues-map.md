# Venues map addition

Persuade / wayfinding. Extend the existing /venues page below its hero. Parents and adult dancers locate a venue, inspect its real admin-uploaded photographs, and open its current classes.

## Direction contract
THESIS: Real geographic wayfinding and venue photography share one interactive panel; the map stays fully visible while its selected blue pin follows the photo tour.
OWN-WORLD: Existing TDE blue and ink, ruled edges, condensed section title, Inter controls. Original branding and page structure remain.
STORY: Select a pin or venue name, inspect indoor/outdoor/parking gallery media, then explore the venue and classes. All 15 published venues belong; unpublished records do not.
FIRST VIEWPORT: Beneath the existing hero, a blue heading band tops a large dark geographic map on the left and a photo/detail panel on the right. Mobile stacks map, select and photo panel. Main CTA sits below the selected venue's address.
FORM: Established-world extension, code-led; no new visual-world seed or comp selection required. Auto-advance media every 5.5s; stop on manual selection, hover, focus, hidden tab, offscreen, and reduced motion. Saved admin coordinates win; postcode-only points explicitly say approximate. Keep mobile page scrolling native.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Provenance
Map: OpenStreetMap raster tiles, visible attribution, ordinary viewport requests only. Venue photography: existing public venue_photos admin uploads, then legacy photo fields, then existing admin hero artwork if no photos. No generated or substitute venue photos. Public postcode centroid fallback: postcodes.io; not written to live venue records. Map and media stay usable through the select and venue link if a third-party service fails.

## Finish review
Verdict: SHIP after one correction pass. Resolved clustered mobile hit targets, stable preview height, explicit image loading feedback, and durable DESIGN.md documentation. Desktop 1440px and mobile 390px browser checks covered public venue selection, grouped pins, real gallery media, long venue names, approximate-location notes, and viewport overflow. Reviewer independently checked code and captured renders; did not run a separate browser session. Fifteen targeted tests cover media selection, coordinates, postcode failures, tour behaviour, reduced motion, public data helpers and responsive image configuration.
