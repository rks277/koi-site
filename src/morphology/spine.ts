import type { Genome, Spine, SpineSample, Vec2 } from '../types';
import type { Rng } from '../rng/mulberry32';

// Number of canonical control points (rest-pose spine)
const CONTROL_POINTS = 9;
// Number of samples on the deformed spine each frame
export const SPINE_SAMPLES = 80;

/** Build the rest-pose centerline. Head at x=0, tail at x = length, all in local units. */
export function buildSpine(genome: Genome, rng: Rng): Spine {
  const length = genome.bodyLength;
  const base: Vec2[] = [];
  for (let i = 0; i < CONTROL_POINTS; i++) {
    const t = i / (CONTROL_POINTS - 1);
    // Gentle parabolic curve + tiny per-fish noise = natural asymmetry
    const curve = genome.spineCurvature * Math.sin(t * Math.PI) * length * 0.08;
    const noise = (rng() - 0.5) * genome.spineNoise * length;
    base.push({ x: t * length, y: curve + noise });
  }
  return {
    base,
    samples: sampleSpine(base, SPINE_SAMPLES, null),
    length
  };
}

/**
 * Resample the spine at SPINE_SAMPLES evenly along x, applying an optional
 * deformation function offset(t, idx) -> additional y. Produces tangent and normal frames.
 */
export function sampleSpine(
  base: Vec2[],
  N: number,
  deform: ((t: number) => number) | null
): SpineSample[] {
  const xs = new Array<number>(N);
  const ys = new Array<number>(N);
  const lastX = base[base.length - 1].x;
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const x = t * lastX;
    // Linear interpolation across control points
    let j = 0;
    while (j < base.length - 2 && base[j + 1].x < x) j++;
    const seg = base[j + 1].x - base[j].x;
    const a = seg > 0 ? (x - base[j].x) / seg : 0;
    const y = base[j].y * (1 - a) + base[j + 1].y * a;
    xs[i] = x;
    ys[i] = y + (deform ? deform(t) : 0);
  }
  // Cheap smoothing of y after deformation so the spine wave reads as continuous
  if (deform) {
    const smoothed = ys.slice();
    for (let pass = 0; pass < 1; pass++) {
      for (let i = 1; i < N - 1; i++) {
        smoothed[i] = ys[i - 1] * 0.25 + ys[i] * 0.5 + ys[i + 1] * 0.25;
      }
      for (let i = 0; i < N; i++) ys[i] = smoothed[i];
    }
  }
  const out: SpineSample[] = [];
  for (let i = 0; i < N; i++) {
    const im = Math.max(0, i - 1);
    const ip = Math.min(N - 1, i + 1);
    const tx = xs[ip] - xs[im];
    const ty = ys[ip] - ys[im];
    const len = Math.hypot(tx, ty) || 1;
    const ux = tx / len;
    const uy = ty / len;
    out.push({
      t: i / (N - 1),
      pos: { x: xs[i], y: ys[i] },
      tangent: { x: ux, y: uy },
      normal: { x: -uy, y: ux }
    });
  }
  return out;
}

/** Sample any spine sample sequence at fractional t with linear interp. */
export function frameAt(samples: SpineSample[], t: number): SpineSample {
  const N = samples.length - 1;
  const tc = Math.max(0, Math.min(1, t));
  const f = tc * N;
  const i = Math.min(N - 1, Math.floor(f));
  const a = f - i;
  const f0 = samples[i];
  const f1 = samples[i + 1];
  return {
    t: tc,
    pos: { x: f0.pos.x * (1 - a) + f1.pos.x * a, y: f0.pos.y * (1 - a) + f1.pos.y * a },
    tangent: {
      x: f0.tangent.x * (1 - a) + f1.tangent.x * a,
      y: f0.tangent.y * (1 - a) + f1.tangent.y * a
    },
    normal: {
      x: f0.normal.x * (1 - a) + f1.normal.x * a,
      y: f0.normal.y * (1 - a) + f1.normal.y * a
    }
  };
}
