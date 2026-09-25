type Measure = () => () => void;
const subscribers = new Set<Measure>();
let frame = 0;

const schedule = () => {
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    // Read every position before writing transforms; one frame/listener for
    // all visible media, with no React state updates on scroll.
    const writes = [...subscribers].map((measure) => measure());
    writes.forEach((write) => write());
  });
};

export function onScrollFrame(measure: Measure) {
  if (subscribers.size === 0) {
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
  }
  subscribers.add(measure);
  schedule();
  return () => {
    subscribers.delete(measure);
    if (subscribers.size === 0) {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(frame);
      frame = 0;
    }
  };
}
