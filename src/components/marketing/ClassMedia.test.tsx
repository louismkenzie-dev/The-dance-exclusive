import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ClassMedia } from "./ClassMedia";
import { classPhoto } from "@/lib/tdeMedia";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { storage: { from: () => ({ getPublicUrl: (path: string) => ({ data: { publicUrl: `https://storage.example/workshop-media/${path}` } }) }) } } }));
afterEach(cleanup);
const item = { id: "test-class", name: "Street dance", class_type: "children" };
const cover = { cover_image: "covers/class.jpg", cover_position: "52% 58%", cover_zoom: 1.15, cover_fit: "cover" };

describe("booking artwork on public pages", () => {
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
