export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let s = seed | 0;
  return function (): number {
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rngRange(r: Rng, lo: number, hi: number): number {
  return lo + r() * (hi - lo);
}

export function rngInt(r: Rng, lo: number, hi: number): number {
  return Math.floor(rngRange(r, lo, hi + 1));
}

export function rngPick<T>(r: Rng, arr: readonly T[]): T {
  return arr[Math.floor(r() * arr.length)];
}
