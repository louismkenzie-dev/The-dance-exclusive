/** Original two-ripple geometry. Coordinates are normalized, independent of canvas size. */
export function rhythmX(u: number, v: number, phase: number, pointer = 0, scroll = 0): number {
  const upper = Math.exp(-Math.pow((v - .29 - .09 * Math.sin(u * 5 + phase * .25)) / .2, 2));
  const lower = Math.exp(-Math.pow((v - .78 - .08 * Math.cos(u * 7 - phase * .2)) / .23, 2));
  return u + .085 * Math.sin(u * 9 + phase * .3 + v * 3 + scroll) * upper
    + .06 * Math.sin(u * 13 - phase * .23 + pointer * .6) * lower
    + .018 * Math.sin(v * 9 + phase * .15) * pointer;
}

export function rhythmPath(u: number, phase = 0): string {
  return Array.from({ length: 49 }, (_, i) => {
    const v = i / 48;
    return `${i ? "L" : "M"}${(rhythmX(u, v, phase) * 1440).toFixed(1)},${(v * 480).toFixed(1)}`;
  }).join(" ");
}
