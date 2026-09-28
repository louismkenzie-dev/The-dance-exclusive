# Homepage location finder

## Direction contract

Extend the existing homepage postcode finder in the incumbent TDE blue and ink identity. Fill the desktop right-hand column with a useful search surface and decorative street-dance artwork; keep the phone composition compact. The postcode form and real nearest-venue results remain the purpose of the panel.

The generated trainers and location pin are decorative imagery, not a venue photograph or geographic map. They use the existing blue/ink palette and do not introduce a new brand asset, logo, global token, component primitive or motion treatment. Existing square framing and Inter form typography remain authoritative.

## Implemented behavior

`HomeLocations` in `src/components/marketing/HomeDiscovery.tsx` retains the existing postcode lookup, coordinate fallback, distance sorting, venue links, loading/error feedback and clear action. The illustration appears while there is no result and gives way to the returned venue list. It is hidden from assistive technology and has empty alternative text.

The final finder rules in `src/styles/public-v2.css` stretch the desktop panel and use a flexible artwork region with a 260px minimum height. At widths up to 700px, the artwork becomes a fixed 200px region. The image uses contain sizing to preserve the full composition. Responsive 480px and 960px WebP assets are lazy-loaded with explicit intrinsic dimensions.

## Provenance and documentation decision

Asset provenance, original source, exported dimensions and generation prompt are recorded in [the artwork record](../../docs/design/location-finder/artwork.md). This is a surface-specific extension of the existing system. `PRODUCT.md`, root `DESIGN.md` and `.impeccable/design.json` are preserved; the illustration does not establish global guidance that would justify regenerating them.

## Evidence and disposition

The documentation pass checked `PRODUCT.md`, the incumbent `DESIGN.md`, sidecar identity, `HomeDiscovery.tsx`, the final finder CSS, both shipped asset sizes, and the artwork provenance record. The supplied finish-review disposition is **ship, with no material fixes**. This documentation pass inspected source evidence and did not independently repeat browser verification or establish deployment status.
