import type { Rng } from './mulberry32';

export type Noise2D = (x: number, y: number) => number;

/**
 * Classic Perlin noise in 2D, seeded via a permutation table built from `rng`.
 * Output is in roughly [-1, 1].
 */
export function makePerlin2D(rng: Rng): Noise2D {
  const SIZE = 256;
  const perm = new Uint8Array(SIZE * 2);
  for (let i = 0; i < SIZE; i++) perm[i] = i;
  for (let i = SIZE - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = perm[i];
    perm[i] = perm[j];
    perm[j] = t;
  }
  for (let i = 0; i < SIZE; i++) perm[SIZE + i] = perm[i];

  const fade = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
  const grad = (hash: number, x: number, y: number): number => {
    switch (hash & 7) {
      case 0: return x + y;
      case 1: return -x + y;
      case 2: return x - y;
      case 3: return -x - y;
      case 4: return x;
      case 5: return -x;
      case 6: return y;
      default: return -y;
    }
  };

  return (x: number, y: number): number => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const X = xi & 255;
    const Y = yi & 255;
    const xf = x - xi;
    const yf = y - yi;
    const u = fade(xf);
    const v = fade(yf);
    const aa = perm[perm[X] + Y];
    const ab = perm[perm[X] + Y + 1];
    const ba = perm[perm[X + 1] + Y];
    const bb = perm[perm[X + 1] + Y + 1];
    return lerp(
      lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u),
      lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u),
      v
    );
  };
}

/** Fractal Brownian Motion: sum of octaves at decreasing amplitude. */
export function fbm2(
  noise: Noise2D,
  x: number,
  y: number,
  octaves = 4,
  lacunarity = 2,
  persistence = 0.5
): number {
  let sum = 0;
  let amp = 1;
  let freq = 1;
  let totalAmp = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise(x * freq, y * freq);
    totalAmp += amp;
    amp *= persistence;
    freq *= lacunarity;
  }
  return sum / totalAmp;
}
