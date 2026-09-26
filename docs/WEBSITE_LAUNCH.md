# Public website launch notes

The current work is on `codex/dance-exclusive-public-site`. The production website has not been deployed. On 26 September 2026 the user explicitly approved publishing coach profiles now, superseding the previous launch-only instruction. Migration `20260926152554_publish_safe_coach_profiles.sql` is applied to Supabase; private staff permissions are unchanged.

## Review before launch

1. Review the front page on desktop and mobile, including motion, image crops and copy. Confirm the retained logo and school footage are approved for the new presentation.
2. Confirm the four historical achievements with the school. Review contact settings and public venue/class descriptions through the existing admin screens.
3. Verify a parent and an adult booking in a non-production environment through sign-in, attendee selection, cart, payment and return. Check terms, trial and payment-plan eligibility, full classes, invite-only classes, cancellation and expired event links. The local checks so far stop at the unauthenticated sign-up handoff; no payment completion is claimed.
4. In a staging Supabase project, replay the coach migration and verify an authorised staff edit through the admin UI updates the public profile. Confirm inactive coaches disappear and private staff fields remain inaccessible. Database-level edit/deactivation/deletion behaviour has already passed isolated tests; live anonymous read and access-control checks also passed.
5. Check content update visibility in both an open browser and initial HTML. Public browser refresh is 60 seconds; the CDN cache lifetime is 60 seconds. Public availability is advisory and the booking flow validates the final selection.

## Authorised launch sequence

1. Record the current production deployment, domain configuration, Supabase migration history and a recoverable database backup. Identify the existing app domain and retain booking, auth and payment callback URLs during the transition.
2. Verify migration `20260926152554_publish_safe_coach_profiles.sql` remains recorded as applied; do not apply it again. It backfills safe active coach records, protects public writes and maintains synchronisation through staff edits. It preserves existing private staff RLS.
3. Deploy the reviewed commit to the existing Vercel project and verify the deployment URL before changing the public domain. Do not point both old and new applications at competing canonical domains.
4. Attach the approved public domain and verify DNS and TLS. This build uses `https://www.thedanceexclusive.co.uk` as its canonical origin; keep or redirect the apex consistently. Preserve the existing booking app hostname and callback paths as required by the live Supabase/Stripe configuration.
5. Verify the homepage, a class, a venue, a coach, an event, initial HTML, sitemap, media, unknown-page 404 and private-route noindex/no-store responses. Check all eight Wix redirects in `vercel.json`, including incoming query parameters. Confirm the distinct `/schools` page remains reachable.
6. Inventory any additional indexed Wix URLs from Search Console and the final Wix sitemap; add specific redirects before retiring Wix. The eight prepared mappings reflect the current site's principal navigation and are not a claim of exhaustive historic coverage.
7. Test existing shared `/book/:id` and camp links, sign-in/password reset, payment return URLs, customer accounts and staff/admin access at the real domains.
8. Only after successful cutover and the user's instruction, retire Wix hosting. Retain its content and DNS records until the rollback window has closed.

## Rollback

- Restore the previous Vercel production deployment or public DNS target if the site or booking journey fails. Do not delete either deployment or the old Wix site during cutover.
- The additive coach projection does not require rolling back private staff data. If coach publication needs to be stopped, remove public access to the projection under a reviewed database change; avoid rolling back unrelated migrations or deleting staff records.
- Retest existing booking, sign-in and payment return links after any rollback. Record what was changed and which deployment/domain is serving traffic.

## Content maintenance

Classes, sessions, venues, coaches and events continue to be managed in the existing booking admin. Publish/hide and expiry rules apply to directories, detail pages and the sitemap together. Staff-public fields are first name, photo, description, dance skills and role, plus record ID and creation order; nothing else belongs in the public projection.

Contact settings are read using an explicit four-key allowlist. Editorial page copy lives in `src/pages/marketing/PublicEditorialPages.tsx`; approved media and provenance are documented in `WEBSITE_ASSETS.md`. No second CMS is required.
