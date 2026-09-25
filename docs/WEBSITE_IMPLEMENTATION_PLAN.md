# The Dance Exclusive website implementation plan

Status: public website implemented and verified on a Vercel preview, ready for design review. Production and the live coach migration remain unchanged.

Source: `The-Dance-Exclusive-Website-Proposal-2.pdf`, supplied by the user, all six pages reviewed. Code baseline inspected: `99614da`, 25 September 2026. Existing behaviour below is established from source inspection, not a live end-to-end verification.

## Intended outcome

Create a premium public website with the polish requested by the user, keeping The Dance Exclusive's existing logo and booking platform. The user has explicitly allowed the wider design to evolve, while subsequently confirming that the original blue and pink colours must remain. The front page introduces the school and leads into public class, venue, coach, camp and workshop content. The same underlying records supply both the website and booking journey.

The proposal covers the whole public experience, beyond the front page. Its operational promise is that changing a published record in the existing admin screens updates the corresponding public content without editing a second website. The eventual public domain is `thedanceexclusive.co.uk`, hosted alongside the existing booking application.

The proposal's counts of classes, venues, coaches, sessions and camps are a September snapshot. Public pages and statistics must use the current eligible data; those counts are not fixed content or acceptance quotas. Historic achievements and other editorial claims need a verified source or an existing admin-managed setting.

## Scope and existing foundations

| Requirement | Evidence in the current application | Work to deliver and verify |
| --- | --- | --- |
| Premium front page and consistent brand | `src/pages/Index.tsx`, `src/index.css` and the shared portal layout already provide a homepage, logo assets, Oswald/Inter typography, cyan and magenta accents. | Agree the visual direction with the user, then implement the composition, responsive navigation, imagery, motion and clear booking entry points. Carry the design through the public pages and booking handoff. |
| One public page per class | `src/pages/portal/BookClass.tsx` already loads an individual class at `/book/:classId`, its scheduled sessions, instructor and enrolment count. `ClassBrowser.tsx` lists children and adult classes. | Build on the existing detail and booking flow; give each eligible class an indexable page with its day, time, age range, venue, coach, price and availability. Preserve existing shared class links. |
| A local page per venue | `src/pages/marketing/Venues.tsx` reads publicly visible venues, addresses, descriptions, images, facilities and slugs. The router currently has a venue directory at `/venues`. | Add individual venue pages with their address, relevant visitor information, current classes and timetable, plus links into booking. Make every eligible venue discoverable from the directory. |
| Coach profiles connected to their classes | `src/pages/marketing/Team.tsx` reads `staff_public` for first names, photos, descriptions, dance skills and roles. Classes reference an instructor. | Add individual public profiles and their current teaching schedules. Use the existing restricted public projection; private staff information stays outside public responses. |
| Camps and workshops appear and expire automatically | `ClassBrowser.tsx` already fetches active camps whose end date has not passed, and class/camp queries join workshop presentation data. Camps have shareable links into a booking dialog. | Map the existing workshop/class/camp relationships before creating templates. Publish current event content with dates, venue, audience and booking actions; remove finished events from current listings automatically and define sensible behaviour for old links. |
| Public pricing agrees with checkout | `src/lib/classPresentation.ts` and `src/lib/pricing.ts` already provide shared class and camp display helpers. Checkout has existing plan and eligibility rules. | Reuse the pricing sources and verify the displayed offer against the same selected booking, including audience, plan, session count and any applicable eligibility or discounts. Explain units and conditions clearly. |
| A continuous booking journey | `src/App.tsx` already places public content, class browsing, class booking, account pages and checkout within the application. `src/lib/classLinks.ts` supplies shared links. | Keep the chosen class or event and booking context through sign-in, selection, cart and checkout. Maintain functioning parent, staff and admin areas. |
| Current information maintained through existing admin screens | Existing queries use classes, sessions, venues, `staff_public`, camps and settings; public classes already filter active, visible and confirmed records. | Centralise publication and expiry rules for public templates, listings and sitemap generation. Define refresh and cache invalidation so admin edits reach the browser and crawlable HTML without a separate content edit. |
| Search, local discovery and machine-readable content | `index.html` contains one shared title, description, canonical and school description. `public/sitemap.xml` currently lists four URLs, including sign-in. `public/llms.txt` describes the main entry pages. | Provide distinct titles, descriptions, canonical URLs, relevant structured data and meaningful HTML for individual public records. Generate a sitemap from eligible records, update crawler-facing information, and exclude account/admin/auth utility routes from search indexing as appropriate. |
| Speed, accessibility and content quality | The current frontend is a Vite/React application with client-side routing and shared image/motion components. | Verify desktop and mobile layouts, keyboard navigation, focus, contrast, reduced motion, image loading, performance and real content. Replace unsupported placeholder claims with verified content. |
| Consolidated hosting and domain move | `vercel.json` currently rewrites application routes to `index.html`; the app's canonical URL currently uses `app.thedanceexclusive.co.uk`. | Prepare deployment, canonical-domain settings, redirects and a rollback plan for the public domain while retaining existing booking links and authentication/payment return paths. Hosting must fit the existing arrangement described in the proposal. |

## Creative direction supplied by the user

References: `CROWNE Shopify Landing Page.webp` and `Supplement Website Landing Page.webp`, supplied from the user's Downloads folder and visually inspected.

The user wants an immersive, premium, sharp and modern club feel, with scroll parallax, moving elements, plentiful imagery and video. The existing logo and original blue/pink palette must remain. The public site must also feel like the existing booking UI: use its Inter typography, rounded surfaces, pill controls and familiar navigation while preserving immersive photography, video and scroll motion.

The references inform oversized typography, large photographic compositions, image/text layering, fine grid rules, contrast between dark and light sections, and smaller editorial image arrangements. Motion should create depth while preserving readable content, ordinary scrolling, keyboard access and a reduced-motion experience.

## Implementation delivered

- Original logo retained. Original blue and pink accents, booking-style warm backgrounds, Inter headings, rounded cards and pill controls, with oversized display lettering reserved for motion graphics, real school photography and silent performance footage, bounded parallax, moving type and responsive public navigation.
- Live class directory with audience, day, venue and text filters. Individual class, venue, coach and event templates share one explicitly limited public data loader.
- Class prices reuse booking presentation helpers. Enrolment counts use the existing aggregate RPC; unavailable counts never imply that spaces exist.
- Class and event expiry uses the school's Europe/London date. Current published records determine public routes and the sitemap.
- Request-local server rendering provides meaningful initial HTML, distinct metadata, canonical links and structured data. Account, checkout, staff and admin routes retain the existing client application and private cache policy.
- Public HTML is revalidated at the CDN after 60 seconds. Open pages refresh their public data every 60 seconds. Booking remains the final authority for price and capacity.
- Supporting school, schools-service, contact, gallery, competition and information pages use verified editorial material. Contact email, phone and social links come from four explicit public settings. The non-sending legacy contact form is no longer routed.
- Eight permanent redirects preserve the principal Wix page URLs. The separate schools-service page remains at /schools.
- Motion can be paused. Reduced-motion visitors receive still images without automatically downloading the homepage videos. Videos load near the viewport and pause off screen; document scrolling remains native.

## Coach publication: staged for launch

The anonymous staff_public view currently returns no coaches because its security-invoker query inherits private staff RLS. Twelve active records exist, but no private staff fields have been fetched into the website.

The migration at supabase/migrations/20260925154614_publish_safe_coach_profiles.sql creates a separate seven-column public projection, synchronised by a protected trigger, and keeps private staff permissions unchanged. It was tested with an isolated local PostgreSQL-compatible PGlite instance for publication, updates, deactivation, deletion and denied public writes. It has NOT been applied to the live project. The user explicitly requested: "Keep it ready for launch."

## Delivery sequence

The proposal describes four phases over approximately one month. Dates should be set around the user's actual start and review availability.

1. **Direction and structure:** agree the design brief; inventory assets and content; define the homepage composition, public navigation, page templates, URL structure and data contracts.
2. **Live pages:** implement the homepage and public class, venue, coach, camp and workshop experiences, sharing the platform's data and booking rules. Add rendering and refresh support needed for discoverability.
3. **Content and verification:** place approved photography, refine copy, complete page metadata and structured content, and verify accessibility, speed, responsive behaviour and booking continuity. Provide a reviewable preview.
4. **Review and launch:** incorporate feedback, prepare the domain transition and redirects, verify production readiness, and carry out launch when instructed. Wix retirement follows successful cutover and the user's direction; the proposal itself is not an instruction to cancel a subscription or alter DNS now.

## Completion evidence required

- The reviewed front page and supporting templates match the agreed direction on desktop and mobile, including loading, empty and error states.
- Every currently eligible class, venue and coach is reachable through public navigation and has its own appropriate indexable page. Published camps and workshops have complete, current public coverage.
- Initial HTML, canonical URLs, page metadata, structured content and sitemap entries reflect the correct individual record and public domain. Unknown and withdrawn URLs have deliberate status and indexing behaviour.
- Controlled non-production checks prove that publishing, editing, hiding and expiring records updates the public pages, listings and crawler-facing output within the agreed refresh window. Test time boundaries in the school's local timezone.
- Prices, plan descriptions and availability match the corresponding booking journey. Full, invitation-only, unpublished, expired and unavailable records never offer an invalid booking action.
- A parent and an adult dancer can each go from a relevant public page through sign-in and booking to a verified checkout outcome in a test environment, retaining the selected item.
- Public coach information comes only from approved public fields. Existing customer, staff and admin access continues to work.
- Relevant existing tests, type/build checks and actual browser checks pass. Check changed behaviour with meaningful tests; a successful build alone does not prove the visual or booking experience.
- Content, photographs, testimonials, awards and school statistics have verified sources or explicit editorial ownership.
- The final rollout is verified at its real URLs, including redirects, booking deep links and authentication/payment return routes. Document rollback and handover steps for the existing admin workflow.

## Verification and remaining launch work

- GitHub plugin access and authenticated GitHub CLI access were confirmed. Supabase plugin access was restored and used for read-only inspection.
- The Vercel plugin returns 403 for the project. The authenticated Vercel CLI successfully deployed preview commit a487ad8 to the existing Nullshift project. The preview is READY at https://the-dance-exclusive-esxl2lplj-nullshift.vercel.app. No production deployment was made.
- Final local checks: TypeScript, changed-component lint and client/server production builds passed; 35 test files and 294 tests passed. All eight legacy redirects returned the expected 308 destinations. The initial HTML included the correct content and metadata for each new editorial page; the sitemap contained 80 current URLs before coach publication.
- Local production browser checks confirmed both child and adult class-page to booking to sign-up handoffs retain the selected class. The child flow was also verified on the real Vercel preview. The public and booking prices matched. Desktop homepage and mobile contact-page axe checks reported no WCAG A/AA violations; keyboard navigation, reduced motion and mobile overflow were checked. The contact page exposes real mail and phone links and has no false-success form.
- Authenticated parent/adult checkout and payment completion have NOT been verified. No accounts, customer records, bookings, payments, emails or production data have been created as tests.
- Production deployment, domain cutover, coach migration, Wix retirement and final editorial approval are pending. See WEBSITE_LAUNCH.md for the launch sequence and rollback details.

## Deployed preview evidence — 25 September 2026

Preview deployment: dpl_2YW4viBdfqPJrM85wBCFoTg58EVL, code commit a487ad8. Verified through Vercel's authenticated preview access; protection remains enabled.

- Desktop 1440px and mobile 390px: original logo, homepage layout, video playback, responsive typography and no horizontal overflow. No browser runtime errors observed.
- Mobile homepage axe scan: zero violations for WCAG 2 A/AA, 2.1 AA and 2.2 AA tags. This automated result is not a claim of a complete accessibility audit.
- Hero video pauses off screen; native scrolling reaches the document end. A fresh reduced-motion browser received no video elements and made no MP4 requests.
- Real HTTP checks passed for homepage, class, venue, event, schools and contact pages, current sitemap, scripts, stylesheet, image and video. Entity pages contain their record-specific content and metadata in initial HTML.
- Unknown venue returned 404/noindex. Sign-in and booking HTML returned private/no-store. Preview responses have X-Robots-Tag noindex. The adult Wix redirect preserved its incoming tracking query and selected the adult directory.
- Child booking offered the same £91 term price and ten sessions as its public detail page. Its sign-up URL retained the selected class. No user account or booking was created.

Outstanding: design/editorial review, staging publication-edit tests, authenticated checkout/payment outcomes, the launch-only coach migration and the authorised production/domain transition.
