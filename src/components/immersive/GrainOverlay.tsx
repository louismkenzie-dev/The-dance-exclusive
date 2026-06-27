/**
 * Fixed film-grain texture. Zero asset weight — inline SVG feTurbulence noise.
 * Scoped to a relative parent (absolute inset-0) so it never covers modals.
 */
const GrainOverlay = ({ className = "" }: { className?: string }) => (
  <div
    aria-hidden
    className={`pointer-events-none absolute inset-0 opacity-[0.045] mix-blend-soft-light [&>svg]:h-full [&>svg]:w-full ${className}`}
  >
    <svg xmlns="http://www.w3.org/2000/svg">
      <filter id="tde-grain">
        <feTurbulence type="fractalNoise" baseFrequency="0.82" numOctaves="2" stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#tde-grain)" />
    </svg>
  </div>
);

export default GrainOverlay;
