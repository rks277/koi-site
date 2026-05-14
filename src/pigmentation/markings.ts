import { frameAt } from '../morphology/spine';
import { radius } from '../morphology/body';
import { PALETTES } from './palettes';
import { fbm2, type Noise2D } from '../rng/noise';
import type { Genome, Marking, Spine } from '../types';
import type { Rng } from '../rng/mulberry32';

const TEX_SIZE = 192;
const TANCHO_PROBABILITY = 0.20;

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const v = parseInt(hex.replace('#', ''), 16);
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
}

/**
 * Bake an alpha-noise texture for one marking. The texture is sampled in
 * marking-local coords (x ∈ [-1, 1], y ∈ [-1, 1]) using FBM Perlin noise plus
 * a soft circular falloff so edges fade into transparency. Pre-baked once per
 * marking — stamped per frame at the deformed body position.
 */
function bakeMarkingTexture(
  mark: Pick<Marking, 'noiseFreq' | 'noiseOffset' | 'threshold' | 'color' | 'uniform'>,
  noise: Noise2D
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = TEX_SIZE;
  canvas.height = TEX_SIZE;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(TEX_SIZE, TEX_SIZE);
  const data = img.data;
  const { r, g, b } = hexToRgb(mark.color);
  const half = TEX_SIZE / 2;
  const freq = mark.noiseFreq;
  const ox = mark.noiseOffset.x;
  const oy = mark.noiseOffset.y;

  for (let py = 0; py < TEX_SIZE; py++) {
    const ny = (py - half) / half;
    for (let px = 0; px < TEX_SIZE; px++) {
      const nx = (px - half) / half;
      const dist = Math.hypot(nx, ny);
      if (dist >= 1) continue;
      // Soft falloff: 1 at center, 0 at edge, smoothed via ease-in-out.
      const e = 1 - dist;
      const distFade = e * e * (3 - 2 * e);

      let presence: number;
      if (mark.uniform) {
        presence = distFade;
      } else {
        const n = fbm2(noise, nx * freq + ox, ny * freq + oy, 4, 2.0, 0.55);
        // Soft threshold: map noise + fade into a 0..1 presence value.
        const raw = (n + 0.6 - mark.threshold) * 1.6;
        presence = Math.max(0, Math.min(1, raw)) * distFade;
      }
      if (presence <= 0) continue;

      const idx = (py * TEX_SIZE + px) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = Math.min(255, Math.round(presence * 255));
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

export function buildMarkings(genome: Genome, rng: Rng, noise: Noise2D): Marking[] {
  const palette = PALETTES[genome.variety];
  if (palette.marks.length === 0) return [];

  const out: Marking[] = [];

  // Tancho-style head spot: low-probability solid disc on the crown.
  if (rng() < TANCHO_PROBABILITY) {
    const proto = {
      s: 0.16 + rng() * 0.06,
      u: 0,
      size: 0.075 + rng() * 0.03,
      rot: 0,
      noiseOffset: { x: rng() * 1000, y: rng() * 1000 },
      noiseFreq: 0.5,
      threshold: 0,
      uniform: true,
      color: palette.marks[0]
    };
    out.push({ ...proto, texture: bakeMarkingTexture(proto, noise) });
  }

  // Body patches: random positions, isotropic sizes, varied noise frequencies.
  const count = Math.max(2, genome.markingCount + 1);
  for (let i = 0; i < count; i++) {
    const s = 0.22 + rng() * 0.62;
    const u = (rng() - 0.5) * 1.6;
    const sizeMul = 0.55 + rng() * 0.75;
    const color = palette.marks[Math.floor(rng() * palette.marks.length)];
    const proto = {
      s,
      u,
      size: genome.markingSize * sizeMul * 0.65,
      rot: rng() * Math.PI * 2,
      noiseOffset: { x: rng() * 1000, y: rng() * 1000 },
      noiseFreq: 1.4 + rng() * 2.6,
      threshold: 0.15 + rng() * 0.25,
      color
    };
    out.push({ ...proto, texture: bakeMarkingTexture(proto, noise) });
  }
  return out;
}

/** Per-frame: world-space center for a marking on the current (deformed) spine. */
export function markingCenter(
  mark: Marking,
  spine: Spine,
  genome: Genome
): { x: number; y: number; angle: number } {
  const f = frameAt(spine.samples, mark.s);
  const r = radius(f.t, genome);
  return {
    x: f.pos.x + f.normal.x * mark.u * r,
    y: f.pos.y + f.normal.y * mark.u * r,
    angle: Math.atan2(f.tangent.y, f.tangent.x) + mark.rot
  };
}
