# Coach profiles and founder presentation

26 September 2026. The user requested working coach profiles and Amie as the lead profile, then clarified her title is **Founder**, not Co-Founder.

## Verified cause

There are 12 active staff profiles. The anonymous `staff_public` query returns zero rows without an error. The live view uses `security_invoker=true` and reads `staff`, whose policies allow admins and each staff member to access private records. The previously prepared `published_coach_profiles` table does not yet exist. This is the deferred publication migration, not missing biographies or a failed front-end request.

## Prepared change

- `20260925154614_publish_safe_coach_profiles.sql` creates an explicit public-field projection and points the invoker view to it. It preserves private staff permissions, grants public read only, and follows authorised staff edits, deactivation/reactivation and deletion. The migration now has bounded lock/statement timeouts.
- No private staff fields or service-role key enter the front end. Profile data remains live; there is no deployed snapshot or fallback that could resurrect an unpublished coach.
- Amie's existing record is identified by its stable ID for editorial presentation only. Her public title is Founder; her internal staff role and permissions are untouched. The founder is sorted first and placed in a larger centred feature before the remaining coaches on both the homepage and team directory.
- Profile headings, image descriptions and structured data use readable public roles. Circular source portraits are displayed without tall rectangular cropping.

## Verification before publication

The migration passes isolated PGlite checks for the field allowlist, private staff visibility, denied public writes/function invocation, authorised edits, deactivation/reactivation and deletion. TypeScript, changed-file lint, the client/server build and 296 tests pass.

Local visual verification uses a temporary six-field snapshot read from the 12 active records, substituted only by a loopback-only review server. The snapshot and server live outside the repository and are not part of the deployment. This is explicitly a layout check, not evidence of live public availability.

The team directory shows Amie followed by 11 other coaches. At 1440px her portrait centre is exactly 720px. Mobile 390px has no overflow. Amie's profile link opens her complete biography with the Founder title. Initial server HTML includes all 12 profiles and no additional private fields. The desktop team accessibility scan reports zero WCAG A/AA violations; browser runtime errors are empty.

## Approval boundary

The user previously said to keep the database fix ready for launch. The change is prepared and a fresh request to publish these profiles now is pending. Until that is answered, no live database migration is authorised by this work. The website remains a Vercel preview; no production site deployment or domain change is included.
