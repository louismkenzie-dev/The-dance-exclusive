/** Infinite CSS marquee ticker. Pure CSS, GPU-cheap, reduced-motion safe. */
export function Marquee({
  items,
  className = "",
  reverse = false,
  speed = 32,
  accent = "text-primary",
}: {
  items: string[];
  className?: string;
  reverse?: boolean;
  speed?: number;
  accent?: string;
}) {
  const track = [...items, ...items];
  return (
    <div className={`marquee mask-fade-x overflow-hidden ${className}`}>
      <div
        className="marquee__track flex w-max items-center"
        style={{ animationDuration: `${speed}s`, animationDirection: reverse ? "reverse" : "normal" }}
      >
        {track.map((it, i) => (
          <span key={i} className="flex items-center font-display uppercase tracking-[0.18em]">
            <span className="px-6">{it}</span>
            <span className={`${accent} text-lg`}>✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export default Marquee;
