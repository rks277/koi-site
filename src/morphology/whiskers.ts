import { frameAt } from './spine';
import { radius } from './body';
import type { Genome, Spine, Vec2, Whisker } from '../types';
import type { Rng } from '../rng/mulberry32';

const WHISKER_COUNT = 2;
const SAMPLES = 24;

/**
 * Whiskers as cubic Bézier curves with three unconstrained control points
 * (cp1, cp2, tip) beyond the fixed mouth-corner base. The 6-DOF parametric
 * family lets each whisker take its own organic shape — straight, gently
 * bowed, or hooked — without imposing a sinusoidal template.
 */
export function buildWhiskers(spine: Spine, genome: Genome, rng: Rng): Whisker[] {
  const out: Whisker[] = [];
  const f = frameAt(spine.samples, 0.022);
  const r = radius(f.t, genome);
  const len = genome.bodyLength * 0.14;

  // One coin flip per fish so both whiskers match for a symmetric face.
  const useScurve = rng() < 0.35;

  for (let i = 0; i < WHISKER_COUNT; i++) {
    const side: 1 | -1 = i === 0 ? 1 : -1;
    const base: Vec2 = {
      x: f.pos.x + f.normal.x * r * side,
      y: f.pos.y + f.normal.y * r * side
    };
    // Forward (-tangent, away from body) and outward (+normal × side).
    const fwdX = -f.tangent.x;
    const fwdY = -f.tangent.y;
    const outX = f.normal.x * side;
    const outY = f.normal.y * side;

    // Two shape templates:
    //   J-curve (default): forward+out → bow → trail backward.
    //   S-curve (sometimes): forward+out → backward bend → tip flicks forward
    //     again for a calligraphic terminal.
    let cp1Fwd: number, cp1Out: number;
    let cp2Fwd: number, cp2Out: number;
    let tipFwd: number, tipOut: number;
    if (useScurve) {
      // Slicked-back S: bow back early, then a small forward flick at the tip.
      cp1Fwd = 0.02 + rng() * 0.06;
      cp1Out = 0.28 + rng() * 0.15;
      cp2Fwd = -0.50 + rng() * 0.20;
      cp2Out = 0.55 + rng() * 0.25;
      tipFwd = -0.10 + rng() * 0.15;
      tipOut = 0.30 + rng() * 0.20;
    } else {
      // Slicked-back hook: leave near-perpendicular, then trail strongly back.
      cp1Fwd = 0.02 + rng() * 0.06;
      cp1Out = 0.30 + rng() * 0.20;
      cp2Fwd = -0.20 + rng() * 0.20;
      cp2Out = 0.75 + rng() * 0.30;
      tipFwd = -0.70 + rng() * 0.25;
      tipOut = 0.25 + rng() * 0.20;
    }

    const toWorld = (fwd: number, o: number): Vec2 => ({
      x: base.x + fwdX * len * fwd + outX * len * o,
      y: base.y + fwdY * len * fwd + outY * len * o
    });
    const cp1 = toWorld(cp1Fwd, cp1Out);
    const cp2 = toWorld(cp2Fwd, cp2Out);
    const tip = toWorld(tipFwd, tipOut);

    const wpts: Vec2[] = new Array(SAMPLES);
    for (let j = 0; j < SAMPLES; j++) {
      const t = j / (SAMPLES - 1);
      wpts[j] = cubicBezier(base, cp1, cp2, tip, t);
    }
    // Width in body-local units → scales with the fish.
    out.push({ spine: wpts, width: genome.bodyLength * 0.014 });
  }
  return out;
}

function cubicBezier(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, t: number): Vec2 {
  const u = 1 - t;
  const u2 = u * u;
  const t2 = t * t;
  return {
    x: u2 * u * p0.x + 3 * u2 * t * p1.x + 3 * u * t2 * p2.x + t2 * t * p3.x,
    y: u2 * u * p0.y + 3 * u2 * t * p1.y + 3 * u * t2 * p2.y + t2 * t * p3.y
  };
}
