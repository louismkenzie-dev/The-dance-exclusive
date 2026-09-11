import { describe, it, expect } from "vitest";
import {
  MAX_DANCERS,
  listNames,
  privateClassName,
  privateWord,
} from "../../supabase/functions/_shared/privateSession";
import * as mirror from "./privateSession";

describe("naming a private session", () => {
  it("calls a private by the size the studio uses", () => {
    expect(privateWord(1)).toBe("One-to-one");
    expect(privateWord(2)).toBe("Duo");
    expect(privateWord(3)).toBe("Trio");
    expect(privateWord(4)).toBe("Quad");
  });

  it("has a word for anything bigger than a quad", () => {
    expect(privateWord(5)).toBe("Private group");
    expect(privateWord(MAX_DANCERS)).toBe("Private group");
  });

  it("reads a list of names the way you'd say it aloud", () => {
    expect(listNames([])).toBe("");
    expect(listNames(["Ella"])).toBe("Ella");
    expect(listNames(["Ella", "Immy"])).toBe("Ella & Immy");
    expect(listNames(["Ella", "Immy", "Noah"])).toBe("Ella, Immy & Noah");
  });

  it("names a solo exactly as it always has", () => {
    expect(privateClassName(["Ella"], "Leah")).toBe("1:1 Session — Ella with Leah");
    expect(privateClassName(["Ella"], null)).toBe("1:1 Session — Ella");
  });

  it("names a duo and a quad after everyone on it", () => {
    expect(privateClassName(["Ella", "Immy"], "Leah")).toBe("Duo — Ella & Immy with Leah");
    expect(privateClassName(["A", "B", "C", "D"])).toBe("Quad — A, B, C & D");
  });

  it("keeps the app's copy in step with the edge functions'", () => {
    expect(mirror.MAX_DANCERS).toBe(MAX_DANCERS);
    expect(mirror.privateWord(2)).toBe(privateWord(2));
    expect(mirror.listNames(["Ella", "Immy"])).toBe(listNames(["Ella", "Immy"]));
    expect(mirror.privateClassName(["Ella", "Immy"], "Leah")).toBe(privateClassName(["Ella", "Immy"], "Leah"));
  });
});
