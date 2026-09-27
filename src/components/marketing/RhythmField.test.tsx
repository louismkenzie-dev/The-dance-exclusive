import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RhythmField } from "./RhythmField";

afterEach(()=>{cleanup();vi.restoreAllMocks();});
describe("rhythm field motion safety",()=>{
  it("retains static linework when canvas is unavailable",()=>{
    vi.spyOn(HTMLCanvasElement.prototype,"getContext").mockReturnValue(null);
    const {container}=render(<RhythmField active/>);
    expect(container.querySelector('[data-renderer="svg"]')).toBeInTheDocument();
    expect(container.querySelectorAll("svg path").length).toBeGreaterThan(100);
    expect(container.querySelector("svg")).not.toHaveStyle({visibility:"hidden"});
  });
  it("cancels motion when paused and keeps its static canvas",()=>{
    const context={clearRect:vi.fn(),setTransform:vi.fn(),beginPath:vi.fn(),moveTo:vi.fn(),lineTo:vi.fn(),stroke:vi.fn()};
    vi.spyOn(HTMLCanvasElement.prototype,"getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D);
    vi.spyOn(Element.prototype,"getBoundingClientRect").mockReturnValue({width:1280,height:320,top:0,left:0,right:1280,bottom:320,x:0,y:0,toJSON:()=>({})});
    const frames = new Map<number,FrameRequestCallback>();let next=0;
    vi.spyOn(window,"requestAnimationFrame").mockImplementation(fn=>{frames.set(++next,fn);return next;});
    vi.spyOn(window,"cancelAnimationFrame").mockImplementation(id=>{frames.delete(id);});
    const {container,rerender}=render(<RhythmField active/>);
    expect(container.querySelector('[data-renderer="canvas"]')).toBeInTheDocument();
    rerender(<RhythmField active={false}/>);
    const strokes=context.stroke.mock.calls.length;
    for(const [id,fn] of [...frames]){frames.delete(id);fn(performance.now()+100);}
    expect(context.stroke).toHaveBeenCalledTimes(strokes);
    expect(container.querySelector('[data-renderer="canvas"]')).toBeInTheDocument();
  });
  it("does not start animation when the system requests reduced motion",()=>{
    vi.spyOn(window,"matchMedia").mockReturnValue({matches:true,addEventListener:vi.fn(),removeEventListener:vi.fn()} as unknown as MediaQueryList);
    const stroke=vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype,"getContext").mockReturnValue({clearRect:vi.fn(),setTransform:vi.fn(),beginPath:vi.fn(),moveTo:vi.fn(),lineTo:vi.fn(),stroke} as unknown as CanvasRenderingContext2D);
    vi.spyOn(Element.prototype,"getBoundingClientRect").mockReturnValue({width:390,height:240,top:0} as DOMRect);
    const frames:FrameRequestCallback[]=[];
    vi.spyOn(window,"requestAnimationFrame").mockImplementation(fn=>{frames.push(fn);return frames.length;});
    vi.spyOn(window,"cancelAnimationFrame").mockImplementation(()=>{});
    render(<RhythmField active/>);
    const initial=stroke.mock.calls.length;
    frames.splice(0).forEach(fn=>fn(performance.now()+100));
    expect(stroke).toHaveBeenCalledTimes(initial);
  });
});
