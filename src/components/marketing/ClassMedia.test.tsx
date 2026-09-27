import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ClassMedia } from "./ClassMedia";
import { classPhoto } from "@/lib/tdeMedia";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { storage: { from: () => ({ getPublicUrl: (path: string) => ({ data: { publicUrl: `https://storage.example/workshop-media/${path}` } }) }) } } }));
afterEach(() => { cleanup(); vi.unstubAllEnvs(); });
const item = { id: "test-class", name: "Street dance", class_type: "children" };
const cover = { cover_image: "covers/class.jpg", cover_position: "52% 58%", cover_zoom: 1.15, cover_fit: "cover" };

describe("booking artwork on public pages", () => {
  it("retries the original artwork if optimisation fails before using a school fallback", () => {
    vi.stubEnv("PROD", true);
    const original = "https://suwaetnsszlpaaykhpif.supabase.co/storage/v1/object/public/workshop-media/covers/class.jpeg";
    const { container } = render(<ClassMedia item={{ ...item, workshops: { ...cover, cover_image: original } }} sizes="33vw" />);
    expect(container.querySelector("img")!.getAttribute("src")).toMatch(/^\/_vercel\/image\?/);
    expect(container.querySelector("img")).toHaveAttribute("sizes", "33vw");
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")).toHaveAttribute("src", original);
    expect(container.querySelector("img")).not.toHaveAttribute("srcset");
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")).toHaveAttribute("src", classPhoto(item).src);
  });
  it("reveals the whole photo after decoding instead of painting scan lines", async () => {
    const { container } = render(<ClassMedia item={{ ...item, workshops: cover }} />);
    const image = container.querySelector("img")!;
    expect(image).toHaveStyle({ opacity: "0" });
    Object.defineProperty(image, "naturalWidth", { value: 768 });
    image.decode = vi.fn().mockResolvedValue(undefined);
    fireEvent.load(image);
    await waitFor(() => expect(image.style.opacity).toBe(""));
    expect(image.decode).toHaveBeenCalledOnce();
  });
  it("uses attached artwork with the saved focal point and zoom", () => {
    const { container } = render(<ClassMedia item={{ ...item, workshops: cover }} />);
    const image = container.querySelector("img")!;
    expect(image).toHaveAttribute("src", "https://storage.example/workshop-media/covers/class.jpg");
    expect(image).toHaveStyle({ objectPosition: "52% 58%", transform: "scale(1.15)" });
    expect(image).not.toHaveAttribute("srcset");
    expect(image).toHaveAttribute("loading", "lazy");
  });
  it("preserves full-URL artwork and contain framing without zoom", () => {
    const { container } = render(<ClassMedia item={{ ...item, workshops: { ...cover, cover_image: "https://example.com/logo.png", cover_fit: "contain" } }} eager decorative />);
    const image = container.querySelector("img")!;
    expect(image).toHaveAttribute("src", "https://example.com/logo.png");
    expect(image).toHaveClass("object-contain");
    expect(image.style.transform).toBe("");
    expect(image).toHaveAttribute("alt", "");
    expect(image).toHaveAttribute("loading", "eager");
  });
  it("falls back for missing or broken artwork and accepts a later staff replacement", () => {
    const { container, rerender } = render(<ClassMedia item={item} />);
    expect(container.querySelector("img")).toHaveAttribute("src", classPhoto(item).src);
    rerender(<ClassMedia item={{ ...item, workshops: cover }} />);
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")).toHaveAttribute("src", classPhoto(item).src);
    rerender(<ClassMedia item={{ ...item, workshops: { ...cover, cover_image: "covers/replacement.jpg" } }} />);
    expect(container.querySelector("img")).toHaveAttribute("src", "https://storage.example/workshop-media/covers/replacement.jpg");
  });
});
