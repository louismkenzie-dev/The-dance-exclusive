import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { useHomeChoreography } from "./useHomeChoreography";

vi.mock("lenis", () => ({ default: vi.fn() }));
function Home({ active = true }: { active?: boolean }) {
  const ref = useHomeChoreography(active);
  return <div ref={ref}><section className="tde-rhythm-hero">
    <div className="tde-rhythm-art"><div className="tde-rhythm-underlay"><div className="tde-media-layer" /></div><svg className="tde-rhythm-fallback" /></div>
    <h1 className="tde-rhythm-title"><span className="tde-rhythm-letter-inner">Step in</span><svg /></h1>
    <div className="tde-rhythm-actions">Find your class</div>
  </section></div>;
}
beforeEach(() => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  Object.defineProperty(document, "fonts", { configurable: true, value: { ready: Promise.resolve() } });
  vi.spyOn(window, "matchMedia").mockImplementation(query => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as unknown as MediaQueryList);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.clearAllMocks(); });

describe("mobile homepage motion", () => {
  it("animates the hero on a phone without installing a scroll interceptor", async () => {
    const { container, unmount } = render(<Home />);
    const hero = container.querySelector(".tde-rhythm-hero");
    const triggers = ScrollTrigger.getAll().filter(trigger => trigger.trigger === hero);
    expect(triggers.length).toBeGreaterThan(0);
    expect(Lenis).not.toHaveBeenCalled();
    const field = container.querySelector<SVGElement>(".tde-rhythm-fallback")!;
    const before = field.style.transform;
    await act(async () => { triggers.forEach(trigger => trigger.animation?.progress(.5)); });
    expect(field.style.transform).not.toBe(before);
    unmount();
    expect(ScrollTrigger.getAll().filter(trigger => trigger.trigger === hero)).toHaveLength(0);
  });
  it("removes scroll animation on pause and restores it on play", () => {
    const { container, rerender } = render(<Home />);
    const hero = container.querySelector(".tde-rhythm-hero");
    rerender(<Home active={false} />);
    expect(ScrollTrigger.getAll().filter(trigger => trigger.trigger === hero)).toHaveLength(0);
    expect(container.querySelector<SVGElement>(".tde-rhythm-fallback")!.style.transform).toBe("");
    rerender(<Home />);
    expect(ScrollTrigger.getAll().filter(trigger => trigger.trigger === hero).length).toBeGreaterThan(0);
  });
  it("keeps reduced-motion content visible without scroll animations", () => {
    vi.mocked(window.matchMedia).mockImplementation(query => ({ matches: query.includes("prefers-reduced-motion"), media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as unknown as MediaQueryList);
    const { container } = render(<Home />);
    expect(ScrollTrigger.getAll()).toHaveLength(0);
    expect(container.querySelector("h1")).toHaveTextContent("Step in");
    expect(Lenis).not.toHaveBeenCalled();
  });
});
