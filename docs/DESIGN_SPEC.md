# The Dance Exclusive — "Studio Light" design system (Bevel-grade redesign)

This is the single source of truth for the 2026 UI redesign. Every screen must follow it.
Reference: the Bevel health app (calm, expensive, soft) blended with TDE's club-light brand.
North star: "designed by Apple". Premium through restraint, warmth through motion.

## 1. Core principles

1. **Calm surfaces, loud moments.** 95% of every screen is neutral (paper background, white/ink
   cards). Colour appears only in: primary CTAs, live data, status words, and ambient washes.
2. **Two worlds, one system.** Children/parents/marketing = LIGHT ("Studio Light"). Adult side =
   DARK ("Studio Night", navy-black + magenta). Same components, flipped tokens. Route-scoped
   themes stay (`.theme-children` light, `.theme-adult` dark) — applied by PortalLayout.
3. **Sentence case everywhere.** Headlines are sentence case ("Move different.", "My bookings").
   Uppercase survives ONLY as tiny eyebrow labels via the `.eyebrow` utility. NEVER use
   `uppercase tracking-wider` on headings, buttons or body copy. Remove every inline
   `style={{textTransform:'none'...}}` override you find — they are obsolete.
4. **Everything rounded, nothing boxed.** Cards `rounded-3xl`, controls `rounded-2xl`,
   buttons/badges pill (`rounded-full`). No visible hard borders on cards — depth comes from
   layered soft shadows (`shadow-soft*`). Hairline borders (`border-border/60`) only on dark
   theme where shadows read poorly.
5. **Motion is the luxury.** Springy, physical, restrained. Use the motion kit (section 6).
   All motion respects `prefers-reduced-motion` automatically via the kit.

## 2. Colour tokens (defined in src/index.css — DO NOT hardcode hsl() inline)

Palette is unchanged: navy ink, logo blue `hsl(201 70% 50%)` (light) / `hsl(201 70% 65%)` (dark),
hot magenta `hsl(330 90% 55%)`. Use ONLY semantic tokens:

- `bg-background` paper (light: warm off-white 220 25% 97%; dark: navy-black 220 20% 5%)
- `bg-card` white / dark: 220 18% 9% — always with `shadow-soft` + `rounded-3xl`
- `text-foreground` ink navy / soft white; `text-muted-foreground` for secondary
- `bg-primary text-primary-foreground` blue CTA; `bg-accent` magenta (adult/energy accents)
- `bg-secondary` quiet grey fill (pills, segmented controls)
- `success`, `warning`, `destructive` exist as tokens — use for status text/badges
- Tint recipes: `bg-primary/8 text-primary` for icon tiles; NEVER tinted card borders.
- Sweep ALL inline `hsl(201...)`/`hsl(330...)`/`hsl(142...)` styles → tokens
  (`text-primary`, `text-accent`, `text-success` etc.).

Ambient washes (replaces stage-light/grain — GrainOverlay and `.stage-light-*` are DELETED):
- `.aurora` (children/marketing hero areas): huge soft radial washes, blue + warm cream
- `.aurora-night` (adult/dark heroes): deep blue + magenta glows on navy
- Apply on section wrappers behind content; subtle (≤10% opacity). Component:
  `<AmbientGlow variant="light|night|duo" />` from `@/components/motion`.

## 3. Typography

Fonts (loaded in src/index.css): display `Plus Jakarta Sans` (500–800), body `Inter`,
accent `Instrument Serif` italic (marketing heroes only).

- `font-display` = Plus Jakarta Sans. Headings h1–h6 use it automatically (no uppercase).
- Marketing hero: `text-5xl md:text-7xl font-display font-extrabold tracking-tight` with ONE
  italic serif word: `<em className="font-serif italic font-normal text-primary">different</em>`
- Page title pattern (Bevel): big bold title + muted subtitle directly under it:
  `<h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight">My bookings</h1>`
  `<p className="text-muted-foreground mt-1">Everything you've booked, in one place</p>`
- `.eyebrow` utility = the ONLY uppercase: `text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground`
- Section header (Bevel): bold left title + muted right action link.
- Numbers/data: `font-display font-bold tabular-nums`.

## 4. Component recipes (shadcn primitives already restyled — use them as-is)

- **Button**: pill by default. `default`=blue, `secondary`=quiet grey, `outline`=hairline,
  `ghost`, `destructive`. Sizes unchanged (`sm`/`default`/`lg`/`icon`). Do not add custom
  radius/uppercase classes at call sites. Icon-only round buttons: `size="icon"` (round).
- **Card**: `<Card>` is `rounded-3xl bg-card shadow-soft border-0` (dark: hairline border).
  List-row card (Bevel journal row): Card + `flex items-center gap-3 p-4` + leading icon tile +
  `font-semibold` label + muted meta + trailing control/chevron.
- **Icon tile** (Bevel): `flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/8 text-primary`
  (swap primary→accent/success/warning per context). Use for every list-row/stat icon.
- **Stat card**: Card + eyebrow label + `text-3xl md:text-4xl font-display font-bold tabular-nums`
  value (wrap number in `<AnimatedNumber>`), muted delta/context line under.
- **Badge**: pill, quiet tints (`bg-secondary text-secondary-foreground` default;
  `bg-success/10 text-success` etc. for status). No neon borders.
- **Inputs**: `rounded-2xl` `h-11`, quiet `bg-secondary/60` fill, soft focus ring
  (`focus-visible:ring-2 ring-primary/30`). Labels `text-sm font-medium`.
- **Segmented control** (Bevel pill tabs): use `<Tabs>` — restyled as a `bg-secondary rounded-full p-1`
  track with white (dark: card) active pill + soft shadow. Use for Children/Adults toggles,
  view modes, filters.
- **Dialog/Sheet**: `rounded-3xl` panels, `backdrop-blur-sm bg-black/40` overlay (dark: /60),
  soft spring entrance (built-in). Sticky footers: `border-t border-border/50 bg-card/95 backdrop-blur`.
- **Table** (admin): borderless rows separated by `divide-y divide-border/50`, `rounded-3xl`
  Card wrapper, sticky header `text-xs font-semibold text-muted-foreground` (sentence case).
- **Charts/sparklines** (admin/portal data): thin 2px lines, `text-primary` stroke, soft dotted
  baseline, glowing endpoint dot (`drop-shadow`), tinted target bands `bg-success/10`.

## 5. Layout & spacing

- Page container: `container max-w-6xl` (marketing `max-w-7xl`), vertical rhythm `py-16 md:py-24`
  between marketing sections; app pages `py-8 md:py-10`.
- Generous whitespace: min `gap-4` in card stacks (Bevel stacks cards with 12–16px gaps).
- Marketing sections: one idea per section, alternating quiet backgrounds
  (`bg-background` / `bg-secondary/40`), NO full-bleed colour walls except the adult/night
  sections and final CTA band.
- Sticky headers/navs: `bg-background/80 backdrop-blur-xl` + hairline bottom border.

## 6. Motion kit (`src/components/motion/` — Motion for React, code-split safe)

- `<FadeRise>` in-view entrance (opacity 0 → 1, y 14 → 0, spring). Props: `delay`, `as`.
- `<Stagger>` parent that staggers `<FadeRise>` children (80ms).
- `<AnimatedNumber value={n} />` springy count-up when in view (replaces StatCounter maths).
- `<AmbientGlow variant>` aurora washes (replaces GrainOverlay/stage-light).
- `<PressScale>` wraps tappables: scale 0.97 on press, spring back. Buttons have it built in.
- `ScrollProgress` retained (2px, blue→magenta, top).
- Hovers: cards lift `-translate-y-0.5` + `shadow-soft-lg` transition 300ms ease-out. No glow-pulse.
- DELETED motifs — do not use: `GrainOverlay`, `Marquee`, `.stage-light-*`, `.text-stroke*`,
  `animate-glow-pulse`, ghost giant background words, magnetic cursors, uppercase display type.

## 7. Per-surface rules

- **Marketing (light)**: aurora hero (big sentence-case headline + serif italic accent word +
  two CTAs: primary blue "Children's classes", dark/night pill "Adult classes"), then calm
  sections. Adult-track sections within a page use the night treatment (navy bg, magenta accent)
  as a full-width rounded band — this is the club flavour, used once or twice per page max.
- **Portal (children=light / adult=night)**: Bevel app feel. Page title pattern, card stacks,
  segmented controls, floating feel. Keep every business rule, guard, query and handler intact.
- **Checkout/Auth**: calmest screens; zero decoration beyond one soft wash; trust rows quiet.
  Checkout reads CSS vars for Stripe Appearance — keep var names intact.
- **Admin/Staff (light console)**: Bevel dashboard look — paper background, white cards,
  soft sidebar panel (rounded, shadow, icon tiles, active pill), sentence-case labels,
  blue=children / magenta=adult data coding via tokens. Tables per recipe. Keep all logic.
- **Emails**: same system in inline-CSS HTML (white card on paper bg, pill button, ink text).

## 8. Hard constraints

- KEEP all functionality, content, copy meaning, routes, queries, handlers, business rules,
  test-relevant behaviour. This is a presentation-layer redesign.
- Only edit files assigned to you. Never edit `src/index.css`, `tailwind.config.ts`,
  `src/components/ui/*`, layouts, or the motion kit (already done).
- No new dependencies. Icons: lucide only.
- All copy sentence case (branded names keep their casing). Buttons: "Book now", not "BOOK NOW".
- `npm run build` and `npm test` must stay green.
