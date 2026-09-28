# Homepage mobile motion repair

## Direction contract

Repair the missing phone entrance animation and reduce interruptions to native touch scrolling within the incumbent homepage. Preserve TDE blue, ink, typography, media, composition, motion controls and the connected class-booking journey. This is a narrow behavior repair, not a new visual direction or a global motion system.

## Implemented behavior

`src/hooks/useHomeChoreography.ts` now enables homepage choreography on phones as well as desktop. Desktop means a minimum width of 1024px with a fine pointer. Only desktop installs Lenis wheel smoothing; phone scrolling remains native.

On an initial entrance near the top of the page, phones fade the artwork from 35% opacity over 0.65 seconds and roll the masked letters into place over 0.7 seconds with a 12ms stagger. The actions fade in over 0.45 seconds. Desktop retains its 1.25-second aperture reveal, 1.6-second field expansion and 1.05-second letter rolls with a 25ms stagger.

Phone hero scrolling directly drives the star rotation, a restrained video scale to 1.06, and translation of the existing SVG line artwork from -3% to 3% horizontally and to -4% vertically. The SVG starts at 1.08 scale. Direct scrub avoids adding a second delayed scroll response to native touch momentum. Desktop retains its canvas artwork, smoothed hero scrub, ticker movement, photo aperture and video scale to 1.15. The existing lightweight star scene continues to open with scroll.

Resize-driven refreshes are coalesced into an animation frame. Width-preserving height changes below 80px are ignored; on phones, refreshes requested while scrolling are deferred until `scrollEnd`. Font readiness uses the same refresh path. Cleanup disconnects the observer, removes the listener, cancels the pending frame, reverts GSAP styles and destroys any desktop Lenis instance. Pause and reduced motion retain the existing static, readable presentation.

## Evidence and disposition

The supplied finish review is **ship, with no material fixes**. Browser verification observed changing hero transforms and an opening star scene at 390px mobile width, with no horizontal overflow. Captures are retained at `.impeccable/review/motion-mobile-hero.png`, `motion-mobile-star-start.png`, `motion-mobile-star-open.png` and `motion-desktop.png`.

Three new regression tests in `src/hooks/useHomeChoreography.test.tsx` cover phone choreography without Lenis, pause/play cleanup and restoration, and visible reduced-motion content without scroll animations. Fourteen targeted motion tests passed during the repair. After the final refresh-deferral change, the three hook tests, TypeScript check and production build passed. These are the implementation and verification results supplied to this documentation pass; this pass inspected source and did not repeat those runs.

The repair was deployed to the [Vercel preview](https://the-dance-exclusive-ow8a2j51u-nullshift.vercel.app). At 390px width, the deployed browser check observed scroll position moving from 0 to 253px, line translation changing from (-3%, 0%) to (-1.0532%, -1.2979%), and star rotation changing from 0 to 58.4043 degrees without Lenis.

Physical iOS touch scrolling has not been verified. Browser observations and build results do not establish device-level smoothness. Deployment is preview only; production is unchanged.

## Documentation boundary and existing drift

`PRODUCT.md`, root `DESIGN.md` and `.impeccable/design.json` remain unchanged. This surface record describes the narrow repair without promoting local timings into global tokens.

Root `DESIGN.md` already describes the star scene as an elliptical aperture and its scrub as uniformly 0.8 seconds; the current component uses a star aperture and direct scrub for its lightweight variant. Its canvas description also omits the existing phone/coarse-pointer SVG path. The hero timing paragraph records the desktop sequence only and now needs this surface record for the phone variant. These documentation differences are reported here rather than repaired outside the authorized file boundary; the component and hook remain the implementation authority.
