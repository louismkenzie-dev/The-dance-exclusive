# Coach profiles and founder presentation

26 September 2026. The user requested working coach profiles and Amie as the lead profile, then clarified her title is **Founder**, not Co-Founder.

## Verified cause

Before the fix, 12 active staff profiles existed but the anonymous `staff_public` query returned zero rows without an error. The invoker view read `staff`, whose policies allow admins and each staff member to access private records. The deferred public projection had not been created. The cause was publication permissions, not missing biographies or a failed front-end request.

## Applied change

- Applied migration `20260926152554_publish_safe_coach_profiles.sql` creates an explicit public-field projection and points the invoker view to it. It preserves private staff permissions, grants public read only, and follows authorised staff edits, deactivation/reactivation and deletion. The migration has bounded lock/statement timeouts. The local filename was aligned with the version recorded by Supabase when it was applied.
- No private staff fields or service-role key enter the front end. Profile data remains live; there is no deployed snapshot or fallback that could resurrect an unpublished coach.
- Amie's existing record is identified by its stable ID for editorial presentation only. Her public title is Founder; her internal staff role and permissions are untouched. The founder is sorted first and placed in a larger centred feature before the remaining coaches on both the homepage and team directory.
- Profile headings, image descriptions and structured data use readable public roles. Circular source portraits are displayed without tall rectangular cropping.

## Verification before publication

The migration passes isolated PGlite checks for the field allowlist, private staff visibility, denied public writes/function invocation, authorised edits, deactivation/reactivation and deletion. TypeScript, changed-file lint, the client/server build and 296 tests pass.

Before approval, local visual verification used a temporary six-field snapshot read from the 12 active records, substituted only by a loopback-only review server. The snapshot and server lived outside the repository and were never deployed; both were removed after the live checks. This was explicitly a layout check, not evidence of live public availability.

The team directory shows Amie followed by 11 other coaches. At 1440px her portrait centre is exactly 720px. Mobile 390px has no overflow. Amie's profile link opens her complete biography with the Founder title. Initial server HTML includes all 12 profiles and no additional private fields. The desktop team accessibility scan reports zero WCAG A/AA violations; browser runtime errors are empty.

## Approved publication and live verification

The user explicitly chose “Publish coach profiles now” on 26 September 2026, superseding the previous launch-only instruction. The migration was applied successfully to `suwaetnsszlpaaykhpif` as version `20260926152554`.

- The real anonymous API now returns 12 profiles with exactly the seven allowlisted view columns. The browser loader continues to select only six display fields.
- Anonymous reads of the private staff table return zero rows; private fields cannot be selected from the public view. Anonymous insert/update/delete and authenticated update on the projection are denied. Neither client role can execute the private trigger function.
- Both tables retain RLS, the view retains `security_invoker=true`, and all three private staff policies are unchanged. Security-advisor findings are unchanged from the pre-migration baseline; no new coach-related findings were introduced.
- The temporary review server was stopped. Subsequent checks use the real anonymous API with no fixture or network substitution.

## Verified preview

Deployment `dpl_83K4SAESoFZfiVmQjzKD3CASjzoa`, code commit `886975b`, is READY at https://the-dance-exclusive-4f84sx5hu-nullshift.vercel.app. Verified through authenticated preview access with deployment protection retained.

- `/team` returns HTTP 200 and all 12 profiles in its initial HTML. The hydrated desktop directory shows Amie first and 11 other coaches; her portrait centre is exactly 720px at a 1440px viewport.
- At 390px, the directory and Amie's full profile load the real portrait and biography without horizontal overflow or runtime errors. Her link opens the correct record; page metadata and Person structured data both say Founder.
- The deployed homepage shows one Founder feature above four other coaches, loads the real photo and has no mobile overflow or runtime errors. Its automated WCAG A/AA scan reports zero violations. Local desktop homepage and team scans also report zero violations after correcting the team section label contrast.
- The real-data local production build follows Amie's class link through White Court Street Dance to the existing booking page. Amie's biography appears in the instructor section, the £91 term price and 10 sessions match the public page, and sign-up retains the selected class. No account, booking or payment was created. Authenticated checkout remains a separate launch check.
- The live-data sitemap contains all 12 coach profile URLs, including Amie.

The website remains a Vercel preview; no production site deployment or domain change is included.
