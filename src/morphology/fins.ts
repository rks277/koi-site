import { frameAt } from './spine';
import { radius } from './body';
import type { Fin, FinKind, FinRay, Genome, Spine, Vec2 } from '../types';
import type { Rng } from '../rng/mulberry32';

interface FinSpec {
  kind: FinKind;
  side: -1 | 0 | 1;
  attachmentT: number;
  attachSpan: number;
  baseSweep: number; // rad, sweep-back of fin axis from body-normal
  spread: number; // rad, fan-angle half-width across rays
  rayCount: number;
  length: number; // in body-length units
  opacity: number;
  // Ray-length envelope across the fan: lobeFloor + (1-lobeFloor) * sin(pi*u)^lobePower
  // Lower lobeFloor + higher lobePower → more tapered "veil" silhouette.
  lobeFloor?: number;
  lobePower?: number;
  // Extra perpendicular curl on each ray, scales with (1 - finRoundness).
  curlBoost?: number;
  // Per-ray length jitter magnitude.
  jitter?: number;
}

/**
 * Generate the standard koi fin set:
 *  - paired pectorals at the shoulder
 *  - paired pelvics mid-belly
 *  - single anal under the rear belly
 *  - single dorsal along the back
 *  - paired caudal lobes at the peduncle (forked tail)
 */
export function buildFins(spine: Spine, genome: Genome, rng: Rng): Fin[] {
  const L = genome.bodyLength;
  const finLen = genome.pectoralFinSize;
  const tailLen = genome.tailSize;
  const fork = genome.tailForkDepth;

  const specs: FinSpec[] = [
    {
      kind: 'pectoral',
      side: 1,
      attachmentT: 0.22,
      attachSpan: 0.05,
      baseSweep: 1.05,
      spread: genome.pectoralFinSpread * 0.40,
      rayCount: 9,
      length: 0.20 * finLen * L,
      opacity: 0.55
    },
    {
      kind: 'pectoral',
      side: -1,
      attachmentT: 0.22,
      attachSpan: 0.05,
      baseSweep: 1.05,
      spread: genome.pectoralFinSpread * 0.40,
      rayCount: 9,
      length: 0.20 * finLen * L,
      opacity: 0.55
    },
    {
      kind: 'pelvic',
      side: 1,
      attachmentT: 0.52,
      attachSpan: 0.04,
      baseSweep: 1.20,
      spread: 0.35,
      rayCount: 7,
      length: 0.11 * finLen * L,
      opacity: 0.5
    },
    {
      kind: 'pelvic',
      side: -1,
      attachmentT: 0.52,
      attachSpan: 0.04,
      baseSweep: 1.20,
      spread: 0.35,
      rayCount: 7,
      length: 0.11 * finLen * L,
      opacity: 0.5
    },
    {
      kind: 'anal',
      side: 1,
      attachmentT: 0.68,
      attachSpan: 0.04,
      baseSweep: 1.30,
      spread: 0.30,
      rayCount: 6,
      length: 0.09 * finLen * L,
      opacity: 0.5
    },
    {
      kind: 'dorsal',
      side: 0,
      attachmentT: 0.44,
      attachSpan: 0.20,
      baseSweep: 0.70,
      spread: 0.32,
      rayCount: 14,
      length: 0.12 * finLen * L,
      opacity: 0.5,
      curlBoost: 0.22,
      lobeFloor: 0.55,
      lobePower: 1.1
    },
    // Caudal: a single centerline fan attached at the peduncle. Sweeps from
    // upper-back to lower-back as one continuous shape — no forked overlap.
    {
      kind: 'caudal',
      side: 0,
      attachmentT: 0.96,
      attachSpan: 0.02,
      baseSweep: Math.PI / 2,
      spread: 0.42 + fork * 0.20,
      rayCount: 15,
      length: 0.34 * tailLen * L,
      opacity: 0.40,
      lobeFloor: 0.55,
      lobePower: 1.2,
      curlBoost: 0.0,
      jitter: 0.04
    }
  ];

  return specs.map((s) => buildFin(s, spine, genome, rng));
}

function buildFin(spec: FinSpec, spine: Spine, genome: Genome, rng: Rng): Fin {
  const rays: FinRay[] = [];
  const round = genome.finRoundness;
  const jitterMag = spec.jitter ?? (0.08 + 0.06 * (1 - round));
  const lobeFloor = spec.lobeFloor ?? 0.72;
  const lobePower = spec.lobePower ?? 0.65;
  const curlBoost = spec.curlBoost ?? 0;
  for (let i = 0; i < spec.rayCount; i++) {
    const u = i / (spec.rayCount - 1); // 0..1
    const tAttach =
      spec.attachmentT + (u - 0.5) * spec.attachSpan;
    const f = frameAt(spine.samples, Math.max(0, Math.min(1, tAttach)));
    const r = radius(f.t, genome);
    // base point on body silhouette (or near centerline for centerline fins)
    const sideMag = spec.side === 0 ? 0 : 1;
    const base: Vec2 = {
      x: f.pos.x + f.normal.x * r * spec.side * sideMag,
      y: f.pos.y + f.normal.y * r * spec.side * sideMag
    };

    // Local axis system: outward (normal * side) + backward (tangent)
    const outX = spec.side === 0 ? 0 : f.normal.x * spec.side;
    const outY = spec.side === 0 ? 0 : f.normal.y * spec.side;
    // For centerline fins (dorsal/anal), use spine perpendicular *up* (perp normal)
    const upX = spec.side === 0 ? f.normal.x : outX;
    const upY = spec.side === 0 ? f.normal.y : outY;
    const backX = f.tangent.x;
    const backY = f.tangent.y;

    // Fan angle around the per-fin baseSweep
    const ang = spec.baseSweep + (u - 0.5) * spec.spread * 2;
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    const dirX = upX * c + backX * s;
    const dirY = upY * c + backY * s;

    // Length envelope: floor + sin-shaped peak (caudal pushes floor low + peak sharp)
    const lobeShape = Math.pow(Math.sin(Math.PI * u), lobePower);
    const lobe = lobeFloor + (1 - lobeFloor) * lobeShape;
    const j = 1 + (rng() - 0.5) * jitterMag;
    const L = spec.length * lobe * j;

    // Curl: perpendicular bias toward the trailing edge for graceful sweep
    const perpX = -dirY;
    const perpY = dirX;
    const curl = (u - 0.5) * (0.25 + curlBoost) + (1 - round) * 0.1;

    const tip: Vec2 = {
      x: base.x + dirX * L + perpX * L * curl,
      y: base.y + dirY * L + perpY * L * curl
    };
    const control: Vec2 = {
      x: base.x + dirX * L * 0.45 + perpX * L * curl * 1.4,
      y: base.y + dirY * L * 0.45 + perpY * L * curl * 1.4
    };
    rays.push({ base, control, tip, width: 0.5 });
  }

  // Membrane envelope: trace along tips, then back along base
  const membrane: Vec2[] = [];
  for (const ry of rays) membrane.push(ry.tip);
  for (let i = rays.length - 1; i >= 0; i--) membrane.push(rays[i].base);

  return {
    kind: spec.kind,
    side: spec.side,
    attachmentT: spec.attachmentT,
    attachSpan: spec.attachSpan,
    rays,
    membrane,
    opacity: spec.opacity
  };
}
