# Existing brand and upgrade direction

Audited the live home, children, adult and about pages on 25 September 2026, including rendered desktop screens, computed typography and original media. Sources: [homepage](https://www.thedanceexclusive.co.uk/), [children](https://www.thedanceexclusive.co.uk/kids-dance-classes), [adults](https://www.thedanceexclusive.co.uk/adult-dance-classes), [about](https://www.thedanceexclusive.co.uk/about-us).

## What makes it recognisable

- The white crown wordmark over black and performance footage. The existing repository wordmark has been retained unchanged.
- Intro Black Alt: broad, heavy, uppercase display lettering. The original site's WOFF2 is now local, used for the hero, school motto, film typography and homepage footer. Inter remains the interface face shared with booking.
- Bright cyan, dark stages, blue dancewear and energetic photography. The current Wix blue measures `rgb(3, 182, 230)`; the implementation deliberately retains the booking UI's requested blue `hsl(193 100% 44%)` and pink `hsl(330 90% 55%)` to keep one coherent product palette.
- “Dance. Grow. Achieve.” and a confidence-building mission. The current site's social feed also uses “Step in. Stand out.”, making the existing new hero line consistent with the school's own language.
- Real students, community and approachability. The children and adult pages have useful original photos; their setting and branded clothing carry identity more effectively than generic studio artwork.
- The source site also uses a rough brush divider and entrance effects. The upgrade interprets its energy with photo layering, strong colour blocks and motion, rather than duplicating Wix section layouts.

## Implemented design decisions

The homepage opens with the white logo over the school's film. The original display face, a blue full stop and pink second line create the headline hierarchy. The existing mission anchors the supporting text; the primary action leads directly to the live class finder.

The dark school introduction uses the original three-word motto, a stage photograph and an overlapping candid class photo. Their independent scroll movement is deliberately bounded. The blue ticker repeats the motto. The homepage ends in the familiar blue colour block.

Class browsing retains Inter, warm white surfaces, rounded cards and pill controls from the booking UI. Both children and adult category cards now use genuine school photography. The directory, pricing, availability and booking handoff remain driven by the existing system.

## Motion behaviour

- Staggered headline entrances and supporting hero content.
- One-time section, headline and timetable-row entrances triggered near the viewport.
- Independently moving photographs, a rotating inset, image parallax and the existing scroll-linked film composition.
- A continuous branded ticker, paused alongside video and all other homepage motion by the existing control.
- Small arrow and image responses on hover/focus.

No scroll lock or artificial scroll duration is introduced. Initial server HTML is visible without JavaScript. Reduced motion shows still images without requesting the MP4 files; the reveal enhancer never hides content in that mode. Keyboard focus immediately exposes a pending entrance. Older browsers without scroll timelines retain static photo compositions and native scrolling.

## Launch boundary

This is a preview iteration. Production, the public domain and the deferred coach-profile database migration remain unchanged. See `WEBSITE_LAUNCH.md` for outstanding launch and authenticated checkout verification.
