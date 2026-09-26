# Homepage critique implementation — 26 September 2026

Implements the five priorities in the Impeccable homepage critique at `.impeccable/critique/2026-09-26T22-44-09Z__src-pages-index-tsx.md`.

1. Audience-aware timetable: children/adult buttons change the four suggested classes, count and labelled directory link together. Shared class rows show the published age/school-year label and venue. Mobile now preserves day/time. Empty and failed data keep audience-appropriate recovery paths.
2. Actual Blender sound studio replaces the mannequin. Real speaker-cone movement, animated level meters, sequential rehearsal floor markings and moving ceiling fixtures are baked into 72 glTF animation clips. Runtime camera and blue lighting develop with scroll. No video/image projection is used. Motion pauses, reduced-motion skips WebGL, and still renders remain as fallbacks. Section reduced from 210 to 165svh desktop and 175 to 150svh phone.
3. Homepage pacing: the repeated film/slogan section and decorative count strip are removed. The real performance film now accompanies a first-session guide, before the studio. Guidance is based on the existing active `/info` page and class/booking behaviour; no new trial, safeguarding or pricing promises were introduced. Hero, real class imagery and full coach grid remain.
4. Town-based discovery includes every published venue, groups towns case-insensitively, and discloses all locations in the chosen town with venue detail links and real class counts. No arbitrary first-seven excerpt.
5. Shared sheet dismissal target is 44×44px, with existing keyboard dismissal/focus restoration preserved.

The footer now has an explicit Find your class link. Original logo, blue-led palette, adult-only pink and Amie's Founder hierarchy remain. No live database, production-domain or checkout changes.

## Verification

- 305 tests across 40 files passed, including audience switching, empty adult results, town grouping, reduced-motion scene initialization, teardown and binary GLB geometry animation.
- Application TypeScript, changed-file ESLint, client/server build passed.
- Impeccable detector found no flags on the homepage target. This is not an accessibility certification.
- Browser: 1280×720 desktop, 390×844 phone, 820×1180 tablet; no horizontal overflow observed. Adults shows 11 published classes with matching link; children's list shows 34. Mobile schedules display days and times. Chelmsford selection exposes all three venues with direct links. Close target measured 44×44px; Escape returns focus to menu trigger.
- Actual WebGL scene loads 72 clips. Scroll advances to 2.173 seconds/progress .539 with visible rehearsal markings; pause retains that time while scrolling. Phone camera widened after visual review. No runtime errors observed in the final local preview; deprecated shadow-map constant replaced with the supported PCFShadowMap.
- No checkout transaction, full screen-reader audit or broad network simulation was performed.

Preview deployment details are recorded after release verification.

## Preview release

Code commit `99b93e1` deployed READY at https://the-dance-exclusive-dv38r818p-nullshift.vercel.app/ (deployment `dpl_73JU99HD6HNb5Wr84ndyhhjJ3h1n`). Deployed browser check confirmed the adult selector changes the list and destination, and scrolling visibly advances the studio camera, light fixtures, meters and floor markings. Preview left open for review. Production remains unchanged.

The source critique snapshot is closed after implementing all five priorities. Desktop/phone camera framing and Blender fallbacks were visually inspected; intermediate tablet layout has no observed horizontal overflow. Temporary local preview servers were stopped and the browser viewport reset.
