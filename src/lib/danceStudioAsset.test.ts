import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** Guard against accidentally replacing the animated scene with an image plate. */
describe("Blender studio export", () => {
  it("contains studio geometry and changing mannequin poses, not just camera movement", () => {
    const bytes = readFileSync("public/models/tde-animated-studio.glb");
    expect(bytes.toString("ascii", 0, 4)).toBe("glTF");
    const jsonLength = bytes.readUInt32LE(12);
    const model = JSON.parse(bytes.toString("utf8", 20, 20 + jsonLength));
    const node = model.nodes.findIndex((item: { name: string }) => item.name === "Hand_R");
    const animation = model.animations.find((clip: { channels: { target: { node: number; path: string } }[] }) => clip.channels.some(channel => channel.target.node === node && channel.target.path === "translation"));
    expect(animation).toBeDefined();
    const channel = animation.channels.find((item: { target: { node: number; path: string } }) => item.target.node === node && item.target.path === "translation");
    const accessor = model.accessors[animation.samplers[channel.sampler].output];
    expect(accessor.count).toBeGreaterThan(10);
    expect(accessor.type).toBe("VEC3");
    expect(accessor.componentType).toBe(5126); // float32 positions
    const view = model.bufferViews[accessor.bufferView];
    const offset = 20 + jsonLength + 8 + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    const x = Array.from({ length: accessor.count }, (_, frame) => bytes.readFloatLE(offset + frame * (view.byteStride ?? 12)));
    expect(Math.max(...x) - Math.min(...x)).toBeGreaterThan(.3);
    expect(model.nodes.some((item: { name: string }) => item.name === "Sprung dance floor")).toBe(true);
    expect(model.nodes.some((item: { name: string }) => item.name === "Back wall")).toBe(true);
  });
});
