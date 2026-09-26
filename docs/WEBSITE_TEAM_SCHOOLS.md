# Team grid and schools refinement — 26 September 2026

Amie requested every coach's photo together in a roughly three-column grid, with enlargement and biographies, and identified the original schools page as a favourite. Her shared brand direction remains blue, modern street dance and fun; pink belongs only to adult content.

## Implemented

- The homepage and `/team` use the same complete live coach grid. All 12 currently published coaches appear. Desktop and tablet widths use three columns, with Amie (Founder) in the centre of the first row. Phones use two columns, with Amie first.
- Mouse hover enlarges the card and portrait and reveals a biography excerpt. Clicking or tapping opens a larger portrait, the complete published biography, dance styles and the existing coach/class link. Missing biographies are identified honestly.
- The dialog supports keyboard opening, Escape, focus containment and return to its trigger. Hover previews can be dismissed with Escape. Reduced-motion preferences retain the existing static presentation. Shared booking dialogs are unchanged; public profile styling is scoped to this dialog.
- `/schools` restores the original classroom banner and school-performance photograph, five service categories and expandable FAQs, using the shared dark/blue typography and image movement. Enquiry links address the live published contact email. Asset provenance is in `WEBSITE_ASSETS.md`.
- The competition page remains unchanged pending clarification of what Amie wanted from the unfinished original. No additional achievements, joining requirements or competition schedule have been invented.

## Verification

- 298 tests pass across 37 files, including biography opening/closing and all-coach coverage. Application TypeScript, changed-file lint and client/server production build pass.
- Browser checks at 1440, 820 and 390 pixels confirm three/three/two columns, 12 visible coach cards, enlarged biographies, correct Founder positioning and no horizontal overflow. These are viewport checks, not a physical iPad test.
- Full biographies remain available inside the phone bottom sheet. Escape restores focus to the original coach button. The built production page also opens the Founder biography successfully.
- Automated WCAG A/AA scans report no violations in the desktop/phone biography dialog and desktop/phone schools page. The schools FAQ expands and both new image assets load. The enquiry target is the published school email.
- No runtime errors were reported in the checked development and production team views. No database, booking or payment mutation occurred.

Deployment evidence will be recorded after the preview is ready. Production remains unchanged.

## Verified preview

Code commit `027209b` deployed successfully as `dpl_CxovmX4Fjb8EeZ6xpSUAmBk9zaSQ` (READY): https://the-dance-exclusive-6qy1o0wrb-nullshift.vercel.app.

The deployed `/team` was opened in the in-app browser: all 12 named coach triggers were present, Amie's enlarged portrait and full published Founder biography opened, and Close returned to the directory. The deployed `/schools` displayed its classroom photograph, service sections, FAQs and published email enquiry links. The new team preview was left open for review. Existing deployment protection was retained, and production was not changed.
