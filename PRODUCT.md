<!-- impeccable:product-schema: 1 -->
# The Dance Exclusive

## Platform
web

## Purpose
A dance school website for parents choosing children's classes and adults choosing their own dance sessions. The main action is finding a suitable class and booking a place.

## Product truth
Live classes, prices, venues and active coaches come from the existing booking system. The public class page includes authentication and booking choices; shared booking, attendee, eligibility and payment rules stay intact. Amie is the Founder.

## Audience and context
Parents compare venue, age or school year, timetable and price on phones and tablets. Adult dancers explore street and commercial classes. Both need clear class details and a consistent path into booking.

## Brand commitments
Keep the original logo and recognisable blue branding. Pink belongs only to adult-oriented areas. Use real TDE photography and video wherever useful. First impression: street dance, modern, fun. Avoid the white editorial/blog appearance previously rejected by Amie.

## Current design direction
The user selected Antoine Wodniack's ruled grid and warped hairline field as the V2 reference. Apply that composition and motion in TDE blue and near-black, with real dance content. Preserve V1 as a recoverable version.

## Stack
Existing React, TypeScript and Vite app; shared booking components; Supabase data/auth and Vercel preview deployment. No replacement backend.

## Unified customer experience
The public front end and booking tools form one customer application, with the same account, basket, class records and design system. Customer navigation depends on sign-in state rather than which section is open. Shared class links, authentication and checkout preserve the visitor's intended task; booking actions do not hand off to a separately styled application.

Preview demonstrates the combined application on one origin. The existing app.thedanceexclusive.co.uk deployment remains production and must not be changed without explicit release approval. Before launch, settle a canonical customer origin and preserve existing app links, OAuth/email returns and payment returns. Supabase currently persists the browser session in origin-local storage: serving the same code on two hostnames does not itself create shared sign-in. Do not promise cross-domain session continuity until its launch routing/authentication behavior is implemented and verified.
